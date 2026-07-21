import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import { stopAudio } from '../lib/lessonAudio';
import { isSpeechRecognitionAvailable } from '../lib/speechRecognition';
import { STEP_COMPONENTS, isGradable } from '../components/lessonSteps';
import { requestPermission, scheduleDailyReminder } from '../lib/notifications';
import Card from '../components/Card';
import SolidButton from '../components/SolidButton';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

// Show the daily-reminder offer once, on the first-ever lesson completion.
const REMINDER_PROMPT_FLAG = 'reminderPromptSeen';
const REMINDER_HOUR = 19;

export default function LessonScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { lesson } = route.params;
  // Hide 'speak' steps in production when speech recognition is unavailable, so
  // learners aren't shown an exercise they can't complete. They're removed from
  // the flow AND from the gradable totals. In __DEV__ the simulate-field
  // fallback keeps them testable, so keep them.
  // TODO(stt-1.1): un-hide when the speech-recognition module returns.
  const steps = (!__DEV__ && !isSpeechRecognitionAvailable())
    ? lesson.steps.filter((s) => s.type !== 'speak')
    : lesson.steps;
  // Gradable = anything that yields right/wrong (quiz, listen, fill, build,
  // speak, match). Score columns stay named quiz_score/quiz_total but now
  // count all gradable steps.
  const gradableTotal = steps.filter(isGradable).length;

  const [language, setLanguage] = useState(getLanguage());
  const [speechRate, setSpeechRate] = useState(0.85);
  const [stepIndex, setStepIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [gradeResults, setGradeResults] = useState({});
  const [finished, setFinished] = useState(false);
  const [showReminderCard, setShowReminderCard] = useState(false);

  const step = steps[stepIndex];
  const gradableScore = Object.values(gradeResults).filter(Boolean).length;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
    return () => stopAudio();
  }, []);

  useEffect(() => {
    const fetchLanguage = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: profileData } = await fetchProfile(userData.user.id);
      const activeLanguage = profileData?.active_language
        || userData.user.user_metadata?.language;
      setLanguage(getLanguage(activeLanguage));
      setSpeechRate(userData.user.user_metadata?.speechRate ?? 0.85);
    };
    fetchLanguage();
  }, []);

  useEffect(() => {
    setAnswered(false);
  }, [stepIndex]);

  useEffect(() => {
    if (!finished) return;

    const saveProgress = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.log('Error fetching user for lesson progress:', userError);
        return;
      }
      const { error: progressError } = await supabase.from('lesson_progress').upsert(
        {
          user_id: userData.user.id,
          lesson_id: lesson.id,
          quiz_score: gradableScore,
          quiz_total: gradableTotal,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,lesson_id' },
      );
      if (progressError) console.log('Error saving lesson progress:', progressError);

      const teachSteps = steps.filter((s) => s.type === 'teach');
      const { error: reviewError } = await supabase.from('review_cards').upsert(
        teachSteps.map((s) => ({
          user_id: userData.user.id,
          lesson_id: lesson.id,
          language: language.code,
          phrase: s.phrase,
          translation: s.translation,
        })),
        { onConflict: 'user_id,phrase,language' },
      );
      if (reviewError) console.log('Error saving review cards:', reviewError);
    };

    saveProgress();
  }, [finished]);

  // Offer the daily reminder once, on the first-ever completion.
  useEffect(() => {
    if (!finished) return;
    AsyncStorage.getItem(REMINDER_PROMPT_FLAG).then((seen) => {
      if (!seen) setShowReminderCard(true);
    });
  }, [finished]);

  const dismissReminder = async () => {
    setShowReminderCard(false);
    await AsyncStorage.setItem(REMINDER_PROMPT_FLAG, '1');
  };

  const acceptReminder = async () => {
    setShowReminderCard(false);
    await AsyncStorage.setItem(REMINDER_PROMPT_FLAG, '1');
    const granted = await requestPermission();
    if (granted) await scheduleDailyReminder(REMINDER_HOUR);
  };

  const exitToHome = () => {
    stopAudio();
    navigation.popToTop();
  };

  // Called by a gradable step component when the learner commits an answer.
  // Records the first result only (revisits don't overwrite the score) and
  // unlocks Continue for the current step.
  const handleResolve = (isCorrect) => {
    setAnswered(true);
    setGradeResults((prev) => (
      prev[stepIndex] !== undefined ? prev : { ...prev, [stepIndex]: !!isCorrect }
    ));
  };

  const handleContinue = () => {
    stopAudio();
    if (stepIndex === steps.length - 1) {
      setFinished(true);
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    stopAudio();
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const canContinue = !isGradable(step) || answered;
  const StepComponent = step ? STEP_COMPONENTS[step.type] : null;

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
        {finished ? (
          <Text style={styles.headerTitle}>Lesson complete</Text>
        ) : (
          <View style={styles.headerRow}>
            {stepIndex > 0 ? (
              <TouchableOpacity style={styles.glassBtn} onPress={handleBack}>
                <Ionicons name="arrow-back" size={18} color={colors.onGradient} />
              </TouchableOpacity>
            ) : (
              <View style={styles.glassBtnSpacer} />
            )}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${((stepIndex + 1) / steps.length) * 100}%` }]} />
            </View>
            <TouchableOpacity style={styles.glassBtn} onPress={exitToHome}>
              <Ionicons name="close" size={18} color={colors.onGradient} />
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {finished ? (
        <View style={styles.completeContainer}>
          <Text style={styles.completeEmoji}>🎉</Text>
          <Text style={styles.completeTitle}>¡Bien hecho!</Text>
          <Text style={styles.completeSubtitle}>
            You got {gradableScore} out of {gradableTotal} right on the first try
          </Text>

          {showReminderCard && (
            <Card style={styles.reminderCard}>
              <Text style={styles.reminderTitle}>Keep the streak going?</Text>
              <Text style={styles.reminderBody}>
                We can send a friendly daily nudge so your five minutes of Spanish never slip.
              </Text>
              <SolidButton label="Remind me daily" onPress={acceptReminder} />
              <TouchableOpacity style={styles.reminderDecline} onPress={dismissReminder}>
                <Text style={styles.reminderDeclineText}>Not now</Text>
              </TouchableOpacity>
            </Card>
          )}

          <SolidButton label="Back to Home" onPress={exitToHome} style={styles.homeBtn} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {StepComponent ? (
            <StepComponent
              // Remount on step change so each step's local state resets.
              key={step.id || stepIndex}
              step={step}
              language={language}
              speechRate={speechRate}
              onResolve={handleResolve}
            />
          ) : (
            <Text style={styles.fallback}>Unsupported step type: {step.type}</Text>
          )}

          {canContinue && (
            <SolidButton label="Continue" onPress={handleContinue} style={styles.continueBtn} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius * 2,
    borderBottomRightRadius: radius * 2,
  },
  headerTitle: {
    color: colors.onGradient, fontSize: fontSize.header, fontWeight: fontWeight.medium,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  glassBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.glassFill,
    borderColor: colors.glassBorder, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  glassBtnSpacer: { width: 32 },
  progressTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden',
    marginHorizontal: spacing.lg,
  },
  progressFill: { height: '100%', backgroundColor: colors.onGradient, borderRadius: 4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  fallback: { fontSize: 20, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 22 },
  continueBtn: { marginTop: spacing.xl },
  completeContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl,
  },
  completeEmoji: { fontSize: 64, marginBottom: spacing.lg },
  completeTitle: { fontSize: 26, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 10 },
  completeSubtitle: {
    fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xxl,
  },
  reminderCard: { width: '100%', marginBottom: spacing.xl },
  reminderTitle: {
    color: colors.text, fontSize: 17, fontWeight: fontWeight.medium, marginBottom: 6, textAlign: 'center',
  },
  reminderBody: {
    color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: spacing.lg,
  },
  reminderDecline: { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  reminderDeclineText: { color: colors.textMuted, fontWeight: fontWeight.medium, fontSize: 14 },
  homeBtn: { alignSelf: 'stretch' },
});
