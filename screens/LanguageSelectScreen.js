import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import BACKGROUNDS from '../lib/backgrounds';
import { getLanguages } from '../content';
import { updateActiveLanguage, resolveAuthedRoute } from '../lib/profiles';
import GlassCard, { textShadow } from '../components/GlassCard';

const LANGUAGES = getLanguages();
const SAVE_TIMEOUT_MS = 5000;

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Language save timed out')), ms);
  }),
]);

export default function LanguageSelectScreen({ navigation }) {
  const [savingCode, setSavingCode] = useState(null);

  const handleSelect = async (code) => {
    setSavingCode(code);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      setSavingCode(null);
      return;
    }
    // Navigate even if the save fails or hangs: Home falls back to es-MX
    // (the only selectable language), and the setting can be retried from
    // Profile — being stranded on this screen is the worse outcome. On a
    // clean save, route onward via the resolver so a first-run user lands in
    // Onboarding while an established user (changing language from Profile)
    // returns straight to MainTabs. If the save fails/times out we can't
    // read the profile, so fall back to MainTabs; App.js re-resolves and
    // catches any still-missing onboarding on next launch.
    let nextRoute = 'MainTabs';
    try {
      const { data, error } = await withTimeout(updateActiveLanguage(userData.user.id, code), SAVE_TIMEOUT_MS);
      if (error) console.log('Error saving language selection:', error);
      if (data) nextRoute = resolveAuthedRoute(data);
    } catch (error) {
      console.log('Language save failed or timed out:', error);
    }
    setSavingCode(null);
    navigation.replace(nextRoute);
  };

  return (
    <ImageBackground source={BACKGROUNDS.languageSelect} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>Choose your language</Text>
            <Text style={styles.subtitle}>You can change this later.</Text>

            {LANGUAGES.map((language) => (
              <TouchableOpacity
                key={language.code}
                disabled={language.comingSoon || savingCode !== null}
                onPress={() => handleSelect(language.code)}
              >
                <GlassCard
                  style={styles.card}
                  overlayColor={language.comingSoon ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'}
                  borderColor={language.comingSoon ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.3)'}
                >
                  <Text style={styles.flag}>{language.flag}</Text>
                  <View style={styles.textContainer}>
                    <Text style={[styles.name, language.comingSoon && styles.nameDisabled]}>
                      {language.name}
                    </Text>
                  </View>
                  {language.comingSoon ? (
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>Coming soon</Text>
                    </View>
                  ) : savingCode === language.code ? (
                    <ActivityIndicator color="#fff" />
                  ) : null}
                </GlassCard>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
  scrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },
  title: {
    fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8, ...textShadow,
  },
  subtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.85)', marginBottom: 28,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    padding: 18, marginBottom: 16,
  },
  flag: { fontSize: 40, marginRight: 16 },
  textContainer: { flex: 1 },
  name: { color: '#fff', fontSize: 18, fontWeight: '700' },
  nameDisabled: { color: 'rgba(255,255,255,0.5)' },
  comingSoonBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  comingSoonText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
});
