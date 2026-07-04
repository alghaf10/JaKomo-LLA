import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getBackgrounds } from '../lib/backgrounds';
import { getLanguage } from '../lib/languages';
import GlassCard, { textShadow } from '../components/GlassCard';

const formatDueLabel = (dueAt) => {
  const due = new Date(dueAt);
  const now = new Date();
  if (due <= now) return 'due now';
  const diffDays = Math.ceil((due - now) / (24 * 60 * 60 * 1000));
  if (diffDays <= 1) return 'tomorrow';
  return `in ${diffDays} days`;
};

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState(getLanguage());
  const [speechRate, setSpeechRate] = useState(0.85);
  const [reviewCards, setReviewCards] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const backgrounds = getBackgrounds(language.code);

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          setLoadingReviews(false);
          return;
        }

        setEmail(userData.user.email);
        setLanguage(getLanguage(userData.user.user_metadata?.language));
        setSpeechRate(userData.user.user_metadata?.speechRate ?? 0.85);

        const { data, error } = await supabase
          .from('review_cards')
          .select('phrase, due_at')
          .eq('user_id', userData.user.id)
          .order('due_at', { ascending: true })
          .limit(10);

        if (error) {
          console.log('Error fetching upcoming reviews:', error);
          setLoadingReviews(false);
          return;
        }

        setReviewCards(data || []);
        setLoadingReviews(false);
      };

      fetchProfile();
    }, []),
  );

  const handleSpeechRateChange = async (rate) => {
    setSpeechRate(rate);
    const { error } = await supabase.auth.updateUser({ data: { speechRate: rate } });
    if (error) console.log('Error saving speech rate:', error);
  };

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  return (
    <ImageBackground source={backgrounds.home} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Account */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Account</Text>
              <Text style={styles.emailText}>{email}</Text>
              <View style={styles.languageRow}>
                <Text style={styles.languageFlag}>{language.flag}</Text>
                <Text style={styles.languageName}>{language.name}</Text>
              </View>
            </GlassCard>

            {/* Change language */}
            <TouchableOpacity onPress={() => navigation.navigate('LanguageSelect')}>
              <GlassCard style={styles.row}>
                <Text style={styles.rowText}>Change language</Text>
                <Text style={styles.rowChevron}>›</Text>
              </GlassCard>
            </TouchableOpacity>

            {/* Speech speed */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Speech speed</Text>
              <View style={styles.speedRow}>
                <TouchableOpacity
                  style={[styles.speedPill, speechRate === 0.85 && styles.speedPillActive]}
                  onPress={() => handleSpeechRateChange(0.85)}
                >
                  <Text style={[styles.speedPillText, speechRate === 0.85 && styles.speedPillTextActive]}>
                    Normal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.speedPill, speechRate === 0.6 && styles.speedPillActive]}
                  onPress={() => handleSpeechRateChange(0.6)}
                >
                  <Text style={[styles.speedPillText, speechRate === 0.6 && styles.speedPillTextActive]}>
                    Slow 🐢
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>

            {/* Upcoming reviews */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardLabel}>Upcoming reviews</Text>
              {loadingReviews ? (
                <ActivityIndicator color="#fff" />
              ) : reviewCards.length === 0 ? (
                <Text style={styles.emptyText}>Complete lessons to build your review deck!</Text>
              ) : (
                reviewCards.map((card, index) => (
                  <View
                    key={card.phrase}
                    style={[styles.reviewRow, index > 0 && styles.reviewRowDivider]}
                  >
                    <Text style={styles.reviewPhrase}>{card.phrase}</Text>
                    <Text style={styles.reviewDue}>{formatDueLabel(card.due_at)}</Text>
                  </View>
                ))
              )}
            </GlassCard>

            {/* Log out */}
            <TouchableOpacity onPress={handleLogout}>
              <GlassCard style={styles.row}>
                <Text style={styles.logoutText}>Log out</Text>
              </GlassCard>
            </TouchableOpacity>
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
  backBtn: {
    width: 32, height: 32, borderRadius: 16, marginRight: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', ...textShadow },
  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  card: {
    padding: 18, marginBottom: 16,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  emailText: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  languageRow: { flexDirection: 'row', alignItems: 'center' },
  languageFlag: { fontSize: 22, marginRight: 8 },
  languageName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, marginBottom: 16,
  },
  rowText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowChevron: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '700' },
  speedRow: { flexDirection: 'row', gap: 12 },
  speedPill: {
    flex: 1, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1,
    borderRadius: 20, paddingVertical: 12,
  },
  speedPillActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: 'rgba(255,255,255,0.9)',
  },
  speedPillText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  speedPillTextActive: { color: '#1a1a1a' },
  emptyText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  reviewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  reviewRowDivider: {
    borderTopColor: 'rgba(255,255,255,0.15)', borderTopWidth: 1,
  },
  reviewPhrase: { color: '#fff', fontSize: 15, fontWeight: '600', flexShrink: 1, marginRight: 12 },
  reviewDue: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  logoutText: { color: '#ff8080', fontSize: 16, fontWeight: '700' },
});
