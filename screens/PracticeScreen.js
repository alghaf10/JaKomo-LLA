import React, {
  useEffect, useState, useCallback,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import Card from '../components/Card';
import SolidButton from '../components/SolidButton';
import PracticeIntroOverlay from '../components/PracticeIntroOverlay';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

const speak = (text, speechLanguage, rate) => {
  Speech.stop();
  Speech.speak(text, { language: speechLanguage, rate });
};

const DAY_MS = 24 * 60 * 60 * 1000;
const INTRO_FLAG = 'practiceIntroSeen';

export default function PracticeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [language, setLanguage] = useState(getLanguage());
  const [speechRate, setSpeechRate] = useState(0.85);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
    return () => Speech.stop();
  }, []);

  // First-run intro, shown once.
  useEffect(() => {
    AsyncStorage.getItem(INTRO_FLAG).then((seen) => {
      if (!seen) setShowIntro(true);
    });
  }, []);

  const dismissIntro = async () => {
    setShowIntro(false);
    await AsyncStorage.setItem(INTRO_FLAG, '1');
  };

  useFocusEffect(
    useCallback(() => {
      const fetchPracticeData = async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          setLoading(false);
          return;
        }

        const { data: profileData } = await fetchProfile(userData.user.id);
        const activeLanguage = profileData?.active_language
          || userData.user.user_metadata?.language;
        setLanguage(getLanguage(activeLanguage));
        setSpeechRate(userData.user.user_metadata?.speechRate ?? 0.85);

        const { data, error } = await supabase
          .from('review_cards')
          .select('*')
          .eq('user_id', userData.user.id)
          .eq('language', getLanguage(activeLanguage).code)
          .lte('due_at', new Date().toISOString())
          .order('due_at', { ascending: true });

        if (error) {
          console.log('Error fetching review cards:', error);
          setLoading(false);
          return;
        }

        setCards(data || []);
        setCardIndex(0);
        setRevealed(false);
        setLoading(false);
      };

      fetchPracticeData();
    }, []),
  );

  const exitToHome = () => {
    Speech.stop();
    navigation.navigate('HomeTab');
  };

  const card = cards[cardIndex];

  const handleReveal = () => {
    setRevealed(true);
    speak(card.phrase, language.speechLanguage, speechRate);
  };

  const handleRate = async (rating) => {
    Speech.stop();
    const currentInterval = card.interval_days || 1;
    let newInterval;
    if (rating === 'hard') newInterval = 1;
    else if (rating === 'good') newInterval = currentInterval * 3;
    else newInterval = currentInterval * 5;

    const newDueAt = new Date(Date.now() + newInterval * DAY_MS).toISOString();

    const { error } = await supabase
      .from('review_cards')
      .update({ interval_days: newInterval, due_at: newDueAt })
      .eq('user_id', card.user_id)
      .eq('phrase', card.phrase)
      .eq('language', card.language);
    if (error) console.log('Error updating review card:', error);

    setRevealed(false);
    setCardIndex((prev) => prev + 1);
  };

  const done = !loading && (cards.length === 0 || cardIndex >= cards.length);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={gradient.colors}
        locations={gradient.locations}
        start={gradient.start}
        end={gradient.end}
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
        {done ? (
          <Text style={styles.headerTitle}>Practice</Text>
        ) : (
          <View style={styles.headerRow}>
            <View style={styles.progressTrack}>
              {cards.length > 0 && (
                <View style={[styles.progressFill, { width: `${((cardIndex + 1) / cards.length) * 100}%` }]} />
              )}
            </View>
            <TouchableOpacity style={styles.glassBtn} onPress={exitToHome}>
              <Ionicons name="close" size={18} color={colors.onGradient} />
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.accentCoral} size="large" />
          </View>
        ) : done ? (
          <View style={styles.doneBlock}>
            <Text style={styles.completeEmoji}>🎉</Text>
            <Text style={styles.completeTitle}>All caught up!</Text>
            <Text style={styles.completeSubtitle}>
              You&apos;ve reviewed every card that was due.
            </Text>
            <SolidButton label="Back to Home" onPress={exitToHome} style={styles.homeBtn} />
          </View>
        ) : (
          <View>
            <Text style={styles.cardCounter}>
              Card {cardIndex + 1} of {cards.length}
            </Text>

            <Card style={styles.flashcard}>
              <Text style={styles.translation}>{card.translation}</Text>
              {revealed && (
                <View style={styles.phraseRow}>
                  <Text style={styles.phrase}>{card.phrase}</Text>
                  <TouchableOpacity
                    style={styles.speakerBtn}
                    onPress={() => speak(card.phrase, language.speechLanguage, speechRate)}
                  >
                    <Ionicons name="volume-high" size={22} color={colors.accentCoral} />
                  </TouchableOpacity>
                </View>
              )}
            </Card>

            {revealed ? (
              <>
                <Text style={styles.rateLabel}>How well did you remember it?</Text>
                <View style={styles.rateRow}>
                  <TouchableOpacity style={[styles.rateBtn, styles.rateHard]} onPress={() => handleRate('hard')}>
                    <Text style={styles.rateHardText}>Hard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.rateBtn, styles.rateGood]} onPress={() => handleRate('good')}>
                    <Text style={styles.rateGoodText}>Good</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.rateBtn, styles.rateEasy]} onPress={() => handleRate('easy')}>
                    <Text style={styles.rateEasyText}>Easy</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <SolidButton label="Show answer" onPress={handleReveal} style={styles.showBtn} />
            )}
          </View>
        )}
      </ScrollView>

      {showIntro && <PracticeIntroOverlay onDismiss={dismissIntro} />}
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
  progressTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', marginRight: spacing.lg,
  },
  progressFill: { height: '100%', backgroundColor: colors.onGradient, borderRadius: 4 },
  glassBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.glassFill, borderColor: colors.glassBorder, borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  loadingBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  doneBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  cardCounter: { color: colors.textMuted, fontSize: fontSize.caption, fontWeight: fontWeight.medium, marginBottom: spacing.xl },
  flashcard: { padding: 20, marginBottom: 24 },
  translation: { fontSize: 24, fontWeight: fontWeight.medium, color: colors.text },
  phraseRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  phrase: { fontSize: 26, fontWeight: fontWeight.medium, color: colors.accentCoral, flexShrink: 1 },
  speakerBtn: { marginLeft: 12, padding: 4 },
  rateLabel: { color: colors.textMuted, fontSize: 14, marginBottom: 14 },
  rateRow: { flexDirection: 'row', gap: 12 },
  rateBtn: { flex: 1, borderRadius: radius, padding: 16, alignItems: 'center', borderWidth: 1 },
  rateHard: { backgroundColor: colors.dangerTint, borderColor: colors.danger },
  rateHardText: { color: colors.danger, fontWeight: fontWeight.medium, fontSize: 15 },
  rateGood: { backgroundColor: colors.card, borderColor: colors.border },
  rateGoodText: { color: colors.text, fontWeight: fontWeight.medium, fontSize: 15 },
  rateEasy: { backgroundColor: colors.successTint, borderColor: colors.success },
  rateEasyText: { color: colors.success, fontWeight: fontWeight.medium, fontSize: 15 },
  showBtn: { marginTop: spacing.sm },
  completeEmoji: { fontSize: 64, marginBottom: spacing.lg },
  completeTitle: { fontSize: 26, fontWeight: fontWeight.medium, color: colors.text, marginBottom: 10 },
  completeSubtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl },
  homeBtn: { alignSelf: 'stretch' },
});
