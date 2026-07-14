import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Alert, ActivityIndicator,
  StyleSheet, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getLanguage, getLessons, getLessonRouteName } from '../content';
import { computeStreak } from '../lib/streak';
import { fetchProfile } from '../lib/profiles';
import { getAvatarSource } from '../lib/avatars';
import { fetchLearningPlan, generateLearningPlan, shouldOfferRegeneration } from '../lib/learningPlan';
import GradientHeader from '../components/GradientHeader';
import Card from '../components/Card';
import { colors, spacing, radius, fontSize, fontWeight } from '../theme';

export default function HomeScreen({ navigation }) {
  const [languageCode, setLanguageCode] = useState('es-MX');
  const [profile, setProfile] = useState(null);
  const [progressByLessonId, setProgressByLessonId] = useState({});
  const [streakDays, setStreakDays] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [plan, setPlan] = useState(null);
  const [planRegenHint, setPlanRegenHint] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const language = getLanguage(languageCode);
  const allLessons = getLessons(languageCode);
  const lessons = allLessons.filter((lesson) => lesson.lessonType === 'scenario');
  const fundamentalsLessons = allLessons.filter(
    (lesson) => lesson.lessonType === 'numbers' || lesson.lessonType === 'letters',
  );

  useFocusEffect(
    useCallback(() => {
      const fetchProgress = async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        const { data: profileData } = await fetchProfile(userData.user.id);
        setProfile(profileData);

        const activeLanguage = profileData?.active_language
          || userData.user.user_metadata?.language
          || 'es-MX';
        setLanguageCode(activeLanguage);

        const { data, error } = await supabase
          .from('lesson_progress')
          .select('lesson_id, completed_at')
          .eq('user_id', userData.user.id);

        if (error) {
          console.log('Error fetching lesson progress:', error);
          return;
        }

        const byLessonId = {};
        (data || []).forEach((row) => { byLessonId[row.lesson_id] = row; });
        setProgressByLessonId(byLessonId);

        setStreakDays(computeStreak((data || []).map((row) => row.completed_at)));

        const { count, error: dueError } = await supabase
          .from('review_cards')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userData.user.id)
          .eq('language', activeLanguage)
          .lte('due_at', new Date().toISOString());

        if (dueError) {
          console.log('Error fetching due review cards:', dueError);
          return;
        }
        setDueCount(count || 0);

        const { data: planData } = await fetchLearningPlan(userData.user.id, activeLanguage);
        setPlan(planData);
        setPlanRegenHint(shouldOfferRegeneration(planData, profileData));
      };

      fetchProgress();
    }, []),
  );

  const handleGeneratePlan = async () => {
    if (generatingPlan) return;
    setGeneratingPlan(true);
    const { plan: newPlan, error } = await generateLearningPlan();
    setGeneratingPlan(false);
    if (error) {
      Alert.alert('Something went wrong', error);
      return;
    }
    if (newPlan) {
      setPlan(newPlan);
      setPlanRegenHint(false);
    }
  };

  const nextMilestone = plan?.plan_json?.milestones?.[0] || null;

  return (
    <View style={styles.screen}>
      <GradientHeader
        title={`¡Hola, ${profile?.first_name || 'amigo'}! ${language.flag}`}
        subtitle="Ready for today's lesson?"
        right={(
          <TouchableOpacity style={styles.avatarBadge} onPress={() => navigation.navigate('ProfileTab')}>
            <Image source={getAvatarSource(profile?.avatar_id)} style={styles.avatarImage} />
          </TouchableOpacity>
        )}
      >
        <View style={styles.locationPill}>
          <Ionicons name="location-outline" size={14} color={colors.onGradient} />
          <Text style={styles.locationText}>Guanajuato</Text>
        </View>
      </GradientHeader>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Streak */}
        <TouchableOpacity onPress={() => navigation.navigate('Streak')} activeOpacity={0.8}>
          <Card style={styles.streakCard}>
            <Ionicons name="flame" size={20} color={colors.accentCoral} />
            <Text style={styles.streakText}>{streakDays}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </Card>
        </TouchableOpacity>

        {/* TODO: remove after Phase 3a spike — temporary dev entry point */}
        <TouchableOpacity
          style={styles.devSpikeBtn}
          onPress={() => navigation.navigate('VoiceSpike')}
          activeOpacity={0.8}
        >
          <Ionicons name="mic-outline" size={16} color={colors.accentCoral} />
          <Text style={styles.devSpikeText}>Voice spike (dev)</Text>
        </TouchableOpacity>

        {/* Learning plan */}
        {plan?.plan_json ? (
          <TouchableOpacity onPress={() => navigation.navigate('LearningPlan')} activeOpacity={0.8}>
            <Card style={styles.planCard}>
              <View style={styles.planHeaderRow}>
                <Text style={styles.planLabel}>Your plan</Text>
                {planRegenHint && (
                  <View style={styles.planHintBadge}>
                    <Text style={styles.planHintText}>Your goals changed — refresh</Text>
                  </View>
                )}
              </View>
              <Text style={styles.planSummary} numberOfLines={2}>{plan.plan_json.summary}</Text>
              {nextMilestone && (
                <Text style={styles.planMilestone} numberOfLines={1}>
                  Next: Week {nextMilestone.week} · {nextMilestone.title}
                </Text>
              )}
            </Card>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleGeneratePlan} disabled={generatingPlan} activeOpacity={0.8}>
            <Card style={styles.planCard}>
              {generatingPlan ? (
                <View style={styles.planGeneratingRow}>
                  <ActivityIndicator color={colors.accentCoral} />
                  <Text style={styles.planGeneratingText}>Building your personalized plan…</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.planLabel}>Your plan</Text>
                  <Text style={styles.planGenerate}>Generate your personalized learning plan</Text>
                </>
              )}
            </Card>
          </TouchableOpacity>
        )}

        {/* Fundamentals */}
        <View style={styles.fundamentalsSection}>
          <Text style={styles.sectionTitle}>Fundamentals</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fundamentalsRow}
          >
            <TouchableOpacity onPress={() => navigation.navigate('PracticeTab')} activeOpacity={0.8}>
              <Card style={styles.tile}>
                <MaterialCommunityIcons name="cards-outline" size={28} color={colors.accentCoral} />
                <Text style={styles.tileLabel} numberOfLines={2}>Practice</Text>
                {dueCount > 0 && (
                  <View style={styles.tileDueBadge}>
                    <Text style={styles.tileBadgeText}>{dueCount}</Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>

            {fundamentalsLessons.map((lesson) => {
              const isCompleted = Boolean(progressByLessonId[lesson.id]);
              return (
                <TouchableOpacity
                  key={lesson.id}
                  disabled={!lesson.unlocked}
                  onPress={() => navigation.navigate(getLessonRouteName(lesson.lessonType), { lesson })}
                  activeOpacity={0.8}
                >
                  <Card style={[styles.tile, !lesson.unlocked && styles.tileLocked]}>
                    {/* lesson.emoji is CONTENT — kept as emoji on purpose. */}
                    <Text style={styles.tileEmoji}>{lesson.emoji}</Text>
                    <Text
                      style={[styles.tileLabel, !lesson.unlocked && styles.textLocked]}
                      numberOfLines={2}
                    >
                      {lesson.title}
                    </Text>
                    {isCompleted && (
                      <View style={styles.tileCompletedBadge}>
                        <Ionicons name="checkmark" size={13} color={colors.onGradient} />
                      </View>
                    )}
                    {!lesson.unlocked && (
                      <View style={styles.tileLockBadge}>
                        <Ionicons name="lock-closed" size={12} color={colors.onGradient} />
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Lessons */}
        <Text style={styles.sectionTitle}>Your Lessons</Text>
        {lessons.map((lesson) => {
          const isCompleted = Boolean(progressByLessonId[lesson.id]);
          return (
            <TouchableOpacity
              key={lesson.id}
              disabled={!lesson.unlocked}
              onPress={() => navigation.navigate(getLessonRouteName(lesson.lessonType), { lesson })}
              activeOpacity={0.8}
            >
              <Card style={[styles.lessonCard, !lesson.unlocked && styles.tileLocked]}>
                {/* lesson.emoji is CONTENT — kept as emoji on purpose. */}
                <Text style={styles.lessonEmoji}>{lesson.emoji}</Text>
                <View style={styles.lessonTextContainer}>
                  <Text style={[styles.lessonTitle, !lesson.unlocked && styles.textLocked]}>
                    {lesson.title}
                  </Text>
                  {lesson.subtitle && (
                    <Text style={styles.lessonSubtitle}>{lesson.subtitle}</Text>
                  )}
                </View>
                {isCompleted && (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark" size={15} color={colors.onGradient} />
                  </View>
                )}
                {!lesson.unlocked && (
                  <Ionicons name="lock-closed" size={16} color={colors.textMuted} style={styles.lockIcon} />
                )}
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  avatarBadge: {
    width: 40, height: 40, borderRadius: 20,
    borderColor: colors.glassBorder, borderWidth: 0.5,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: colors.glassFill,
    borderColor: colors.glassBorder, borderWidth: 0.5,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: radius, marginTop: spacing.lg,
  },
  locationText: {
    color: colors.onGradient, fontSize: fontSize.caption,
    fontWeight: fontWeight.medium, marginLeft: spacing.xs + 2,
  },
  streakCard: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingVertical: spacing.md, marginBottom: spacing.lg,
  },
  streakText: {
    color: colors.text, fontSize: fontSize.header, fontWeight: fontWeight.medium,
    marginLeft: spacing.sm,
  },
  streakLabel: {
    color: colors.textMuted, fontSize: fontSize.caption, fontWeight: fontWeight.regular,
    marginLeft: spacing.sm,
  },
  devSpikeBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  devSpikeText: {
    color: colors.accentCoral, fontSize: fontSize.caption, fontWeight: fontWeight.medium,
    marginLeft: spacing.xs + 2,
  },
  sectionTitle: {
    color: colors.text, fontSize: fontSize.header, fontWeight: fontWeight.medium,
    marginBottom: spacing.md,
  },
  fundamentalsSection: { marginTop: spacing.sm, marginBottom: spacing.xl },
  fundamentalsRow: { flexDirection: 'row', paddingRight: spacing.md },
  tile: {
    width: 104, height: 104, marginRight: spacing.md,
    alignItems: 'center', justifyContent: 'center',
  },
  tileLocked: { opacity: 0.55 },
  tileEmoji: { fontSize: 28, marginBottom: spacing.xs + 2 },
  tileLabel: {
    color: colors.text, fontSize: fontSize.caption, fontWeight: fontWeight.medium,
    textAlign: 'center', marginTop: spacing.xs + 2,
  },
  textLocked: { color: colors.textMuted },
  tileDueBadge: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4,
    backgroundColor: colors.accentCoral,
    alignItems: 'center', justifyContent: 'center',
  },
  tileCompletedBadge: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.accentPink,
    alignItems: 'center', justifyContent: 'center',
  },
  tileLockBadge: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  tileBadgeText: { color: colors.onGradient, fontSize: 11, fontWeight: fontWeight.medium },
  lessonCard: {
    flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md,
  },
  lessonEmoji: { fontSize: 26, marginRight: spacing.lg },
  lessonTextContainer: { flex: 1 },
  lessonTitle: { color: colors.text, fontSize: fontSize.body, fontWeight: fontWeight.medium },
  lessonSubtitle: {
    color: colors.textMuted, fontSize: fontSize.caption,
    fontWeight: fontWeight.regular, marginTop: 2,
  },
  lockIcon: { marginLeft: spacing.sm },
  completedBadge: {
    width: 24, height: 24, borderRadius: 12, marginLeft: spacing.sm,
    backgroundColor: colors.accentPink,
    alignItems: 'center', justifyContent: 'center',
  },
  planCard: { marginBottom: spacing.xl },
  planHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  planLabel: {
    color: colors.textMuted, fontSize: fontSize.caption, fontWeight: fontWeight.medium,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  planHintBadge: {
    backgroundColor: colors.accentCoralTint,
    borderColor: colors.accentCoral, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  planHintText: { color: colors.accentCoral, fontSize: 11, fontWeight: fontWeight.medium },
  planSummary: {
    color: colors.text, fontSize: fontSize.body, fontWeight: fontWeight.medium, lineHeight: 21,
  },
  planGenerate: {
    color: colors.accentCoral, fontSize: fontSize.body, fontWeight: fontWeight.medium, lineHeight: 21,
  },
  planMilestone: {
    color: colors.textMuted, fontSize: fontSize.caption, fontWeight: fontWeight.regular,
    marginTop: spacing.sm,
  },
  planGeneratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planGeneratingText: { color: colors.text, fontSize: fontSize.body, fontWeight: fontWeight.regular },
});
