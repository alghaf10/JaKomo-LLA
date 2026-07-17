import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { setAudioModeAsync } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { textShadow } from '../components/GlassCard';
import { stopAudio } from '../lib/lessonAudio';
import { STEP_COMPONENTS, isGradable } from '../components/lessonSteps';
import { requestPermission, scheduleDailyReminder } from '../lib/notifications';
import { colors } from '../theme';

// Show the daily-reminder offer once, on the first-ever lesson completion.
const REMINDER_PROMPT_FLAG = 'reminderPromptSeen';
const REMINDER_HOUR = 19;

export default function LessonScreen({ navigation, route }) {
  const { lesson } = route.params;
  const steps = lesson.steps;
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
  const backgrounds = getBackgrounds(language.code);
  const backgroundSource = backgrounds.lessons?.[lesson.id] || backgrounds.home;

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
    <ImageBackground
      source={backgroundSource}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {!finished && (
            <View style={styles.header}>
              {stepIndex > 0 ? (
                <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                  <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.backBtnSpacer} />
              )}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((stepIndex + 1) / steps.length) * 100}%` }]} />
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={exitToHome}>
                <Ionicons name="close" size={18} color={colors.onGradient} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.pill}>
            <Ionicons name="location-outline" size={13} color={colors.onGradient} />
            <Text style={styles.pillText}>{lesson.location}</Text>
          </View>

          {finished ? (
            <View style={styles.completeContainer}>
              <Text style={styles.completeEmoji}>🎉</Text>
              <Text style={styles.completeTitle}>Lesson complete!</Text>
              <Text style={styles.completeSubtitle}>
                You got {gradableScore} out of {gradableTotal} right on the first try
              </Text>

              {showReminderCard && (
                <View style={styles.reminderCard}>
                  <Text style={styles.reminderTitle}>Keep the streak going?</Text>
                  <Text style={styles.reminderBody}>
                    We can send a friendly daily nudge so your five minutes of Spanish never slip.
                  </Text>
                  <TouchableOpacity style={styles.reminderAccept} onPress={acceptReminder}>
                    <Text style={styles.reminderAcceptText}>Remind me daily</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reminderDecline} onPress={dismissReminder}>
                    <Text style={styles.reminderDeclineText}>Not now</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.primaryBtn} onPress={exitToHome}>
                <Text style={styles.primaryBtnText}>Back to Home</Text>
              </TouchableOpacity>
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
                <Text style={styles.question}>Unsupported step type: {step.type}</Text>
              )}

              {canContinue && (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue}>
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
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
  pill: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginTop: 12, marginBottom: 4,
  },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 5, ...textShadow },
  progressTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginRight: 16,
  },
  progressFill: {
    height: '100%', backgroundColor: '#fff', borderRadius: 4,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtn: {
    width: 32, height: 32, borderRadius: 16, marginRight: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backBtnSpacer: { width: 32, marginRight: 16 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, flexGrow: 1 },
  phrase: {
    fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 10, ...textShadow,
  },
  wordPhrase: {
    fontSize: 44, fontWeight: '800', color: '#fff', marginBottom: 10, ...textShadow,
  },
  translation: {
    fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 20,
  },
  hearBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    marginBottom: 24,
  },
  hearBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cultureCard: {
    padding: 16,
  },
  cultureLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  cultureText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
  noteCard: {
    padding: 12,
  },
  noteText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  question: {
    fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 22,
  },
  option: {
    padding: 16, marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  optionText: { color: '#fff', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  speakerBtn: { marginLeft: 12, padding: 4 },
  speakerBtnText: { fontSize: 18 },
  feedbackCard: {
    padding: 16, marginTop: 8,
  },
  feedbackText: { color: '#fff', fontSize: 14, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 28,
  },
  primaryBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 16 },
  completeContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  completeEmoji: { fontSize: 64, marginBottom: 16 },
  completeTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 10 },
  completeSubtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 32,
  },
  reminderCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1,
    borderRadius: 14, padding: 18, marginBottom: 24,
  },
  reminderTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  reminderBody: {
    color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20,
    textAlign: 'center', marginBottom: 16,
  },
  reminderAccept: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  reminderAcceptText: { color: '#1a1a1a', fontWeight: '700', fontSize: 15 },
  reminderDecline: { padding: 12, alignItems: 'center', marginTop: 4 },
  reminderDeclineText: { color: 'rgba(255,255,255,0.75)', fontWeight: '600', fontSize: 14 },
});
