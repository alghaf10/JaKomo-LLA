// Shared styling + helpers for lesson step components — v3 LIGHT theme.
// Content sits on the warm off-white surface (#FAF7F2); options / note / culture
// / feedback are white cards. Supersedes the old dark GlassCard look.
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { playText } from '../../lib/lessonAudio';
import {
  colors, radius, fontSize, fontWeight,
} from '../../theme';

// The "Hear it" button — speaker icon + label, coral on a coral-tint pill.
export function HearButton({ text, language, speechRate, label = 'Hear it' }) {
  return (
    <TouchableOpacity
      style={stepStyles.hearBtn}
      onPress={() => playText(text, { language: language.speechLanguage, rate: speechRate })}
    >
      <View style={stepStyles.iconRow}>
        <Ionicons name="volume-high" size={16} color={colors.accentCoral} style={stepStyles.iconLeft} />
        <Text style={stepStyles.hearBtnText}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Answer-state tints (white default, warm success/danger) reused by quiz & listen.
export const OPTION_DEFAULT = { overlay: colors.card, border: colors.border };
export const OPTION_CORRECT = { overlay: colors.successTint, border: colors.success };
export const OPTION_WRONG = { overlay: colors.dangerTint, border: colors.danger };

export const stepStyles = StyleSheet.create({
  phrase: { fontSize: 26, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 10 },
  wordPhrase: { fontSize: 40, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 10 },
  translation: { fontSize: fontSize.body, color: colors.textMuted, marginBottom: 20 },
  hearBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentCoralTint,
    borderColor: colors.accentCoral, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 24,
  },
  hearBtnText: { color: colors.accentCoral, fontSize: 14, fontWeight: fontWeight.medium },
  iconRow: { flexDirection: 'row', alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  iconLeft: { marginRight: 6 },
  // White card base for options / note / culture / feedback surfaces.
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cultureCard: { padding: 16 },
  cultureLabel: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium, marginBottom: 8 },
  cultureText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  noteCard: { padding: 12 },
  noteText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  question: { fontSize: 20, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 22 },
  option: { padding: 16, marginBottom: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { color: colors.text, fontSize: fontSize.body, fontWeight: fontWeight.regular, flexShrink: 1 },
  speakerBtn: { marginLeft: 12, padding: 4 },
  feedbackCard: { padding: 16, marginTop: 8 },
  feedbackText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  // interactive (fill / build / speak / match)
  prompt: { fontSize: 18, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 8 },
  cue: { fontSize: 15, color: colors.textMuted, marginBottom: 20 },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 18, marginBottom: 16,
  },
  checkBtn: {
    backgroundColor: colors.accentCoral,
    borderRadius: radius, padding: 14, alignItems: 'center', marginTop: 4,
  },
  checkBtnDisabled: { opacity: 0.5 },
  checkBtnText: { color: colors.onGradient, fontWeight: fontWeight.medium, fontSize: 15 },
  tileWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 14, paddingVertical: 10,
  },
  tileText: { color: colors.text, fontSize: 16, fontWeight: fontWeight.medium },
  answerRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    minHeight: 52, padding: 8, marginBottom: 16,
    borderRadius: radius, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  matchColumns: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  matchCol: { flex: 1, gap: 10 },
  matchItem: {
    padding: 14, borderRadius: radius, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.card,
  },
  matchItemSelected: { borderColor: colors.accentCoral, backgroundColor: colors.accentCoralTint },
  matchItemDone: { borderColor: colors.success, backgroundColor: colors.successTint },
  matchItemText: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium, textAlign: 'center' },
});
