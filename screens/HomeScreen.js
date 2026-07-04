import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import orderingFoodLesson from '../content/orderingFood';

const LESSONS = [
  { id: 'ordering-food', title: 'Ordering Food', emoji: '🌮', locked: false, content: orderingFoodLesson },
  { id: 'getting-around', title: 'Getting Around', emoji: '🚕', locked: true },
  { id: 'at-the-market', title: 'At the Market', emoji: '🛒', locked: true },
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [progressByLessonId, setProgressByLessonId] = useState({});
  const [streakDays, setStreakDays] = useState(0);

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  useFocusEffect(
    useCallback(() => {
      const fetchProgress = async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

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

        const distinctDays = new Set(
          (data || []).map((row) => new Date(row.completed_at).toDateString()),
        );
        setStreakDays(distinctDays.size);
      };

      fetchProgress();
    }, []),
  );

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1518659526054-190340b17971?w=800' }}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <TouchableOpacity
            style={[styles.logoutBtn, { top: insets.top + 8 }]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutBtnText}>Log out</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Location pill */}
            <View style={styles.pill}>
              <Text style={styles.pillText}>📍 Oaxaca</Text>
            </View>

            {/* Greeting */}
            <Text style={styles.greeting}>Welcome back!</Text>
            <Text style={styles.subGreeting}>Ready for today's lesson?</Text>

            {/* Streak card */}
            <View style={styles.streakCard}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <View>
                <Text style={styles.streakValue}>{streakDays} day streak</Text>
                <Text style={styles.streakLabel}>Keep it going!</Text>
              </View>
            </View>

            {/* Lessons */}
            <Text style={styles.sectionTitle}>Your Lessons</Text>
            {LESSONS.map((lesson) => {
              const isCompleted = Boolean(lesson.content && progressByLessonId[lesson.content.id]);
              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={[styles.lessonCard, lesson.locked && styles.lessonCardLocked]}
                  disabled={lesson.locked}
                  onPress={() => navigation.navigate('Lesson', { lesson: lesson.content })}
                >
                  <Text style={styles.lessonEmoji}>{lesson.emoji}</Text>
                  <Text style={[styles.lessonTitle, lesson.locked && styles.lessonTitleLocked]}>
                    {lesson.title}
                  </Text>
                  {isCompleted && (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>✓</Text>
                    </View>
                  )}
                  {lesson.locked && <Text style={styles.lockIcon}>🔒</Text>}
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  logoutBtn: {
    position: 'absolute', right: 20, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8,
  },
  logoutBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  pill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginBottom: 22,
  },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  greeting: {
    fontSize: 30, fontWeight: '800', color: '#fff',
    letterSpacing: 0.5,
  },
  subGreeting: {
    color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 4, marginBottom: 24,
  },
  streakCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 16, padding: 16, marginBottom: 30,
  },
  streakEmoji: { fontSize: 32, marginRight: 14 },
  streakValue: { color: '#fff', fontSize: 17, fontWeight: '700' },
  streakLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  sectionTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14,
  },
  lessonCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 14,
  },
  lessonCardLocked: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  lessonEmoji: { fontSize: 26, marginRight: 14 },
  lessonTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  lessonTitleLocked: { color: 'rgba(255,255,255,0.5)' },
  lockIcon: { fontSize: 16, marginLeft: 8 },
  completedBadge: {
    width: 24, height: 24, borderRadius: 12, marginLeft: 8,
    backgroundColor: 'rgba(76,217,100,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  completedBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
