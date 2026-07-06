import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage, getLessons } from '../content';
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
  const lessons = getLessons(languageCode);
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
          <ScrollView contentContainerStyle={styles.scrollContent}>
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

            {/* Practice */}
            <TouchableOpacity
              disabled={dueCount === 0}
              onPress={() => navigation.navigate('Practice')}
            >
              <GlassCard
                style={styles.practiceCard}
                overlayColor={dueCount === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'}
                borderColor={dueCount === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.3)'}
              >
                <Text style={styles.practiceEmoji}>🧠</Text>
                <View style={styles.practiceTextContainer}>
                  <Text style={styles.practiceTitle}>Practice</Text>
                  <Text style={styles.practiceSubtitle}>
                    {dueCount > 0
                      ? `${dueCount} card${dueCount === 1 ? '' : 's'} due for review`
                      : 'No reviews due — come back tomorrow!'}
                  </Text>
                </View>
              </GlassCard>
            </TouchableOpacity>

            {/* Lessons */}
            <Text style={styles.sectionTitle}>Your Lessons</Text>
            {lessons.map((lesson) => {
              const isCompleted = Boolean(progressByLessonId[lesson.id]);
              return (
                <TouchableOpacity
                  key={lesson.id}
                  disabled={!lesson.unlocked}
                  onPress={() => navigation.navigate('Lesson', { lesson })}
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
  practiceCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, marginBottom: 30,
  },
  practiceEmoji: { fontSize: 32, marginRight: 14 },
  practiceTextContainer: { flex: 1 },
  practiceTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  practiceSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  sectionTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14, ...textShadow,
  },
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
