import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getLanguage, getLessons, getLessonRouteName } from '../content';
import { fetchProfile } from '../lib/profiles';
import Card from '../components/Card';
import SolidButton from '../components/SolidButton';
import LessonBadge from '../components/LessonBadge';
import {
  fetchLearningPlan, generateLearningPlan, regenCooldownRemaining,
} from '../lib/learningPlan';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

const formatCooldown = (ms) => {
  const mins = Math.ceil(ms / 60000);
  return mins <= 1 ? 'about a minute' : `about ${mins} minutes`;
};

export default function LearningPlanScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [languageCode, setLanguageCode] = useState('es-MX');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const language = getLanguage(languageCode);
  const lessonsById = {};
  getLessons(language.code).forEach((lesson) => { lessonsById[lesson.id] = lesson; });

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setLoading(false);
      return;
    }
    const { data: profileData } = await fetchProfile(userData.user.id);
    const activeLanguage = profileData?.active_language
      || userData.user.user_metadata?.language || 'es-MX';
    setLanguageCode(activeLanguage);

    const { data: planData } = await fetchLearningPlan(userData.user.id, activeLanguage);
    setPlan(planData);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRegenerate = async () => {
    const remaining = regenCooldownRemaining(plan);
    if (remaining > 0) {
      Alert.alert('Just a moment', `You can refresh your plan again in ${formatCooldown(remaining)}.`);
      return;
    }
    setRegenerating(true);
    const { plan: newPlan, error } = await generateLearningPlan();
    setRegenerating(false);
    if (error) {
      Alert.alert('Something went wrong', error);
      return;
    }
    if (newPlan) setPlan(newPlan);
  };

  const openLesson = (lessonId) => {
    const lesson = lessonsById[lessonId];
    if (!lesson) return;
    navigation.navigate(getLessonRouteName(lesson.lessonType), { lesson });
  };

  const planJson = plan?.plan_json;

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
        <TouchableOpacity style={styles.glassBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={colors.onGradient} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Plan</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={colors.accentCoral} />
        ) : !planJson ? (
          <Text style={styles.emptyText}>No plan yet — head back to Home to generate one.</Text>
        ) : (
          <>
            <Card style={styles.summaryCard}>
              <Text style={styles.summaryText}>{planJson.summary}</Text>
              <View style={styles.summaryMetaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="flag-outline" size={14} color={colors.accentCoral} style={styles.metaIcon} />
                  <Text style={styles.summaryMeta}>~{planJson.estimated_weeks} weeks</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={colors.accentCoral} style={styles.metaIcon} />
                  <Text style={styles.summaryMeta}>{planJson.weekly_minutes_target} min/week</Text>
                </View>
              </View>
            </Card>

            {(planJson.milestones || []).map((milestone, index) => (
              <Card key={`${milestone.week}-${index}`} style={styles.milestoneCard}>
                <View style={styles.weekBadge}>
                  <Text style={styles.weekBadgeText}>Week {milestone.week}</Text>
                </View>
                <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                <Text style={styles.milestoneFocus}>{milestone.focus}</Text>
                {(milestone.recommended_lessons || []).length > 0 && (
                  <View style={styles.chipRow}>
                    {milestone.recommended_lessons.map((lessonId) => {
                      const lesson = lessonsById[lessonId];
                      if (!lesson) return null;
                      return (
                        <TouchableOpacity key={lessonId} style={styles.chip} onPress={() => openLesson(lessonId)}>
                          <View style={styles.chipInner}>
                            <LessonBadge lessonId={lesson.id} size={18} style={styles.chipBadge} />
                            <Text style={styles.chipText}>{lesson.title}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </Card>
            ))}

            {planJson.notes ? (
              <Card style={styles.notesCard}>
                <View style={styles.notesRow}>
                  <Ionicons name="bulb-outline" size={16} color={colors.accentCoral} style={styles.notesIcon} />
                  <Text style={styles.notesText}>{planJson.notes}</Text>
                </View>
              </Card>
            ) : null}

            <SolidButton
              label={regenerating ? '' : 'Regenerate plan'}
              variant="secondary"
              onPress={handleRegenerate}
              disabled={regenerating}
            />
            {regenerating ? <ActivityIndicator color={colors.accentCoral} style={styles.regenSpinner} /> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius * 2, borderBottomRightRadius: radius * 2,
  },
  glassBtn: {
    width: 32, height: 32, borderRadius: 16, marginRight: 14,
    backgroundColor: colors.glassFill, borderColor: colors.glassBorder, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.onGradient, fontSize: fontSize.header, fontWeight: fontWeight.medium },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  summaryCard: { marginBottom: 16 },
  summaryText: { color: colors.text, fontSize: 16, fontWeight: fontWeight.medium, lineHeight: 23 },
  summaryMetaRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaIcon: { marginRight: 5 },
  summaryMeta: { color: colors.textMuted, fontSize: 13, fontWeight: fontWeight.medium },
  milestoneCard: { marginBottom: 14 },
  weekBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentCoralTint,
    borderColor: colors.accentCoral, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  weekBadgeText: { color: colors.accentCoral, fontSize: 12, fontWeight: fontWeight.medium },
  milestoneTitle: { color: colors.text, fontSize: 17, fontWeight: fontWeight.medium, marginBottom: 4 },
  milestoneFocus: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: colors.bg,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, paddingHorizontal: 12, paddingVertical: 8,
  },
  chipInner: { flexDirection: 'row', alignItems: 'center' },
  chipBadge: { marginRight: 6 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: fontWeight.medium },
  notesCard: { marginBottom: 16 },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start' },
  notesIcon: { marginRight: 8, marginTop: 1 },
  notesText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: fontWeight.regular, lineHeight: 20 },
  regenSpinner: { marginTop: 10 },
});
