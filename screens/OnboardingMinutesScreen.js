import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Card from '../components/Card';
import SolidButton from '../components/SolidButton';
import { useOnboarding } from '../contexts/OnboardingContext';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

const OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 20, label: '20+ min' },
];

export default function OnboardingMinutesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { dailyMinutes, setDailyMinutes } = useOnboarding();

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.stepLabel}>Step 3 of 3</Text>
        <Text style={styles.title}>How much time can you practice each day?</Text>
        <Text style={styles.subtitle}>Even 5 minutes a day builds real skill. No pressure!</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.pillsRow}>
          {OPTIONS.map((option) => {
            const selected = dailyMinutes === option.value;
            return (
              <TouchableOpacity key={option.value} onPress={() => setDailyMinutes(option.value)}>
                <Card style={[styles.pill, selected && styles.pillSelected]}>
                  <Text style={styles.pillText}>{option.label}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.accentCoral} style={styles.check} />}
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <SolidButton label="Back" variant="secondary" onPress={() => navigation.goBack()} style={styles.backBtn} />
        <SolidButton
          label="Next"
          onPress={() => navigation.navigate('OnboardingSummary')}
          disabled={!dailyMinutes}
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
  title: { fontSize: 24, fontWeight: fontWeight.medium, color: colors.onGradient, lineHeight: 30, marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 21 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  pillsRow: { gap: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  pillSelected: { borderColor: colors.accentCoral, borderWidth: 1, backgroundColor: colors.accentCoralTint },
  pillText: { color: colors.text, fontSize: 18, fontWeight: fontWeight.medium },
  check: { marginLeft: 10 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  backBtn: { paddingHorizontal: 24 },
  nextBtn: { flex: 1 },
});
