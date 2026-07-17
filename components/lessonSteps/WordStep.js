import React from 'react';
import { Text } from 'react-native';
import GlassCard from '../GlassCard';
import { stepStyles as s, HearButton } from './common';

// Non-gradable: presents a vocabulary word with audio + optional note.
export default function WordStep({ step, language, speechRate }) {
  return (
    <>
      <Text style={s.wordPhrase}>{step.phrase}</Text>
      <Text style={s.translation}>{step.translation}</Text>
      <HearButton text={step.phrase} language={language} speechRate={speechRate} />
      {step.note ? (
        <GlassCard style={s.noteCard} overlayColor="rgba(0,0,0,0.25)">
          <Text style={s.noteText}>{step.note}</Text>
        </GlassCard>
      ) : null}
    </>
  );
}
