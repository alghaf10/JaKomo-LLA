import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import GlassCard from '../GlassCard';
import { isAcceptable } from '../../lib/answerCheck';
import { stepStyles as s } from './common';

// Gradable: type the missing word into a sentence frame. `frame` contains a
// blank marker "___"; `answer` is the expected fill. Graded with the
// length-relative fuzzy match (accent/case/punct-insensitive).
export default function FillStep({ step, onResolve }) {
  const [value, setValue] = useState('');
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);

  const parts = String(step.frame || '').split('___');
  const blank = answered ? (correct ? value.trim() : step.answer) : '_____';

  const handleCheck = () => {
    if (answered || !value.trim()) return;
    const ok = isAcceptable(value, step.answer);
    setCorrect(ok);
    setAnswered(true);
    onResolve(ok);
  };

  return (
    <>
      {step.prompt ? <Text style={s.prompt}>{step.prompt}</Text> : null}
      <Text style={s.cue}>
        {parts[0]}
        <Text style={{ fontWeight: '800', color: '#fff' }}>{blank}</Text>
        {parts[1] || ''}
      </Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={setValue}
        editable={!answered}
        placeholder="Type your answer"
        placeholderTextColor="rgba(255,255,255,0.5)"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {answered ? (
        <GlassCard style={s.feedbackCard} overlayColor="rgba(0,0,0,0.25)">
          <Text style={s.feedbackText}>
            {correct
              ? (step.feedbackCorrect || '¡Correcto!')
              : (step.feedbackWrong || `Not quite — the answer is "${step.answer}".`)}
          </Text>
        </GlassCard>
      ) : (
        <TouchableOpacity
          style={[s.checkBtn, !value.trim() && s.checkBtnDisabled]}
          onPress={handleCheck}
          disabled={!value.trim()}
        >
          <Text style={s.checkBtnText}>Check</Text>
        </TouchableOpacity>
      )}
      <View />
    </>
  );
}
