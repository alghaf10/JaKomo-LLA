import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import GlassCard, { textShadow } from '../components/GlassCard';

const speak = (text, speechLanguage, rate) => {
  Speech.stop();
  Speech.speak(text, { language: speechLanguage, rate });
};

const isOptionCorrect = (step, index) => (
  step.type === 'listen-pick'
    ? step.options[index] === step.correctNumber
    : index === step.correctIndex
);

export default function NumbersLessonScreen({ navigation, route }) {
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
  const backgrounds = getBackgrounds(language.code);
  const backgroundSource = backgrounds.lessons?.[lesson.id] || backgrounds.home;

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
    navigation.navigate('Home');
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
        const isCorrect = isOptionCorrect(step, index);
        const isSelected = index === selectedIndex;
        let overlayColor = 'rgba(255,255,255,0.12)';
        let optionBorderColor = 'rgba(255,255,255,0.3)';
        if (answered && isCorrect) {
          overlayColor = 'rgba(76,217,100,0.35)';
          optionBorderColor = 'rgba(76,217,100,0.8)';
        } else if (answered && isSelected) {
          overlayColor = 'rgba(255,59,48,0.35)';
          optionBorderColor = 'rgba(255,59,48,0.8)';
        }
        return (
          <TouchableOpacity
            key={index}
            style={styles.numeralCell}
            onPress={() => handleAnswer(index)}
            disabled={answered}
          >
            <GlassCard style={styles.numeralCard} overlayColor={overlayColor} borderColor={optionBorderColor}>
              <Text style={styles.numeralText} adjustsFontSizeToFit numberOfLines={1}>
                {optionValue}
              </Text>
            </GlassCard>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderWordOptions = () => (
    <>
      {step.options.map((optionValue, index) => {
        const isCorrect = index === step.correctIndex;
        const isSelected = index === selectedIndex;
        let overlayColor = 'rgba(255,255,255,0.12)';
        let optionBorderColor = 'rgba(255,255,255,0.3)';
        if (answered && isCorrect) {
          overlayColor = 'rgba(76,217,100,0.35)';
          optionBorderColor = 'rgba(76,217,100,0.8)';
        } else if (answered && isSelected) {
          overlayColor = 'rgba(255,59,48,0.35)';
          optionBorderColor = 'rgba(255,59,48,0.8)';
        }
        return (
          <TouchableOpacity key={optionValue} onPress={() => handleAnswer(index)} disabled={answered}>
            <GlassCard style={styles.option} overlayColor={overlayColor} borderColor={optionBorderColor}>
              <Text style={styles.optionText}>{optionValue}</Text>
            </GlassCard>
          </TouchableOpacity>
        );
      })}
    </>
  );

  return (
    <ImageBackground source={backgroundSource} style={styles.background}>
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
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.pill}>
            <Text style={styles.pillText}>📍 {lesson.location}</Text>
          </View>

          {finished ? (
            <View style={styles.completeContainer}>
              <Text style={styles.completeEmoji}>🎉</Text>
              <Text style={styles.completeTitle}>Lesson complete!</Text>
              <Text style={styles.completeSubtitle}>
                You got {quizScore} out of {quizCount} right on the first try
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={exitToHome}>
                <Text style={styles.primaryBtnText}>Back to Home</Text>
              </TouchableOpacity>
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
                    <Text style={styles.hearBtnText}>🔊 Hear it</Text>
                  </TouchableOpacity>

                  <GlassCard style={styles.exampleCard} overlayColor="rgba(0,0,0,0.25)">
                    <Text style={styles.exampleLabel}>💬 At the market</Text>
                    <View style={styles.exampleTextRow}>
                      <Text style={styles.exampleText}>{step.phrase}</Text>
                      <TouchableOpacity
                        style={styles.speakerBtn}
                        onPress={() => speak(step.phrase, language.speechLanguage, speechRate)}
                      >
                        <Text style={styles.speakerBtnText}>🔊</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.exampleTranslation}>{step.phraseTranslation}</Text>
                  </GlassCard>

                  {step.culture && (
                    <GlassCard style={styles.cultureCard} overlayColor="rgba(0,0,0,0.25)">
                      <Text style={styles.cultureLabel}>💡 Culture tip</Text>
                      <Text style={styles.cultureText}>{step.culture}</Text>
                    </GlassCard>
                  )}
                </>
              ) : step.type === 'listen-pick' ? (
                <>
                  <Text style={styles.question}>Listen and pick the number</Text>
                  <TouchableOpacity
                    style={styles.hearBtn}
                    onPress={() => speak(step.audioText, language.speechLanguage, speechRate)}
                  >
                    <Text style={styles.hearBtnText}>🔊 Listen again</Text>
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
                        <Text style={styles.hearBtnText}>🔊 Listen again</Text>
                      </TouchableOpacity>
                      {renderNumeralGrid()}
                    </>
                  )}
                  {answered && (
                    <GlassCard style={styles.feedbackCard} overlayColor="rgba(0,0,0,0.25)">
                      <Text style={styles.feedbackText}>
                        {selectedIndex === step.correctIndex ? step.feedbackCorrect : step.feedbackWrong}
                      </Text>
                    </GlassCard>
                  )}
                </>
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
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginTop: 12, marginBottom: 4,
  },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '600', ...textShadow },
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
  numberDisplay: {
    fontSize: 88, fontWeight: '800', color: '#fff', marginBottom: 4, ...textShadow,
  },
  wordText: {
    fontSize: 26, color: 'rgba(255,255,255,0.9)', marginBottom: 20, ...textShadow,
  },
  hearBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    marginBottom: 24,
  },
  hearBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  exampleCard: {
    padding: 16, marginBottom: 16,
  },
  exampleLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  exampleTextRow: { flexDirection: 'row', alignItems: 'center' },
  exampleText: { color: '#fff', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  exampleTranslation: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  cultureCard: {
    padding: 16,
  },
  cultureLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  cultureText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
  question: {
    fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 22, ...textShadow,
  },
  option: {
    padding: 16, marginBottom: 12,
  },
  optionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  numeralGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
  },
  numeralCell: {
    width: '48%', marginBottom: 14,
  },
  numeralCard: {
    paddingVertical: 22, alignItems: 'center', justifyContent: 'center',
  },
  numeralText: { color: '#fff', fontSize: 40, fontWeight: '800' },
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
});
