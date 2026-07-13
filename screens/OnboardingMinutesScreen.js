import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BACKGROUNDS from '../lib/backgrounds';
import GlassCard, { textShadow } from '../components/GlassCard';
import { useOnboarding } from '../contexts/OnboardingContext';

const OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 20, label: '20+ min' },
];

export default function OnboardingMinutesScreen({ navigation }) {
  const { dailyMinutes, setDailyMinutes } = useOnboarding();

  return (
    <ImageBackground source={BACKGROUNDS.languageSelect} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.stepLabel}>Step 3 of 3</Text>
            <Text style={styles.title}>How much time can you practice each day?</Text>
            <Text style={styles.subtitle}>Even 5 minutes a day builds real skill. No pressure!</Text>

            <View style={styles.pillsRow}>
              {OPTIONS.map((option) => {
                const selected = dailyMinutes === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.pillWrap}
                    onPress={() => setDailyMinutes(option.value)}
                  >
                    <GlassCard
                      style={styles.pill}
                      overlayColor={selected ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}
                      borderColor={selected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)'}
                    >
                      <Text style={styles.pillText}>{option.label}</Text>
                      {selected && <Text style={styles.check}>✓</Text>}
                    </GlassCard>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, !dailyMinutes && styles.nextBtnDisabled]}
              onPress={() => navigation.navigate('OnboardingSummary')}
              disabled={!dailyMinutes}
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
    fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 10, lineHeight: 32, ...textShadow,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: 28, lineHeight: 21,
  },
  pillsRow: { gap: 14 },
  pillWrap: {},
  pill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 20,
  },
  pillText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  check: { color: '#fff', fontSize: 18, fontWeight: '800', marginLeft: 10 },
  footer: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 14, paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center',
  },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  nextBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, padding: 16, alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 16 },
});
