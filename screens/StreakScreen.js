import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import { computeStreak, getMonthGrid, toDateKey } from '../lib/streak';
import Card from '../components/Card';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

export default function StreakScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [, setLanguage] = useState(getLanguage());
  const [activeDays, setActiveDays] = useState(new Set());
  const [streak, setStreak] = useState(0);
  const [viewedMonth, setViewedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

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
        <Text style={styles.headerTitle}>Streak</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.streakCard}>
          <Ionicons name="flame" size={40} color={colors.accentCoral} style={styles.streakIcon} />
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakLabel}>day streak</Text>
        </Card>

        <Card style={styles.calendarCard}>
          <View style={styles.monthRow}>
            <TouchableOpacity style={styles.monthNavBtn} onPress={goToPrevMonth}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTH_FORMATTER.format(viewedMonth)}</Text>
            <TouchableOpacity style={styles.monthNavBtn} onPress={goToNextMonth}>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
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
                  <View key={dayIndex} style={[styles.dayCell, isToday && styles.dayCellToday]}>
                    <Text style={styles.dayNumber}>{date.getDate()}</Text>
                    {hasActivity && <View style={styles.activityDot} />}
                  </View>
                );
              })}
            </View>
          ))}
        </Card>
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
  streakCard: { alignItems: 'center', paddingVertical: 24, marginBottom: spacing.lg },
  streakIcon: { marginBottom: 4 },
  streakNumber: { color: colors.text, fontSize: 48, fontWeight: fontWeight.medium },
  streakLabel: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
  calendarCard: {},
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  monthNavBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  monthLabel: { color: colors.text, fontSize: 16, fontWeight: fontWeight.medium },
  weekdayRow: { flexDirection: 'row', marginBottom: 8 },
  weekdayLabel: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 12, fontWeight: fontWeight.medium },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayCell: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8,
  },
  dayCellToday: { borderWidth: 1, borderColor: colors.accentCoral },
  dayNumber: { color: colors.text, fontSize: 13, fontWeight: fontWeight.regular },
  activityDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accentCoral, marginTop: 2 },
});
