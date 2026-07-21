import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isAcceptable } from '../../lib/answerCheck';
import { isSpeechRecognitionAvailable, recognizeOnce } from '../../lib/speechRecognition';
import { colors } from '../../theme';
import { stepStyles as s, HearButton } from './common';
// Note: feedback uses the light themed card (s.card) — no GlassCard here.

// Gradable: say `phrase`; on-device STT transcribes; graded via fuzzy match.
// The STT provider sits behind lib/speechRecognition (stubbed until the native
// module lands) — when unavailable, a dev "simulate transcript" field stands in
// so the step is fully testable before the next EAS build.
export default function SpeakStep({ step, language, speechRate, onResolve }) {
  const available = isSpeechRecognitionAvailable();
  const [sim, setSim] = useState('');
  const [heard, setHeard] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);

  const resolve = (transcript) => {
    const ok = isAcceptable(transcript, step.phrase);
    setHeard(transcript);
    setCorrect(ok);
    setAnswered(true);
    onResolve(ok);
  };

  const handleMic = async () => {
    try {
      const { transcript } = await recognizeOnce({ language: language.speechLanguage });
      resolve(transcript);
    } catch (_) {
      // Unavailable/failed — leave unanswered so the dev fallback can be used.
    }
  };

  return (
    <>
      <Text style={s.prompt}>Say it out loud</Text>
      <Text style={s.cue}>{step.prompt || step.translation}</Text>
      <HearButton text={step.phrase} language={language} speechRate={speechRate} label="Hear it" />

      {available && !answered ? (
        <TouchableOpacity style={s.checkBtn} onPress={handleMic} disabled={answered}>
          <View style={s.iconRow}>
            <Ionicons name="mic" size={18} color={colors.onGradient} style={s.iconLeft} />
            <Text style={s.checkBtnText}>Tap to speak</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Simulate-transcript field: the fallback when STT is unavailable, AND a
          __DEV__ bypass so speaking can be tested on-device without the mic. */}
      {(__DEV__ || !available) && !answered ? (
        <>
          <Text style={s.cue}>
            {available ? 'Dev: simulate a transcript' : 'Speech recognition unavailable — simulate a transcript:'}
          </Text>
          <TextInput
            style={s.input}
            value={sim}
            onChangeText={setSim}
            placeholder="Type what you'd say"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[s.checkBtn, !sim.trim() && s.checkBtnDisabled]}
            onPress={() => sim.trim() && resolve(sim)}
            disabled={!sim.trim()}
          >
            <Text style={s.checkBtnText}>Submit</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {answered ? (
        <View style={[s.card, s.feedbackCard]}>
          <Text style={s.feedbackText}>
            {`Heard: "${heard}"\n`}
            {correct
              ? (step.feedbackCorrect || '¡Perfecto! That sounded great.')
              : (step.feedbackWrong || `Close — aim for "${step.phrase}".`)}
          </Text>
        </View>
      ) : (
        <View />
      )}
    </>
  );
}
