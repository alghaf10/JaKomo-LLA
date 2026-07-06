import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import { computeStreak, getMonthGrid, toDateKey } from '../lib/streak';
import GlassCard, { textShadow } from '../components/GlassCard';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

export default function StreakScreen({ navigation }) {
  const [language, setLanguage] = useState(getLanguage());
  const [activeDays, setActiveDays] = useState(new Set());
  const [streak, setStreak] = useState(0);
  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const backgrounds = getBackgrounds(language.code);

  useFocusEffect(
    useCallback(() => {
      const fetchActivity = async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        const { data: profileData } = await fetchProfile(userData.user.id);
        setLanguage(getLanguage(profileData?.active_language || userData.user.user_metadata?.language));

        const { data, error } = await supabase
          .from('lesson_progress')
          .select('completed_at')
          .eq('user_id', userData.user.id);

        if (error) {
          console.log('Error fetching streak activity:', error);
          return;
        }

        const dates = (data || []).map((row) => row.completed_at);
        setActiveDays(new Set(dates.map(toDateKey)));
        setStreak(computeStreak(dates));
      };

      fetchActivity();
    }, []),
  );

  const goToPrevMonth = () => {
    setViewedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setViewedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const weeks = getMonthGrid(viewedMonth);
  const todayKey = toDateKey(new Date());

  return (
    <ImageBackground source={backgrounds.home} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Streak</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <GlassCard style={styles.streakCard}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakLabel}>day streak</Text>
            </GlassCard>

            <GlassCard style={styles.calendarCard}>
              <View style={styles.monthRow}>
                <TouchableOpacity style={styles.monthNavBtn} onPress={goToPrevMonth}>
                  <Text style={styles.monthNavText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.monthLabel}>{MONTH_FORMATTER.format(viewedMonth)}</Text>
                <TouchableOpacity style={styles.monthNavBtn} onPress={goToNextMonth}>
                  <Text style={styles.monthNavText}>→</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((label, index) => (
                  <Text key={index} style={styles.weekdayLabel}>{label}</Text>
                ))}
              </View>

              {weeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.weekRow}>
                  {week.map((date, dayIndex) => {
                    if (!date) {
                      return <View key={dayIndex} style={styles.dayCell} />;
                    }
                    const dateKey = toDateKey(date);
                    const hasActivity = activeDays.has(dateKey);
                    const isToday = dateKey === todayKey;
                    return (
                      <View
                        key={dayIndex}
                        style={[styles.dayCell, isToday && styles.dayCellToday]}
                      >
                        <Text style={styles.dayNumber}>{date.getDate()}</Text>
                        {hasActivity && <View style={styles.activityDot} />}
                      </View>
                    );
                  })}
                </View>
              ))}
            </GlassCard>
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
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  streakCard: {
    alignItems: 'center', padding: 24, marginBottom: 16,
  },
  streakEmoji: { fontSize: 40, marginBottom: 4 },
  streakNumber: { color: '#fff', fontSize: 48, fontWeight: '800' },
  streakLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginTop: 2 },
  calendarCard: {
    padding: 18,
  },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  monthNavText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  monthLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  weekdayRow: {
    flexDirection: 'row', marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1, textAlign: 'center',
    color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row', marginBottom: 4,
  },
  dayCell: {
    flex: 1, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
  },
  dayCellToday: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)',
  },
  dayNumber: { color: '#fff', fontSize: 13, fontWeight: '600' },
  activityDot: {
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#F5A623', marginTop: 2,
  },
});
