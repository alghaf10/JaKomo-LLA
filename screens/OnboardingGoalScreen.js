import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Platform, StyleSheet, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import Card from '../components/Card';
import SolidButton from '../components/SolidButton';
import { useOnboarding } from '../contexts/OnboardingContext';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

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
  const insets = useSafeAreaInsets();
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
    setShowPicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      setGoalDate(toDateString(selectedDate));
    }
  };

  const isSelected = (value) => (value === 'other' ? otherSelected : goal === value);
  const canProceed = otherSelected ? Boolean(otherText.trim()) : Boolean(goal);

  const minimumDate = new Date();

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.stepLabel}>Step 2 of 3</Text>
        <Text style={styles.title}>Why are you learning?</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {GOALS.map((item) => {
          const selected = isSelected(item.value);
          return (
            <View key={item.value}>
              <TouchableOpacity
                onPress={() => (item.value === 'other' ? selectOther() : selectPreset(item.value))}
              >
                <Card style={[styles.card, selected && styles.cardSelected]}>
                  {/* Goal-choice emoji kept — content. */}
                  <Text style={styles.cardEmoji}>{item.emoji}</Text>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {selected && <Ionicons name="checkmark" size={20} color={colors.accentCoral} style={styles.check} />}
                </Card>
              </TouchableOpacity>

              {/* Trip date picker, revealed under the Trip card */}
              {item.value === 'trip' && selected && (
                <View style={styles.revealWrap}>
                  <Text style={styles.revealLabel}>When&apos;s the trip? (optional)</Text>
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
                    placeholderTextColor={colors.textMuted}
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

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <SolidButton label="Back" variant="secondary" onPress={() => navigation.goBack()} style={styles.backBtn} />
        <SolidButton
          label="Next"
          onPress={() => navigation.navigate('OnboardingMinutes')}
          disabled={!canProceed}
          style={styles.nextBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius * 2, borderBottomRightRadius: radius * 2,
  },
  stepLabel: {
    color: 'rgba(255,255,255,0.85)', fontSize: fontSize.caption, fontWeight: fontWeight.medium,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: fontWeight.medium, color: colors.onGradient, lineHeight: 30 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardSelected: { borderColor: colors.accentCoral, borderWidth: 1, backgroundColor: colors.accentCoralTint },
  cardEmoji: { fontSize: 22, marginRight: 14 },
  cardTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: fontWeight.medium },
  check: { marginLeft: 12 },
  revealWrap: { marginTop: -4, marginBottom: 14, paddingHorizontal: 4 },
  revealLabel: { color: colors.textMuted, fontSize: 14, fontWeight: fontWeight.medium, marginBottom: 8 },
  dateBtn: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, padding: 14, alignItems: 'center',
  },
  dateBtnText: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  clearDateText: {
    color: colors.accentCoral, fontSize: 13, fontWeight: fontWeight.medium,
    textAlign: 'center', marginTop: 8,
  },
  otherInput: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, padding: 14, color: colors.text, fontSize: 15,
  },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  backBtn: { paddingHorizontal: 24 },
  nextBtn: { flex: 1 },
});
