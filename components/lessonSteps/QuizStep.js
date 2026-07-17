import React from 'react';
import { Text } from 'react-native';
import { stepStyles as s } from './common';
import OptionsBlock from './OptionsBlock';

// Gradable: multiple-choice comprehension question.
export default function QuizStep({ step, language, speechRate, onResolve }) {
  return (
    <>
      <Text style={s.question}>{step.question}</Text>
      <OptionsBlock step={step} language={language} speechRate={speechRate} onResolve={onResolve} />
    </>
  );
}
