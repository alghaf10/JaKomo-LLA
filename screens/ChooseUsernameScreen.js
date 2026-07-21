import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { fetchProfile, claimUsername, resolveAuthedRoute } from '../lib/profiles';
import Card from '../components/Card';
import SolidButton from '../components/SolidButton';
import UsernameField from '../components/UsernameField';
import {
  colors, gradient, spacing, fontSize, fontWeight,
} from '../theme';

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
    <LinearGradient
      colors={gradient.colors}
      locations={gradient.locations}
      start={gradient.start}
      end={gradient.end}
      style={styles.screen}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Choose your username</Text>
          <Text style={styles.subtitle}>
            Friends can now find you by username instead of a code. Pick yours once — it&apos;s how
            people will know you across JaKomo.
          </Text>

          {checkingProfile ? (
            <ActivityIndicator color={colors.onGradient} />
          ) : (
            <Card style={styles.card}>
              <UsernameField
                value={username}
                onChangeText={setUsername}
                editable={!saving}
                onStatusChange={setUsernameStatus}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <SolidButton
                label={saving ? '' : 'Claim username'}
                onPress={handleSave}
                disabled={usernameStatus !== 'available' || saving}
                style={styles.claimBtn}
              />
              {saving ? <ActivityIndicator color={colors.accentCoral} style={styles.claimSpinner} /> : null}
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: fontWeight.medium, color: colors.onGradient, marginBottom: 8 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginBottom: 28, lineHeight: 21 },
  card: {},
  errorText: { color: colors.danger, fontSize: 13, fontWeight: fontWeight.medium, marginBottom: 10 },
  claimBtn: { marginTop: 6 },
  claimSpinner: { marginTop: 10 },
});
