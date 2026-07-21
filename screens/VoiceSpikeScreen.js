// VOICE SPIKE (Phase 3a) — proof of concept only.
// Goal: prove audio round-trips. I speak Spanish -> Gemini Live replies in
// spoken Mexican Spanish, in real time, over a direct WebSocket.
// NOT the real tutor. No scenario logic, no persona depth, no saving.
//
// TODO(stt-1.1): the dev entry point (Home button + VoiceSpike route) was
// removed. This file is kept for the future voice-tutor work; re-wire an entry
// point when speech recognition returns.
import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AudioContext, AudioRecorder, AudioManager,
} from 'react-native-audio-api';
import { supabase } from '../lib/supabase';

// Gemini Live audio formats are fixed: mic in = 16-bit PCM / 16kHz / mono,
// playback = 16-bit PCM / 24kHz / mono. The AudioRecorder captures native
// Float32 at 16kHz, so no resampling — only a Float32<->Int16 conversion.
const MIC_SAMPLE_RATE = 16000;
const PLAYBACK_SAMPLE_RATE = 24000;
const MIC_BUFFER_SAMPLES = 1600; // ~100ms chunks at 16kHz

// Ephemeral-token clients use the *Constrained* Live endpoint (v1alpha).
const LIVE_WS_BASE =
  'wss://generativelanguage.googleapis.com/ws/'
  + 'google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

const SYSTEM_PROMPT =
  'You are a friendly Mexican Spanish conversation partner. Speak only in '
  + 'Mexican Spanish (es-MX), using authentic Mexican vocabulary and warmth.';

// ===========================================================================
// PCM CONVERSION — the fiddliest part of the spike. Isolated, named, and
// commented so byte-order / clipping / off-by-one bugs can be inspected and
// fixed in one place. Two directions:
// ===========================================================================

// SEND: mic Float32 samples [-1.0, 1.0] -> 16-bit PCM little-endian bytes.
// Clamp before scaling so out-of-range samples don't wrap around (a clip must
// saturate to the rail, not flip sign). Negatives scale by 32768, positives by
// 32767, so the full Int16 range maps symmetrically. DataView with the
// littleEndian flag makes byte order explicit rather than platform-dependent.
function micFloat32ToInt16LE(float32) {
  const out = new DataView(new ArrayBuffer(float32.length * 2));
  for (let i = 0; i < float32.length; i++) {
    let s = float32[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    const int16 = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    out.setInt16(i * 2, int16, true /* little-endian */);
  }
  return new Uint8Array(out.buffer);
}

// PLAY: Gemini 16-bit PCM little-endian bytes (24kHz) -> Float32 [-1.0, 1.0].
// Read each sample as signed Int16 LE, then divide by 32768 so the full
// negative rail (-32768) maps to exactly -1.0 and there is no overflow above
// +1.0. `byteLength >> 1` guards against a stray odd trailing byte.
function geminiInt16ToFloat32(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleCount = bytes.byteLength >> 1;
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    out[i] = view.getInt16(i * 2, true /* little-endian */) / 0x8000;
  }
  return out;
}

// --- base64 <-> bytes (Hermes provides global btoa/atob on RN 0.81) --------
// Chunked to avoid blowing the call stack on String.fromCharCode(...bigArray).
function bytesToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return global.btoa(binary);
}
function base64ToBytes(b64) {
  const binary = global.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function VoiceSpikeScreen({ navigation }) {
  const [status, setStatus] = useState('idle'); // idle|connecting|listening|speaking|error
  const [errorMsg, setErrorMsg] = useState('');
  const [heard, setHeard] = useState('');     // input transcription (what it heard me say)
  const [replied, setReplied] = useState(''); // output transcription (what it said back)

  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const playbackCtxRef = useRef(null);
  const playHeadRef = useRef(0); // scheduled end time, to queue chunks gaplessly

  const cleanup = useCallback(() => {
    try { recorderRef.current?.stop(); } catch (_) {}
    recorderRef.current = null;
    try { wsRef.current?.close(); } catch (_) {}
    wsRef.current = null;
    try { playbackCtxRef.current?.close(); } catch (_) {}
    playbackCtxRef.current = null;
    playHeadRef.current = 0;
  }, []);

  // Queue one decoded Float32 chunk for gapless playback: schedule each chunk
  // to start exactly where the previous one ends (or now, if we fell behind).
  const enqueuePlayback = useCallback((float32) => {
    const ctx = playbackCtxRef.current;
    if (!ctx || float32.length === 0) return;
    const buffer = ctx.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, playHeadRef.current);
    src.start(startAt);
    playHeadRef.current = startAt + buffer.duration;
  }, []);

  const handleServerMessage = useCallback((raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }

    // setupComplete -> Gemini is ready; start streaming the mic.
    if (msg.setupComplete) {
      startMic();
      setStatus('listening');
      return;
    }

    const sc = msg.serverContent;
    if (!sc) return;

    // Transcripts (debugging aid): what it heard vs. what it said.
    if (sc.inputTranscription?.text) {
      setHeard((prev) => prev + sc.inputTranscription.text);
    }
    if (sc.outputTranscription?.text) {
      setReplied((prev) => prev + sc.outputTranscription.text);
    }

    // Audio out: inlineData parts are base64 PCM16 @ 24kHz.
    const parts = sc.modelTurn?.parts || [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) {
        enqueuePlayback(geminiInt16ToFloat32(base64ToBytes(data)));
        setStatus('speaking');
      }
    }

    if (sc.turnComplete) {
      // A new turn begins fresh; reset transcripts so the display shows the
      // current exchange rather than an ever-growing wall of text.
      setStatus('listening');
      setHeard('');
      setReplied('');
    }
  }, [enqueuePlayback]);

  // --- mic capture -------------------------------------------------------
  // ANDROID NOTE (#809): react-native-audio-api had a bug where the recorder
  // emitted a blank "tone" instead of real audio on Expo 54 / RN 0.81. It was
  // fixed before 0.13.1 (we're on 0.13.1), but if Android capture sounds like
  // silence/tone during testing, CHECK THAT ISSUE FIRST before suspecting our
  // conversion or the socket. iOS was never affected.
  const startMic = useCallback(() => {
    const recorder = new AudioRecorder({
      sampleRate: MIC_SAMPLE_RATE,
      bufferLengthInSamples: MIC_BUFFER_SAMPLES,
    });
    recorderRef.current = recorder;
    // onAudioReady fires ~every 100ms with a Float32 buffer (mono). Convert to
    // Int16LE -> base64 and stream as realtimeInput audio.
    recorder.onAudioReady(({ buffer }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== 1) return;
      const float32 = buffer.getChannelData(0);
      const pcm = micFloat32ToInt16LE(float32);
      ws.send(JSON.stringify({
        realtimeInput: {
          audio: { data: bytesToBase64(pcm), mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}` },
        },
      }));
    });
    recorder.start();
  }, []);

  const start = useCallback(async () => {
    setStatus('connecting');
    setErrorMsg('');
    setHeard('');
    setReplied('');
    try {
      // iOS needs a play-and-record session for simultaneous mic + speaker.
      // Guarded: API surface varies by version, and it's non-fatal on Android.
      try {
        AudioManager.setAudioSessionOptions?.({
          iosCategory: 'playAndRecord',
          iosMode: 'voiceChat',
        });
      } catch (_) {}

      // 1) Mint an ephemeral token from our backend (never ships the API key).
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const { data, error } = await supabase.functions.invoke('mint-live-token');
      if (error || !data?.token) throw new Error(data?.error || 'Could not start voice session');

      // 2) Open the WebSocket directly to Gemini with the token.
      const ws = new WebSocket(`${LIVE_WS_BASE}?access_token=${encodeURIComponent(data.token)}`);
      wsRef.current = ws;

      // Prepare the playback context up front (24kHz mono).
      playbackCtxRef.current = new AudioContext({ sampleRate: PLAYBACK_SAMPLE_RATE });
      playHeadRef.current = 0;

      ws.onopen = () => {
        // 3) BidiGenerateContentSetup. model comes back from the mint call so
        // the client setup and the server-locked constraint stay in sync.
        // Transcription of both input and output is enabled for the debug view.
        ws.send(JSON.stringify({
          setup: {
            model: `models/${data.model}`,
            generationConfig: { responseModalities: ['AUDIO'] },
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        }));
      };
      ws.onmessage = (event) => {
        // Live API sends JSON text frames; base64 audio lives inside them.
        if (typeof event.data === 'string') handleServerMessage(event.data);
      };
      ws.onerror = () => {
        setStatus('error');
        setErrorMsg('Connection error');
        cleanup();
      };
      ws.onclose = (e) => {
        // Only surface an error if we didn't tap Stop ourselves.
        if (recorderRef.current || playbackCtxRef.current) {
          setStatus('error');
          setErrorMsg(`Socket closed${e?.code ? ` (${e.code})` : ''}`);
        }
        cleanup();
      };
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Failed to start');
      cleanup();
    }
  }, [cleanup, handleServerMessage, startMic]);

  const stop = useCallback(() => {
    cleanup();
    setStatus('idle');
  }, [cleanup]);

  const active = status !== 'idle' && status !== 'error';
  const statusLabel = {
    idle: 'Tap to start',
    connecting: 'Connecting…',
    listening: 'Listening…',
    speaking: 'Speaking…',
    error: 'Error',
  }[status];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Spike</Text>
      </View>

      <View style={styles.center}>
        <TouchableOpacity
          style={[styles.talkBtn, active && styles.talkBtnActive]}
          onPress={active ? stop : start}
        >
          {status === 'connecting' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.talkBtnText}>{active ? 'Stop' : 'Hold a convo'}</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.status}>{statusLabel}</Text>
        {status === 'error' ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      </View>

      {/* Debug transcript — not polish. Lets me see whether it MISHEARD me or
          RESPONDED badly without replaying audio. */}
      <ScrollView style={styles.transcript} contentContainerStyle={styles.transcriptContent}>
        <Text style={styles.tLabel}>You said</Text>
        <Text style={styles.tText}>{heard || '—'}</Text>
        <Text style={[styles.tLabel, styles.tLabelSpaced]}>Gemini said</Text>
        <Text style={styles.tText}>{replied || '—'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12071a' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16, marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  center: { alignItems: 'center', paddingVertical: 32 },
  talkBtn: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(123,45,142,0.55)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  talkBtnActive: { backgroundColor: 'rgba(200,60,90,0.65)' },
  talkBtnText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  status: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600', marginTop: 18 },
  errorText: { color: '#ff9d9d', fontSize: 13, marginTop: 8, paddingHorizontal: 24, textAlign: 'center' },
  transcript: {
    flex: 1, marginHorizontal: 20, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
  },
  transcriptContent: { padding: 16 },
  tLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  tLabelSpaced: { marginTop: 16 },
  tText: { color: '#fff', fontSize: 15, lineHeight: 21, marginTop: 4 },
});
