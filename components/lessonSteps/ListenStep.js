import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { playText } from '../../lib/lessonAudio';
import { stepStyles as s, HearButton } from './common';
import OptionsBlock from './OptionsBlock';

// Gradable: play audio (TTS of `phrase`), then pick its meaning from options.
// The phrase itself is NOT shown — the learner identifies it by ear.
export default function ListenStep({ step, language, speechRate, onResolve }) {
  // Auto-play once on mount so the prompt is heard immediately.
  useEffect(() => {
    playText(step.phrase, { language: language.speechLanguage, rate: speechRate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Text style={s.question}>{step.question || 'What did you hear?'}</Text>
      <HearButton text={step.phrase} language={language} speechRate={speechRate} label="Play again" />
      <OptionsBlock step={step} language={language} speechRate={speechRate} onResolve={onResolve} />
    </>
  );
}
