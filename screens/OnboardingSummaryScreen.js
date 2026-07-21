import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import SolidButton from '../components/SolidButton';
import { useOnboarding } from '../contexts/OnboardingContext';
import { updateOnboarding, resolveAuthedRoute } from '../lib/profiles';
import { estimateWeeks, suggestNextTier } from '../lib/onboarding';
import { generateLearningPlan } from '../lib/learningPlan';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

const LEVEL_LABELS = {
  beginner: 'Complete beginner',
  some_words: 'Know some words & phrases',
  simple_conversations: 'Can have simple conversations',
};

const GOAL_LABELS = {
  trip: 'Trip to Mexico',
  family: 'Family or partner',
  work: 'For work',
  fun: 'Just for fun',
};

const goalLabel = (goal) => GOAL_LABELS[goal] || goal;

const formatDate = (dateString) => new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
  year: 'numeric', month: 'long', day: 'numeric',
});

export default function OnboardingSummaryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { levelEstimate, goal, goalDate, dailyMinutes } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const weeks = estimateWeeks(levelEstimate, dailyMinutes);

  let tightNote = null;
  if (goal === 'trip' && goalDate && weeks != null) {
    const estimateDate = new Date();
    estimateDate.setDate(estimateDate.getDate() + weeks * 7);
    if (estimateDate > new Date(`${goalDate}T00:00:00`)) {
      const nextTier = suggestNextTier(dailyMinutes);
      tightNote = nextTier
        ? `That's a tight timeline — consider bumping to ${nextTier} min/day to get there, or focus on travel essentials.`
        : "That's a tight timeline — focus on travel essentials to make the most of it.";
    }
  }

  const handleFinish = async () => {
    setError('');
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setSaving(false);
      setError('Something went wrong. Please try again.');
      return;
    }

    const { data, error: saveError } = await updateOnboarding(userData.user.id, {
      levelEstimate, goal, goalDate, dailyMinutes,
    });
    if (saveError) {
      console.log('Error saving onboarding:', saveError);
      setSaving(false);
      setError('Something went wrong. Please try again.');
      return;
    }

    setGenerating(true);
    const { error: planError } = await generateLearningPlan();
    if (planError) console.log('Plan generation failed (Home fallback will offer it):', planError);

    const nextRoute = resolveAuthedRoute(data);
    const rootNav = navigation.getParent() || navigation;
    rootNav.reset({ index: 0, routes: [{ name: nextRoute }] });
  };

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.title}>Here&apos;s your plan</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.recapCard}>
          <View style={styles.recapRow}>
            <Text style={styles.recapLabel}>Your level</Text>
            <Text style={styles.recapValue}>{LEVEL_LABELS[levelEstimate] || '—'}</Text>
          </View>
          <View style={[styles.recapRow, styles.recapRowDivider]}>
            <Text style={styles.recapLabel}>Learning for</Text>
            <Text style={styles.recapValue} numberOfLines={1}>{goalLabel(goal)}</Text>
          </View>
          {goal === 'trip' && goalDate && (
            <View style={[styles.recapRow, styles.recapRowDivider]}>
              <Text style={styles.recapLabel}>Trip date</Text>
              <Text style={styles.recapValue}>{formatDate(goalDate)}</Text>
            </View>
          )}
          <View style={[styles.recapRow, styles.recapRowDivider]}>
            <Text style={styles.recapLabel}>Daily practice</Text>
            <Text style={styles.recapValue}>{dailyMinutes === 20 ? '20+ min' : `${dailyMinutes} min`}</Text>
          </View>
        </Card>

        {weeks != null && (
          <Card style={styles.estimateCard}>
            <Ionicons name="flag-outline" size={32} color={colors.accentCoral} style={styles.estimateIcon} />
            <Text style={styles.estimateText}>
              At {dailyMinutes === 20 ? '20+' : dailyMinutes} min/day from your current level,
              expect to reach basic conversational comfort in ~{weeks} weeks.
            </Text>
          </Card>
        )}

        {tightNote && (
          <Card style={styles.noteCard}>
            <View style={styles.noteRow}>
              <Ionicons name="hourglass-outline" size={16} color={colors.accentCoral} style={styles.noteIcon} />
              <Text style={styles.noteText}>{tightNote}</Text>
            </View>
          </Card>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {generating ? (
        <View style={[styles.generatingRow, { paddingBottom: insets.bottom + spacing.lg }]}>
          <ActivityIndicator color={colors.accentCoral} />
          <Text style={styles.generatingText}>Building your personalized plan…</Text>
        </View>
      ) : (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <SolidButton
            label="Back"
            variant="secondary"
            onPress={() => navigation.goBack()}
            disabled={saving}
            style={styles.backBtn}
          />
          <SolidButton
            label={saving ? '' : "Looks good, let's go!"}
            onPress={handleFinish}
            disabled={saving}
            style={styles.nextBtn}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius * 2, borderBottomRightRadius: radius * 2,
  },
  title: { fontSize: 26, fontWeight: fontWeight.medium, color: colors.onGradient },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  recapCard: { marginBottom: 16 },
  recapRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12,
  },
  recapRowDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  recapLabel: { color: colors.textMuted, fontSize: 14, fontWeight: fontWeight.medium },
  recapValue: {
    color: colors.text, fontSize: 15, fontWeight: fontWeight.medium, flexShrink: 1, marginLeft: 12, textAlign: 'right',
  },
  estimateCard: { alignItems: 'center', paddingVertical: 20, marginBottom: 16 },
  estimateIcon: { marginBottom: 10 },
  estimateText: { color: colors.text, fontSize: 16, fontWeight: fontWeight.regular, textAlign: 'center', lineHeight: 23 },
  noteCard: { marginBottom: 16, backgroundColor: colors.accentCoralTint, borderColor: colors.accentCoral, borderWidth: 0.5 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start' },
  noteIcon: { marginRight: 8, marginTop: 1 },
  noteText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: fontWeight.regular, lineHeight: 20 },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: fontWeight.medium, textAlign: 'center' },
  generatingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingHorizontal: spacing.xl, paddingTop: spacing.sm,
  },
  generatingText: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  backBtn: { paddingHorizontal: 24 },
  nextBtn: { flex: 1 },
});
