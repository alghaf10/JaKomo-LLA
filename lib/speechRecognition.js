// Thin, swappable wrapper around on-device speech-to-text for the 'speak' step.
// Wraps jamsch/expo-speech-recognition's EVENT-based API into the single-utterance
// promise that SpeakStep expects. SpeakStep is unchanged by this swap.
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

// Sync availability check (matches how SpeakStep reads it at render time).
export function isSpeechRecognitionAvailable() {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch (_) {
    return false;
  }
}

// Run one utterance in `language` and resolve { transcript }. Requests
// mic + speech permission first. Rejects on denied/error/no-result/timeout;
// SpeakStep already catches and leaves the step unanswered.
export async function recognizeOnce({ language = 'es-MX' } = {}) {
  const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!perm.granted) throw new Error('SpeechRecognitionPermissionDenied');

  return new Promise((resolve, reject) => {
    let settled = false;
    let best = '';
    const subs = [];
    let timer;

    const cleanup = () => {
      subs.forEach((sub) => { try { sub.remove(); } catch (_) {} });
      clearTimeout(timer);
    };
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(arg);
    };

    subs.push(ExpoSpeechRecognitionModule.addListener('result', (e) => {
      const t = e?.results?.[0]?.transcript;
      if (typeof t === 'string' && t) best = t;
      if (e?.isFinal && best) finish(resolve, { transcript: best });
    }));
    subs.push(ExpoSpeechRecognitionModule.addListener('error', (e) => {
      finish(reject, new Error(e?.error || 'SpeechRecognitionError'));
    }));
    subs.push(ExpoSpeechRecognitionModule.addListener('end', () => {
      // Ended (silence/timeout on device) — accept the best interim if any.
      if (best) finish(resolve, { transcript: best });
      else finish(reject, new Error('SpeechRecognitionNoResult'));
    }));

    // Safety net in case no 'end' fires.
    timer = setTimeout(() => {
      try { ExpoSpeechRecognitionModule.stop(); } catch (_) {}
      if (best) finish(resolve, { transcript: best });
      else finish(reject, new Error('SpeechRecognitionTimeout'));
    }, 15000);

    try {
      ExpoSpeechRecognitionModule.start({ lang: language, continuous: false, interimResults: false });
    } catch (e) {
      finish(reject, e instanceof Error ? e : new Error('SpeechRecognitionStartFailed'));
    }
  });
}
