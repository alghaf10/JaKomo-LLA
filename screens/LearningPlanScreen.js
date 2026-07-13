import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage, getLessons, getLessonRouteName } from '../content';
import { fetchProfile } from '../lib/profiles';
import GlassCard, { textShadow } from '../components/GlassCard';
import {
  fetchLearningPlan, generateLearningPlan, regenCooldownRemaining,
} from '../lib/learningPlan';

const formatCooldown = (ms) => {
  const mins = Math.ceil(ms / 60000);
  return mins <= 1 ? 'about a minute' : `about ${mins} minutes`;
};

export default function LearningPlanScreen({ navigation }) {
  const [languageCode, setLanguageCode] = useState('es-MX');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const language = getLanguage(languageCode);
  const backgrounds = getBackgrounds(language.code);
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
    <ImageBackground source={backgrounds.home} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Plan</Text>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : !planJson ? (
              <Text style={styles.emptyText}>No plan yet — head back to Home to generate one.</Text>
            ) : (
              <>
                <GlassCard style={styles.summaryCard}>
                  <Text style={styles.summaryText}>{planJson.summary}</Text>
                  <View style={styles.summaryMetaRow}>
                    <Text style={styles.summaryMeta}>🎯 ~{planJson.estimated_weeks} weeks</Text>
                    <Text style={styles.summaryMeta}>⏱ {planJson.weekly_minutes_target} min/week</Text>
                  </View>
                </GlassCard>

                {(planJson.milestones || []).map((milestone, index) => (
                  <GlassCard key={`${milestone.week}-${index}`} style={styles.milestoneCard}>
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
                            <TouchableOpacity
                              key={lessonId}
                              style={styles.chip}
                              onPress={() => openLesson(lessonId)}
                            >
                              <Text style={styles.chipText}>{lesson.emoji} {lesson.title}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </GlassCard>
                ))}

                {planJson.notes ? (
                  <GlassCard style={styles.notesCard}>
                    <Text style={styles.notesText}>💡 {planJson.notes}</Text>
                  </GlassCard>
                ) : null}

                <TouchableOpacity
                  style={styles.regenBtn}
                  onPress={handleRegenerate}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.regenBtnText}>Regenerate plan</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16, marginRight: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', ...textShadow },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  emptyText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  summaryCard: { padding: 18, marginBottom: 16 },
  summaryText: { color: '#fff', fontSize: 16, fontWeight: '600', lineHeight: 23 },
  summaryMetaRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  summaryMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  milestoneCard: { padding: 18, marginBottom: 14 },
  weekBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  weekBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  milestoneTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  milestoneFocus: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8,
  },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  notesCard: { padding: 16, marginBottom: 16 },
  notesText: { color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 20 },
  regenBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4,
  },
  regenBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
