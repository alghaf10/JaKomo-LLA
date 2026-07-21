import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { playText } from '../../lib/lessonAudio';
import { colors } from '../../theme';
import {
  stepStyles as s, OPTION_DEFAULT, OPTION_CORRECT, OPTION_WRONG,
} from './common';

// Multiple-choice options with answer coloring + feedback. Shared by 'quiz'
// and 'listen'. Reports first-answer correctness via onResolve(boolean).
export default function OptionsBlock({ step, language, speechRate, onResolve }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answered, setAnswered] = useState(false);

  const handleAnswer = (index) => {
    if (answered) return;
    setSelectedIndex(index);
    setAnswered(true);
    onResolve(index === step.correctIndex);
  };

  return (
    <>
      {step.options.map((option, index) => {
        const isCorrect = index === step.correctIndex;
        const isSelected = index === selectedIndex;
        let tint = OPTION_DEFAULT;
        if (answered && isCorrect) tint = OPTION_CORRECT;
        else if (answered && isSelected) tint = OPTION_WRONG;

        return (
          <TouchableOpacity key={option} onPress={() => handleAnswer(index)} disabled={answered}>
            <View style={[s.card, s.option, { backgroundColor: tint.overlay, borderColor: tint.border }]}>
              <View style={s.optionRow}>
                <Text style={s.optionText}>{option}</Text>
                {answered && isCorrect && (
                  <TouchableOpacity
                    style={s.speakerBtn}
                    onPress={() => playText(option, { language: language.speechLanguage, rate: speechRate })}
                  >
                    <Ionicons name="volume-high" size={18} color={colors.accentCoral} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
      {answered && (
        <View style={[s.card, s.feedbackCard]}>
          <Text style={s.feedbackText}>
            {selectedIndex === step.correctIndex ? step.feedbackCorrect : step.feedbackWrong}
          </Text>
        </View>
      )}
    </>
  );
}
