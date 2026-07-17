// Shared styling + helpers for lesson step components. These are built on the
// CURRENT dark/GlassCard look of LessonScreen; the lesson-screen restyle onto
// the new theme is its own UI-refresh wave. Keep visuals matching that screen.
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { playText } from '../../lib/lessonAudio';
import { colors } from '../../theme';

// The "Hear it" button — speaker icon + label.
export function HearButton({ text, language, speechRate, label = 'Hear it' }) {
  return (
    <TouchableOpacity
      style={stepStyles.hearBtn}
      onPress={() => playText(text, { language: language.speechLanguage, rate: speechRate })}
    >
      <View style={stepStyles.iconRow}>
        <Ionicons name="volume-high" size={16} color={colors.onGradient} style={stepStyles.iconLeft} />
        <Text style={stepStyles.hearBtnText}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Answer-state option/feedback tint helpers reused by quiz & listen.
export const OPTION_DEFAULT = { overlay: 'rgba(255,255,255,0.12)', border: 'rgba(255,255,255,0.3)' };
export const OPTION_CORRECT = { overlay: 'rgba(76,217,100,0.35)', border: 'rgba(76,217,100,0.8)' };
export const OPTION_WRONG = { overlay: 'rgba(255,59,48,0.35)', border: 'rgba(255,59,48,0.8)' };

export const stepStyles = StyleSheet.create({
  phrase: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 10 },
  wordPhrase: { fontSize: 44, fontWeight: '800', color: '#fff', marginBottom: 10 },
  translation: { fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 20 },
  hearBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 24,
  },
  hearBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  iconRow: { flexDirection: 'row', alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  iconLeft: { marginRight: 6 },
  cultureCard: { padding: 16 },
  cultureLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  cultureText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
  noteCard: { padding: 12 },
  noteText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  question: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 22 },
  option: { padding: 16, marginBottom: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { color: '#fff', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  speakerBtn: { marginLeft: 12, padding: 4 },
  speakerBtnText: { fontSize: 18 },
  feedbackCard: { padding: 16, marginTop: 8 },
  feedbackText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  // interactive (fill / build / speak / match)
  prompt: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  cue: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginBottom: 20 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 18, marginBottom: 16,
  },
  checkBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4,
  },
  checkBtnDisabled: { opacity: 0.5 },
  checkBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 15 },
  tileWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  tileText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  answerRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    minHeight: 52, padding: 8, marginBottom: 16,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  matchColumns: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  matchCol: { flex: 1, gap: 10 },
  matchItem: {
    padding: 14, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.12)',
  },
  matchItemSelected: { borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.25)' },
  matchItemDone: { borderColor: 'rgba(76,217,100,0.8)', backgroundColor: 'rgba(76,217,100,0.3)' },
  matchItemText: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
