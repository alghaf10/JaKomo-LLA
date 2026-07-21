import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import Card from '../components/Card';
import SolidButton from '../components/SolidButton';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

// Speaker icon + label row for the "Hear it" / "Listen again" buttons.
const HearLabel = ({ label }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <Ionicons name="volume-high" size={16} color={colors.accentCoral} style={{ marginRight: 6 }} />
    <Text style={styles.hearBtnText}>{label}</Text>
  </View>
);

const speak = (text, speechLanguage, rate) => {
  Speech.stop();
  Speech.speak(text, { language: speechLanguage, rate });
};

const isOptionCorrect = (step, index) => (
  step.type === 'listen-pick'
    ? step.options[index] === step.correctNumber
    : index === step.correctIndex
);

// White option card by default; warm success/danger tints once answered.
const optionTint = (answered, isCorrect, isSelected) => {
  if (answered && isCorrect) return { bg: colors.successTint, border: colors.success };
  if (answered && isSelected) return { bg: colors.dangerTint, border: colors.danger };
  return { bg: colors.card, border: colors.border };
};

export default function NumbersLessonScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { lesson } = route.params;
  const steps = lesson.steps;
  const quizCount = steps.filter((s) => s.type === 'quiz').length;

  const [language, setLanguage] = useState(getLanguage());
  const [speechRate, setSpeechRate] = useState(0.85);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [quizResults, setQuizResults] = useState({});
  const [finished, setFinished] = useState(false);

  const step = steps[stepIndex];
  const quizScore = Object.values(quizResults).filter(Boolean).length;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
    return () => Speech.stop();
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
    setSelectedIndex(null);
    setAnswered(false);
  }, [stepIndex]);

  useEffect(() => {
    if (step?.type === 'listen-pick') {
      speak(step.audioText, language.speechLanguage, speechRate);
    } else if (step?.type === 'quiz' && step.quizVariant === 'hearWordPickNumeral') {
      speak(step.word, language.speechLanguage, speechRate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          quiz_score: quizScore,
          quiz_total: quizCount,
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
          phrase: s.word,
          translation: String(s.number),
        })),
        { onConflict: 'user_id,phrase,language' },
      );
      if (reviewError) console.log('Error saving review cards:', reviewError);
    };

    saveProgress();
  }, [finished]);

  const exitToHome = () => {
    Speech.stop();
    navigation.popToTop();
  };

  const handleAnswer = (index) => {
    if (answered) return;
    setSelectedIndex(index);
    setAnswered(true);
    if (step.type === 'quiz') {
      const isCorrect = index === step.correctIndex;
      setQuizResults((prev) => (
        prev[stepIndex] !== undefined ? prev : { ...prev, [stepIndex]: isCorrect }
      ));
    }
  };

  const handleContinue = () => {
    Speech.stop();
    if (stepIndex === steps.length - 1) {
      setFinished(true);
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    Speech.stop();
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const canContinue = step?.type === 'teach' || answered;

  const renderNumeralGrid = () => (
    <View style={styles.numeralGrid}>
      {step.options.map((optionValue, index) => {
        const tint = optionTint(answered, isOptionCorrect(step, index), index === selectedIndex);
        return (
          <TouchableOpacity
            key={index}
            style={styles.numeralCell}
            onPress={() => handleAnswer(index)}
            disabled={answered}
          >
            <View style={[styles.numeralCard, { backgroundColor: tint.bg, borderColor: tint.border }]}>
              <Text style={styles.numeralText} adjustsFontSizeToFit numberOfLines={1}>
                {optionValue}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderWordOptions = () => (
    <>
      {step.options.map((optionValue, index) => {
        const tint = optionTint(answered, index === step.correctIndex, index === selectedIndex);
        return (
          <TouchableOpacity key={optionValue} onPress={() => handleAnswer(index)} disabled={answered}>
            <View style={[styles.option, { backgroundColor: tint.bg, borderColor: tint.border }]}>
              <Text style={styles.optionText}>{optionValue}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );

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
            You got {quizScore} out of {quizCount} right on the first try
          </Text>
          <SolidButton label="Back to Home" onPress={exitToHome} style={styles.homeBtn} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {step.type === 'teach' ? (
            <>
              <Text style={styles.numberDisplay} adjustsFontSizeToFit numberOfLines={1}>
                {step.number}
              </Text>
              <Text style={styles.wordText}>{step.word}</Text>
              <TouchableOpacity
                style={styles.hearBtn}
                onPress={() => speak(step.word, language.speechLanguage, speechRate)}
              >
                <HearLabel label="Hear it" />
              </TouchableOpacity>

              <Card style={styles.infoCard}>
                <View style={styles.labelRow}>
                  <Ionicons name="chatbubble-outline" size={15} color={colors.accentCoral} style={styles.labelIcon} />
                  <Text style={styles.infoLabel}>At the market</Text>
                </View>
                <View style={styles.exampleTextRow}>
                  <Text style={styles.exampleText}>{step.phrase}</Text>
                  <TouchableOpacity
                    style={styles.speakerBtn}
                    onPress={() => speak(step.phrase, language.speechLanguage, speechRate)}
                  >
                    <Ionicons name="volume-high" size={18} color={colors.accentCoral} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.exampleTranslation}>{step.phraseTranslation}</Text>
              </Card>

              {step.culture && (
                <Card style={styles.infoCard}>
                  <View style={styles.labelRow}>
                    <Ionicons name="bulb-outline" size={15} color={colors.accentCoral} style={styles.labelIcon} />
                    <Text style={styles.infoLabel}>Culture tip</Text>
                  </View>
                  <Text style={styles.cultureText}>{step.culture}</Text>
                </Card>
              )}
            </>
          ) : step.type === 'listen-pick' ? (
            <>
              <Text style={styles.question}>Listen and pick the number</Text>
              <TouchableOpacity
                style={styles.hearBtn}
                onPress={() => speak(step.audioText, language.speechLanguage, speechRate)}
              >
                <HearLabel label="Listen again" />
              </TouchableOpacity>
              {renderNumeralGrid()}
            </>
          ) : (
            <>
              {step.quizVariant === 'seeNumeralPickWord' ? (
                <>
                  <Text style={styles.numberDisplay} adjustsFontSizeToFit numberOfLines={1}>
                    {step.number}
                  </Text>
                  <Text style={styles.question}>Which word is this?</Text>
                  {renderWordOptions()}
                </>
              ) : (
                <>
                  <Text style={styles.question}>Which number did you hear?</Text>
                  <TouchableOpacity
                    style={styles.hearBtn}
                    onPress={() => speak(step.word, language.speechLanguage, speechRate)}
                  >
                    <HearLabel label="Listen again" />
                  </TouchableOpacity>
                  {renderNumeralGrid()}
                </>
              )}
              {answered && (
                <Card style={styles.feedbackCard}>
                  <Text style={styles.feedbackText}>
                    {selectedIndex === step.correctIndex ? step.feedbackCorrect : step.feedbackWrong}
                  </Text>
                </Card>
              )}
            </>
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
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius * 2, borderBottomRightRadius: radius * 2,
  },
  headerTitle: { color: colors.onGradient, fontSize: fontSize.header, fontWeight: fontWeight.medium },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  glassBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.glassFill, borderColor: colors.glassBorder, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  glassBtnSpacer: { width: 32 },
  progressTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', marginHorizontal: spacing.lg,
  },
  progressFill: { height: '100%', backgroundColor: colors.onGradient, borderRadius: 4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  numberDisplay: { fontSize: 88, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 4 },
  wordText: { fontSize: 26, color: colors.textMuted, marginBottom: 20 },
  hearBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentCoralTint,
    borderColor: colors.accentCoral, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 24,
  },
  hearBtnText: { color: colors.accentCoral, fontSize: 14, fontWeight: fontWeight.medium },
  infoCard: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  labelIcon: { marginRight: 6 },
  infoLabel: { color: colors.text, fontSize: 15, fontWeight: fontWeight.medium },
  exampleTextRow: { flexDirection: 'row', alignItems: 'center' },
  exampleText: { color: colors.text, fontSize: 16, fontWeight: fontWeight.medium, flexShrink: 1 },
  exampleTranslation: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  cultureText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  speakerBtn: { marginLeft: 12, padding: 4 },
  question: { fontSize: 20, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 22 },
  option: {
    padding: 16, marginBottom: 12, borderRadius: radius, borderWidth: 1,
  },
  optionText: { color: colors.text, fontSize: 16, fontWeight: fontWeight.regular },
  numeralGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  numeralCell: { width: '48%', marginBottom: 14 },
  numeralCard: {
    paddingVertical: 22, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius, borderWidth: 1,
  },
  numeralText: { color: colors.text, fontSize: 40, fontWeight: fontWeight.medium },
  feedbackCard: { marginTop: 8 },
  feedbackText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  continueBtn: { marginTop: spacing.xl },
  completeContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl,
  },
  completeEmoji: { fontSize: 64, marginBottom: spacing.lg },
  completeTitle: { fontSize: 26, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 10 },
  completeSubtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xxl },
  homeBtn: { alignSelf: 'stretch' },
});
