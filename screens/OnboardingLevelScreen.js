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

const LEVELS = [
  { value: 'beginner', title: 'Complete beginner', subtitle: "Starting from scratch — that's great!" },
  { value: 'some_words', title: 'I know some words & phrases', subtitle: 'A few basics under your belt' },
  { value: 'simple_conversations', title: 'I can have simple conversations', subtitle: 'Ready to build real fluency' },
];

export default function OnboardingLevelScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { levelEstimate, setLevelEstimate } = useOnboarding();

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.stepLabel}>Step 1 of 3</Text>
        <Text style={styles.title}>How much Mexican Spanish do you know?</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {LEVELS.map((level) => {
          const selected = levelEstimate === level.value;
          return (
            <TouchableOpacity key={level.value} onPress={() => setLevelEstimate(level.value)}>
              <Card style={[styles.card, selected && styles.cardSelected]}>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle}>{level.title}</Text>
                  <Text style={styles.cardSubtitle}>{level.subtitle}</Text>
                </View>
                {selected && <Ionicons name="checkmark" size={22} color={colors.accentCoral} style={styles.check} />}
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <SolidButton
          label="Next"
          onPress={() => navigation.navigate('OnboardingGoal')}
          disabled={!levelEstimate}
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
  cardTextWrap: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: fontWeight.medium },
  cardSubtitle: { color: colors.textMuted, fontSize: 14, marginTop: 3 },
  check: { marginLeft: 12 },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
});
