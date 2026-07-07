import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage, getLessons, getLessonRouteName } from '../content';
import { computeStreak } from '../lib/streak';
import { fetchProfile } from '../lib/profiles';
import { getAvatarSource } from '../lib/avatars';
import GlassCard, { textShadow } from '../components/GlassCard';

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [languageCode, setLanguageCode] = useState('es-MX');
  const [profile, setProfile] = useState(null);
  const [progressByLessonId, setProgressByLessonId] = useState({});
  const [streakDays, setStreakDays] = useState(0);
  const [dueCount, setDueCount] = useState(0);

  const language = getLanguage(languageCode);
  const allLessons = getLessons(languageCode);
  const lessons = allLessons.filter((lesson) => lesson.lessonType === 'scenario');
  const fundamentalsLessons = allLessons.filter(
    (lesson) => lesson.lessonType === 'numbers' || lesson.lessonType === 'letters',
  );
  const backgrounds = getBackgrounds(language.code);

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
      };

      fetchProgress();
    }, []),
  );

  return (
    <ImageBackground
      source={backgrounds.home}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <TouchableOpacity
            style={[styles.avatarBadge, { top: insets.top + 8 }]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Image source={getAvatarSource(profile?.avatar_id)} style={styles.avatarImage} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsBtn, { top: insets.top + 8 }]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.settingsBtnText}>⚙️</Text>
          </TouchableOpacity>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Location pill */}
            <View style={styles.pill}>
              <Text style={styles.pillText}>📍 Guanajuato</Text>
            </View>

            {/* Greeting */}
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>¡Hola, {profile?.first_name || 'amigo'}!</Text>
              <Text style={styles.greetingFlag}>{language.flag}</Text>
            </View>
            <Text style={styles.subGreeting}>Ready for today's lesson?</Text>

            {/* Streak pill */}
            <TouchableOpacity onPress={() => navigation.navigate('Streak')}>
              <GlassCard style={styles.streakPill}>
                <Text style={styles.streakPillEmoji}>🔥</Text>
                <Text style={styles.streakPillText}>{streakDays}</Text>
              </GlassCard>
            </TouchableOpacity>

            {/* Fundamentals */}
            <View style={styles.fundamentalsSection}>
              <Text style={styles.sectionTitle}>Fundamentals</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.fundamentalsRow}
              >
                <TouchableOpacity onPress={() => navigation.navigate('Practice')}>
                  <GlassCard style={styles.tile}>
                    <Text style={styles.tileEmoji}>🧠</Text>
                    <Text style={styles.tileLabel} numberOfLines={2}>Practice</Text>
                    {dueCount > 0 && (
                      <View style={styles.tileDueBadge}>
                        <Text style={styles.tileBadgeText}>{dueCount}</Text>
                      </View>
                    )}
                  </GlassCard>
                </TouchableOpacity>

                {fundamentalsLessons.map((lesson) => {
                  const isCompleted = Boolean(progressByLessonId[lesson.id]);
                  return (
                    <TouchableOpacity
                      key={lesson.id}
                      disabled={!lesson.unlocked}
                      onPress={() => navigation.navigate(getLessonRouteName(lesson.lessonType), { lesson })}
                    >
                      <GlassCard
                        style={styles.tile}
                        overlayColor={lesson.unlocked ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}
                        borderColor={lesson.unlocked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}
                      >
                        <Text style={styles.tileEmoji}>{lesson.emoji}</Text>
                        <Text
                          style={[styles.tileLabel, !lesson.unlocked && styles.lessonTitleLocked]}
                          numberOfLines={2}
                        >
                          {lesson.title}
                        </Text>
                        {isCompleted && (
                          <View style={styles.tileCompletedBadge}>
                            <Text style={styles.tileBadgeText}>✓</Text>
                          </View>
                        )}
                        {!lesson.unlocked && (
                          <View style={styles.tileLockBadge}>
                            <Text style={styles.tileBadgeText}>🔒</Text>
                          </View>
                        )}
                      </GlassCard>
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
                >
                  <GlassCard
                    style={styles.lessonCard}
                    overlayColor={lesson.unlocked ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}
                    borderColor={lesson.unlocked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}
                  >
                    <Text style={styles.lessonEmoji}>{lesson.emoji}</Text>
                    <View style={styles.lessonTextContainer}>
                      <Text style={[styles.lessonTitle, !lesson.unlocked && styles.lessonTitleLocked]}>
                        {lesson.title}
                      </Text>
                      {lesson.subtitle && (
                        <Text style={styles.lessonSubtitle}>{lesson.subtitle}</Text>
                      )}
                    </View>
                    {isCompleted && (
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>✓</Text>
                      </View>
                    )}
                    {!lesson.unlocked && <Text style={styles.lockIcon}>🔒</Text>}
                  </GlassCard>
                </TouchableOpacity>
              );
            })}
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
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  avatarBadge: {
    position: 'absolute', left: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  settingsBtn: {
    position: 'absolute', right: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsBtnText: { fontSize: 16 },
  pill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginBottom: 22,
  },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '600', ...textShadow },
  greetingRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  greeting: {
    fontSize: 30, fontWeight: '800', color: '#fff',
    letterSpacing: 0.5, ...textShadow,
  },
  greetingFlag: { fontSize: 20, marginLeft: 8, ...textShadow },
  subGreeting: {
    color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 4, marginBottom: 20, ...textShadow,
  },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 10, marginBottom: 24,
  },
  streakPillEmoji: { fontSize: 18, marginRight: 8 },
  streakPillText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14, ...textShadow,
  },
  fundamentalsSection: { marginBottom: 30 },
  fundamentalsRow: { flexDirection: 'row', paddingRight: 12 },
  tile: {
    width: 100, height: 100, marginRight: 12,
    alignItems: 'center', justifyContent: 'center', padding: 10,
  },
  tileEmoji: { fontSize: 28, marginBottom: 6 },
  tileLabel: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  tileDueBadge: {
    position: 'absolute', top: 8, right: 8,
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4,
    backgroundColor: 'rgba(255,90,90,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  tileCompletedBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(76,217,100,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  tileLockBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  tileBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  lessonCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, marginBottom: 14,
  },
  lessonEmoji: { fontSize: 26, marginRight: 14 },
  lessonTextContainer: { flex: 1 },
  lessonTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  lessonTitleLocked: { color: 'rgba(255,255,255,0.5)' },
  lessonSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  lockIcon: { fontSize: 16, marginLeft: 8 },
  completedBadge: {
    width: 24, height: 24, borderRadius: 12, marginLeft: 8,
    backgroundColor: 'rgba(76,217,100,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  completedBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
