import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ImageBackground, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import BACKGROUNDS from '../lib/backgrounds';
import { fetchProfile, claimUsername, resolveAuthedRoute } from '../lib/profiles';
import GlassCard, { textShadow } from '../components/GlassCard';
import UsernameField from '../components/UsernameField';

const SAVE_TIMEOUT_MS = 5000;

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Username save timed out')), ms);
  }),
]);

// Blocking one-time chooser for existing (pre-username) accounts — same
// root-stack pattern as LanguageSelect. New accounts pick a username at
// signup and never see this.
export default function ChooseUsernameScreen({ navigation }) {
  const [userId, setUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Legacy no-row accounts still need language + profile completion, so send
  // them to LanguageSelect rather than the resolver's not-trap MainTabs.
  const nextRoute = (profileData) => (profileData ? resolveAuthedRoute(profileData) : 'LanguageSelect');

  useEffect(() => {
    const check = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setCheckingProfile(false);
        return;
      }
      setUserId(userData.user.id);

      const { data: profileData } = await fetchProfile(userData.user.id);
      setProfile(profileData);

      // Already has one (claimed on another device), or has no profiles row
      // at all (legacy account — a username can't be claimed via UPDATE; the
      // "Complete your profile" flow collects it instead). Either way, move on.
      if (!profileData || profileData.username) {
        navigation.replace(nextRoute(profileData));
        return;
      }
      setCheckingProfile(false);
    };
    check();
  }, [navigation]);

  const handleSave = async () => {
    if (usernameStatus !== 'available' || saving) return;
    setError('');
    setSaving(true);

    try {
      const { data, error: claimError, taken } = await withTimeout(
        claimUsername(userId, username.trim()),
        SAVE_TIMEOUT_MS,
      );
      if (taken) {
        setSaving(false);
        setError('Someone just took that one — try another.');
        return;
      }
      if (claimError) {
        console.log('Error claiming username:', claimError);
        setSaving(false);
        setError('Something went wrong. Please try again.');
        return;
      }
      navigation.replace(nextRoute(data || profile));
    } catch (timeoutError) {
      console.log('Username save failed or timed out:', timeoutError);
      setSaving(false);
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <ImageBackground source={BACKGROUNDS.languageSelect} style={styles.background}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>Choose your username</Text>
              <Text style={styles.subtitle}>
                Friends can now find you by username instead of a code. Pick yours once — it's how
                people will know you across JaKomo.
              </Text>

              {checkingProfile ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <GlassCard style={styles.card}>
                  <UsernameField
                    value={username}
                    onChangeText={setUsername}
                    editable={!saving}
                    onStatusChange={setUsernameStatus}
                  />
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <TouchableOpacity
                    style={[styles.primaryBtn, usernameStatus !== 'available' && styles.primaryBtnDisabled]}
                    onPress={handleSave}
                    disabled={usernameStatus !== 'available' || saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#1a1a1a" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Claim username</Text>
                    )}
                  </TouchableOpacity>
                </GlassCard>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
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
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  title: {
    fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8, ...textShadow,
  },
  subtitle: {
    fontSize: 15, color: 'rgba(255,255,255,0.85)', marginBottom: 28, lineHeight: 21,
  },
  card: { padding: 18 },
  errorText: {
    color: '#ffb4b4', fontSize: 13, fontWeight: '600', marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 6,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 15 },
});
