import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import BACKGROUNDS from '../lib/backgrounds';
import GlassCard, { textShadow } from '../components/GlassCard';
import { useOnboarding } from '../contexts/OnboardingContext';
import { updateOnboarding, resolveAuthedRoute } from '../lib/profiles';
import { estimateWeeks, suggestNextTier } from '../lib/onboarding';
import { generateLearningPlan } from '../lib/learningPlan';

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
  const { levelEstimate, goal, goalDate, dailyMinutes } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const weeks = estimateWeeks(levelEstimate, dailyMinutes);

  // Tight-timeline note: only for a dated trip whose date arrives before the
  // estimate says they'd reach conversational comfort.
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

    // Kick off plan generation with its own visible state (the Gemini call
    // takes several seconds — make it feel intentional). Success or failure,
    // we still proceed: they're onboarded, and Home has a fallback to
    // generate the plan if this didn't land.
    setGenerating(true);
    const { error: planError } = await generateLearningPlan();
    if (planError) console.log('Plan generation failed (Home fallback will offer it):', planError);

    // Leave the onboarding subtree entirely (reset, so Back can't return
    // here) via the root navigator.
    const nextRoute = resolveAuthedRoute(data);
    const rootNav = navigation.getParent() || navigation;
    rootNav.reset({ index: 0, routes: [{ name: nextRoute }] });
  };

  return (
    <ImageBackground source={BACKGROUNDS.languageSelect} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>Here's your plan</Text>

            <GlassCard style={styles.recapCard}>
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
            </GlassCard>

            {weeks != null && (
              <GlassCard style={styles.estimateCard}>
                <Text style={styles.estimateEmoji}>🎯</Text>
                <Text style={styles.estimateText}>
                  At {dailyMinutes === 20 ? '20+' : dailyMinutes} min/day from your current level,
                  expect to reach basic conversational comfort in ~{weeks} weeks.
                </Text>
              </GlassCard>
            )}

            {tightNote && (
              <GlassCard
                style={styles.noteCard}
                overlayColor="rgba(255,196,0,0.18)"
                borderColor="rgba(255,196,0,0.6)"
              >
                <Text style={styles.noteText}>⏳ {tightNote}</Text>
              </GlassCard>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>

          {generating ? (
            <View style={styles.generatingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.generatingText}>Building your personalized plan…</Text>
            </View>
          ) : (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} disabled={saving}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={handleFinish} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#1a1a1a" />
                ) : (
                  <Text style={styles.nextBtnText}>Looks good, let's go!</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  title: {
    fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 24, ...textShadow,
  },
  recapCard: { padding: 18, marginBottom: 16 },
  recapRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  recapRowDivider: { borderTopColor: 'rgba(255,255,255,0.15)', borderTopWidth: 1 },
  recapLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  recapValue: { color: '#fff', fontSize: 15, fontWeight: '700', flexShrink: 1, marginLeft: 12, textAlign: 'right' },
  estimateCard: { padding: 20, marginBottom: 16, alignItems: 'center' },
  estimateEmoji: { fontSize: 32, marginBottom: 10 },
  estimateText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 23 },
  noteCard: { padding: 16, marginBottom: 16 },
  noteText: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  errorText: { color: '#ffb4b4', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  generatingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20,
  },
  generatingText: { color: '#fff', fontSize: 15, fontWeight: '600', ...textShadow },
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
  nextBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 16 },
});
