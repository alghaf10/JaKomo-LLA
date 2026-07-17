import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../content';
import { fetchProfile } from '../lib/profiles';
import GlassCard, { textShadow } from '../components/GlassCard';
import { colors } from '../theme';

const speak = (text, speechLanguage, rate) => {
  Speech.stop();
  Speech.speak(text, { language: speechLanguage, rate });
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default function PracticeScreen({ navigation }) {
  const [language, setLanguage] = useState(getLanguage());
  const [speechRate, setSpeechRate] = useState(0.85);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const backgrounds = getBackgrounds(language.code);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
    return () => Speech.stop();
  }, []);

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
    <ImageBackground
      source={backgrounds.practice}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {!done && (
            <View style={styles.header}>
              <View style={styles.progressTrack}>
                {cards.length > 0 && (
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${((cardIndex + 1) / cards.length) * 100}%` },
                    ]}
                  />
                )}
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={exitToHome}>
                <Ionicons name="close" size={18} color={colors.onGradient} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.pill}>
            <Ionicons name="location-outline" size={13} color={colors.onGradient} />
            <Text style={styles.pillText}>San Miguel de Allende</Text>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            ) : done ? (
              <View style={styles.doneBlock}>
                <Text style={styles.completeEmoji}>🎉</Text>
                <Text style={styles.completeTitle}>All caught up!</Text>
                <Text style={styles.completeSubtitle}>
                  You've reviewed every card that was due.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={exitToHome}>
                  <Text style={styles.primaryBtnText}>Back to Home</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.reviewBlock}>
                <Text style={styles.cardCounter}>
                  Card {cardIndex + 1} of {cards.length}
                </Text>

                <GlassCard style={styles.flashcard}>
                  <Text style={styles.translation}>{card.translation}</Text>
                  {revealed && (
                    <View style={styles.phraseRow}>
                      <Text style={styles.phrase}>{card.phrase}</Text>
                      <TouchableOpacity
                        style={styles.speakerBtn}
                        onPress={() => speak(card.phrase, language.speechLanguage, speechRate)}
                      >
                        <Ionicons name="volume-high" size={22} color={colors.onGradient} />
                      </TouchableOpacity>
                    </View>
                  )}
                </GlassCard>

                {revealed ? (
                  <>
                    <Text style={styles.rateLabel}>How well did you remember it?</Text>
                    <View style={styles.rateRow}>
                      <TouchableOpacity style={styles.rateBtnHard} onPress={() => handleRate('hard')}>
                        <Text style={styles.rateBtnText}>Hard</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rateBtnGood} onPress={() => handleRate('good')}>
                        <Text style={styles.rateBtnText}>Good</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rateBtnEasy} onPress={() => handleRate('easy')}>
                        <Text style={styles.rateBtnText}>Easy</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleReveal}>
                    <Text style={styles.primaryBtnText}>Show answer</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
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
  loadingBlock: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 60,
  },
  doneBlock: {
    alignItems: 'center', paddingVertical: 40, paddingHorizontal: 8,
  },
  reviewBlock: {},
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  cardCounter: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginBottom: 24,
  },
  flashcard: {
    padding: 20, marginBottom: 24,
  },
  translation: {
    fontSize: 24, fontWeight: '700', color: '#fff',
  },
  phraseRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16,
  },
  phrase: {
    fontSize: 26, fontWeight: '800', color: '#fff', flexShrink: 1,
  },
  speakerBtn: { marginLeft: 12, padding: 4 },
  speakerBtnText: { fontSize: 22 },
  rateLabel: {
    color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 14,
  },
  rateRow: { flexDirection: 'row', gap: 12 },
  rateBtnHard: {
    flex: 1, backgroundColor: 'rgba(255,59,48,0.35)',
    borderColor: 'rgba(255,59,48,0.8)', borderWidth: 1,
    borderRadius: 14, padding: 16, alignItems: 'center',
  },
  rateBtnGood: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 14, padding: 16, alignItems: 'center',
  },
  rateBtnEasy: {
    flex: 1, backgroundColor: 'rgba(76,217,100,0.35)',
    borderColor: 'rgba(76,217,100,0.8)', borderWidth: 1,
    borderRadius: 14, padding: 16, alignItems: 'center',
  },
  rateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  primaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 16 },
  completeEmoji: { fontSize: 64, marginBottom: 16 },
  completeTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 10 },
  completeSubtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 24,
  },
});
