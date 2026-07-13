import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Platform,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import BACKGROUNDS from '../lib/backgrounds';
import GlassCard, { textShadow } from '../components/GlassCard';
import { useOnboarding } from '../contexts/OnboardingContext';

const GOALS = [
  { value: 'trip', title: 'Trip to Mexico coming up', emoji: '✈️' },
  { value: 'family', title: 'Talking with family or partner', emoji: '❤️' },
  { value: 'work', title: 'For work', emoji: '💼' },
  { value: 'fun', title: 'Just for fun', emoji: '🎉' },
  { value: 'other', title: 'Other', emoji: '✨' },
];

const PRESET_VALUES = ['trip', 'family', 'work', 'fun'];

const toDateString = (date) => date.toISOString().slice(0, 10); // YYYY-MM-DD
const formatDisplay = (dateString) => new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
  year: 'numeric', month: 'long', day: 'numeric',
});

export default function OnboardingGoalScreen({ navigation }) {
  const { goal, setGoal, goalDate, setGoalDate } = useOnboarding();
  // 'other' is a UI-only selection state; the stored goal is the typed text.
  const isPreset = PRESET_VALUES.includes(goal);
  const [otherSelected, setOtherSelected] = useState(goal != null && !isPreset);
  const [otherText, setOtherText] = useState(isPreset ? '' : (goal || ''));
  const [showPicker, setShowPicker] = useState(false);

  const selectPreset = (value) => {
    setOtherSelected(false);
    setGoal(value);
    if (value !== 'trip') setGoalDate(null); // date only meaningful for a trip
  };

  const selectOther = () => {
    setOtherSelected(true);
    setGoalDate(null);
    setGoal(otherText.trim() ? otherText.trim() : null);
  };

  const onOtherTextChange = (text) => {
    setOtherText(text);
    setGoal(text.trim() ? text.trim() : null);
  };

  const onDateChange = (event, selectedDate) => {
    // Android fires with type 'dismissed' on cancel; keep the picker closed
    // either way and only store an actually-picked date.
    setShowPicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      setGoalDate(toDateString(selectedDate));
    }
  };

  const isSelected = (value) => (value === 'other' ? otherSelected : goal === value);
  const canProceed = otherSelected ? Boolean(otherText.trim()) : Boolean(goal);

  const minimumDate = new Date();

  return (
    <ImageBackground source={BACKGROUNDS.languageSelect} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.stepLabel}>Step 2 of 3</Text>
            <Text style={styles.title}>Why are you learning?</Text>

            {GOALS.map((item) => {
              const selected = isSelected(item.value);
              return (
                <View key={item.value}>
                  <TouchableOpacity
                    onPress={() => (item.value === 'other' ? selectOther() : selectPreset(item.value))}
                  >
                    <GlassCard
                      style={styles.card}
                      overlayColor={selected ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}
                      borderColor={selected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)'}
                    >
                      <Text style={styles.cardEmoji}>{item.emoji}</Text>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      {selected && <Text style={styles.check}>✓</Text>}
                    </GlassCard>
                  </TouchableOpacity>

                  {/* Trip date picker, revealed under the Trip card */}
                  {item.value === 'trip' && selected && (
                    <View style={styles.revealWrap}>
                      <Text style={styles.revealLabel}>When's the trip? (optional)</Text>
                      <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
                        <Text style={styles.dateBtnText}>
                          {goalDate ? formatDisplay(goalDate) : 'Pick a date'}
                        </Text>
                      </TouchableOpacity>
                      {goalDate && (
                        <TouchableOpacity onPress={() => setGoalDate(null)}>
                          <Text style={styles.clearDateText}>Clear date</Text>
                        </TouchableOpacity>
                      )}
                      {showPicker && (
                        <DateTimePicker
                          value={goalDate ? new Date(`${goalDate}T00:00:00`) : minimumDate}
                          mode="date"
                          minimumDate={minimumDate}
                          onChange={onDateChange}
                        />
                      )}
                    </View>
                  )}

                  {/* Free-text input, revealed under Other */}
                  {item.value === 'other' && selected && (
                    <View style={styles.revealWrap}>
                      <TextInput
                        style={styles.otherInput}
                        placeholder="Tell us your reason"
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        value={otherText}
                        onChangeText={onOtherTextChange}
                        autoFocus
                        maxLength={100}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
              onPress={() => navigation.navigate('OnboardingMinutes')}
              disabled={!canProceed}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  stepLabel: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  title: {
    fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 28, lineHeight: 32, ...textShadow,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 18, marginBottom: 14,
  },
  cardEmoji: { fontSize: 22, marginRight: 14 },
  cardTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  check: { color: '#fff', fontSize: 20, fontWeight: '800', marginLeft: 12 },
  revealWrap: { marginTop: -4, marginBottom: 14, paddingHorizontal: 4 },
  revealLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  dateBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  dateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  clearDateText: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600',
    textAlign: 'center', marginTop: 8, textDecorationLine: 'underline',
  },
  otherInput: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, padding: 14, color: '#fff', fontSize: 15,
  },
  footer: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 14, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center',
  },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  nextBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, padding: 16, alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 16 },
});
