import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import { supabase } from '../lib/supabase';

const speak = (text) => {
  Speech.stop();
  Speech.speak(text, { language: 'es-MX', rate: 0.85 });
};

export default function LessonScreen({ navigation, route }) {
  const { lesson } = route.params;
  const steps = lesson.steps;
  const quizCount = steps.filter((s) => s.type === 'quiz').length;

  const [stepIndex, setStepIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const step = steps[stepIndex];

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
    return () => Speech.stop();
  }, []);

  useEffect(() => {
    if (!finished) return;

    const saveProgress = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.log('Error fetching user for lesson progress:', userError);
        return;
      }
      const { error } = await supabase.from('lesson_progress').upsert(
        {
          user_id: userData.user.id,
          lesson_id: lesson.id,
          quiz_score: quizScore,
          quiz_total: quizCount,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,lesson_id' },
      );
      if (error) console.log('Error saving lesson progress:', error);
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
    if (index === step.correctIndex) {
      setQuizScore((prev) => prev + 1);
    }
  };

  const handleContinue = () => {
    Speech.stop();
    if (stepIndex === steps.length - 1) {
      setFinished(true);
      return;
    }
    setStepIndex((prev) => prev + 1);
    setSelectedIndex(null);
    setAnswered(false);
  };

  const canContinue = step?.type === 'teach' || answered;

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1518659526054-190340b17971?w=800' }}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {!finished && (
            <View style={styles.header}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((stepIndex + 1) / steps.length) * 100}%` }]} />
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={exitToHome}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

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
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {step.type === 'teach' ? (
                <>
                  <Text style={styles.phrase}>{step.phrase}</Text>
                  <Text style={styles.translation}>{step.translation}</Text>
                  <TouchableOpacity style={styles.hearBtn} onPress={() => speak(step.phrase)}>
                    <Text style={styles.hearBtnText}>🔊 Hear it</Text>
                  </TouchableOpacity>
                  <View style={styles.cultureCard}>
                    <Text style={styles.cultureLabel}>💡 Culture tip</Text>
                    <Text style={styles.cultureText}>{step.culture}</Text>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.question}>{step.question}</Text>
                  {step.options.map((option, index) => {
                    const isCorrect = index === step.correctIndex;
                    const isSelected = index === selectedIndex;
                    let optionStyle = styles.option;
                    if (answered && isCorrect) optionStyle = styles.optionCorrect;
                    else if (answered && isSelected) optionStyle = styles.optionWrong;

                    return (
                      <TouchableOpacity
                        key={option}
                        style={optionStyle}
                        onPress={() => handleAnswer(index)}
                        disabled={answered}
                      >
                        <View style={styles.optionRow}>
                          <Text style={styles.optionText}>{option}</Text>
                          {answered && isCorrect && (
                            <TouchableOpacity style={styles.speakerBtn} onPress={() => speak(option)}>
                              <Text style={styles.speakerBtnText}>🔊</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  {answered && (
                    <View style={styles.feedbackCard}>
                      <Text style={styles.feedbackText}>
                        {selectedIndex === step.correctIndex ? step.feedbackCorrect : step.feedbackWrong}
                      </Text>
                    </View>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8,
  },
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
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, flexGrow: 1 },
  phrase: {
    fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 10,
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
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 16, padding: 16,
  },
  cultureLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  cultureText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
  question: {
    fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 22,
  },
  option: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  optionCorrect: {
    backgroundColor: 'rgba(76,217,100,0.35)',
    borderColor: 'rgba(76,217,100,0.8)', borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  optionWrong: {
    backgroundColor: 'rgba(255,59,48,0.35)',
    borderColor: 'rgba(255,59,48,0.8)', borderWidth: 1,
    borderRadius: 14, padding: 16, marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  optionText: { color: '#fff', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  speakerBtn: { marginLeft: 12, padding: 4 },
  speakerBtnText: { fontSize: 18 },
  feedbackCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 16, padding: 16, marginTop: 8,
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
