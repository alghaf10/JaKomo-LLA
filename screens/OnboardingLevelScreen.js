import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BACKGROUNDS from '../lib/backgrounds';
import GlassCard, { textShadow } from '../components/GlassCard';
import { useOnboarding } from '../contexts/OnboardingContext';

const LEVELS = [
  { value: 'beginner', title: 'Complete beginner', subtitle: "Starting from scratch — that's great!" },
  { value: 'some_words', title: 'I know some words & phrases', subtitle: 'A few basics under your belt' },
  { value: 'simple_conversations', title: 'I can have simple conversations', subtitle: 'Ready to build real fluency' },
];

export default function OnboardingLevelScreen({ navigation }) {
  const { levelEstimate, setLevelEstimate } = useOnboarding();

  return (
    <ImageBackground source={BACKGROUNDS.languageSelect} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.stepLabel}>Step 1 of 3</Text>
            <Text style={styles.title}>How much Mexican Spanish do you know?</Text>

            {LEVELS.map((level) => {
              const selected = levelEstimate === level.value;
              return (
                <TouchableOpacity key={level.value} onPress={() => setLevelEstimate(level.value)}>
                  <GlassCard
                    style={styles.card}
                    overlayColor={selected ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}
                    borderColor={selected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)'}
                  >
                    <View style={styles.cardTextWrap}>
                      <Text style={styles.cardTitle}>{level.title}</Text>
                      <Text style={styles.cardSubtitle}>{level.subtitle}</Text>
                    </View>
                    {selected && <Text style={styles.check}>✓</Text>}
                  </GlassCard>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextBtn, !levelEstimate && styles.nextBtnDisabled]}
              onPress={() => navigation.navigate('OnboardingGoal')}
              disabled={!levelEstimate}
            >
              <Text style={styles.nextBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  stepLabel: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  title: {
    fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 28, lineHeight: 32, ...textShadow,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 18, marginBottom: 14,
  },
  cardTextWrap: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cardSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 3 },
  check: { color: '#fff', fontSize: 20, fontWeight: '800', marginLeft: 12 },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  nextBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, padding: 16, alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 16 },
});
