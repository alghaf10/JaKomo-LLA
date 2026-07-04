import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import BACKGROUNDS from '../lib/backgrounds';
import { LANGUAGES } from '../lib/languages';
import GlassCard, { textShadow } from '../components/GlassCard';

export default function LanguageSelectScreen({ navigation }) {
  const [savingCode, setSavingCode] = useState(null);

  const handleSelect = async (code) => {
    setSavingCode(code);
    const { error } = await supabase.auth.updateUser({ data: { language: code } });
    setSavingCode(null);
    if (error) {
      console.log('Error saving language selection:', error);
      return;
    }
    navigation.replace('Home');
  };

  return (
    <ImageBackground source={BACKGROUNDS.languageSelect} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
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
