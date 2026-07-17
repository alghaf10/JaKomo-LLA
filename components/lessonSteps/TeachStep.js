import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../GlassCard';
import { colors } from '../../theme';
import { stepStyles as s, HearButton } from './common';

// Non-gradable: presents a full phrase with audio + a culture tip.
export default function TeachStep({ step, language, speechRate }) {
  return (
    <>
      <Text style={s.phrase}>{step.phrase}</Text>
      <Text style={s.translation}>{step.translation}</Text>
      <HearButton text={step.phrase} language={language} speechRate={speechRate} />
      <GlassCard style={s.cultureCard} overlayColor="rgba(0,0,0,0.25)">
        <View style={s.labelRow}>
          <Ionicons name="bulb-outline" size={15} color={colors.onGradient} style={s.iconLeft} />
          <Text style={s.cultureLabel}>Culture tip</Text>
        </View>
        <Text style={s.cultureText}>{step.culture}</Text>
      </GlassCard>
    </>
  );
}
