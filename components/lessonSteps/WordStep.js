import React from 'react';
import { View, Text } from 'react-native';
import { stepStyles as s, HearButton } from './common';

// Non-gradable: presents a vocabulary word with audio + optional note.
export default function WordStep({ step, language, speechRate }) {
  return (
    <>
      <Text style={s.wordPhrase}>{step.phrase}</Text>
      <Text style={s.translation}>{step.translation}</Text>
      <HearButton text={step.phrase} language={language} speechRate={speechRate} />
      {step.note ? (
        <View style={[s.card, s.noteCard]}>
          <Text style={s.noteText}>{step.note}</Text>
        </View>
      ) : null}
    </>
  );
}
