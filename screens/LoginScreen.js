import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import AvatarPicker from '../components/AvatarPicker';
import UsernameField from '../components/UsernameField';
import { createProfile } from '../lib/profiles';
import { signInWithApple, signInWithGoogle, isAppleAuthAvailable } from '../lib/auth';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

const SOCIAL_ERROR_MESSAGES = {
  duplicate: 'An account with this email already exists — try signing in with your password.',
  network: 'Network error — please check your connection and try again.',
  generic: "Couldn't sign you in. Please try again.",
};

// U+F8FF renders as the Apple logo on iOS, where these buttons are the only
// ones shown. Escape form is used so the source stays encoding-safe.
const APPLE_LOGO = '';

export default function LoginScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [firstName, setFirstName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState('idle');
  const [avatarId, setAvatarId] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [socialLoading, setSocialLoading] = useState(null); // 'apple' | 'google' | null
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  const handleSocial = async (provider) => {
    if (socialLoading) return;
    setError('');
    setInfo('');
    setSocialLoading(provider);
    const result = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
    setSocialLoading(null);
    if (result?.cancelled || !result?.error) return;
    Alert.alert('Sign-in failed', SOCIAL_ERROR_MESSAGES[result.kind] || SOCIAL_ERROR_MESSAGES.generic);
  };

  const handleLogin = async () => {
    setError('');
    setInfo('');
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError(signInError.message);
  };

  const handleSignUp = async () => {
    setError('');
    setInfo('');
    if (!firstName.trim()) {
      setError('Please enter your first name.');
      return;
    }
    if (usernameStatus !== 'available') {
      setError(
        usernameStatus === 'checking'
          ? 'One moment — still checking that username.'
          : 'Please choose an available username.',
      );
      return;
    }
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const { error: profileError, usernameTaken } = await createProfile({
        userId,
        firstName: firstName.trim(),
        avatarId,
        username: username.trim(),
      });
      if (usernameTaken) console.log('Username taken during signup race');
      else if (profileError) console.log('Error creating profile:', profileError);
    }

    setLoading(false);
    if (!data.session) {
      setInfo('Check your email to confirm your account.');
    }
  };

  const switchToSignup = () => {
    setError('');
    setInfo('');
    setMode('signup');
  };

  const switchToLogin = () => {
    setError('');
    setInfo('');
    setMode('login');
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>JaKomo</Text>
          <Text style={styles.tagline}>Learn What You Need Fast!- ¡órale!</Text>

          <Card style={styles.formCard}>
            {/* Social sign-in — iOS only (provided credentials cover iOS + web) */}
            {Platform.OS === 'ios' && (
              <>
                {appleAvailable && (
                  <TouchableOpacity
                    style={[styles.appleBtn, socialLoading && styles.socialBtnDisabled]}
                    onPress={() => handleSocial('apple')}
                    disabled={Boolean(socialLoading) || loading}
                  >
                    {socialLoading === 'apple' ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.appleBtnText}>{`${APPLE_LOGO}  Continue with Apple`}</Text>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.googleBtn, socialLoading && styles.socialBtnDisabled]}
                  onPress={() => handleSocial('google')}
                  disabled={Boolean(socialLoading) || loading}
                >
                  {socialLoading === 'google' ? (
                    <ActivityIndicator color="#1a1a1a" />
                  ) : (
                    <Text style={styles.googleBtnText}>
                      <Text style={styles.googleG}>G</Text>  Continue with Google
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
              </>
            )}

            {mode === 'signup' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="First name"
                  placeholderTextColor={colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                  editable={!loading}
                />
                <UsernameField
                  value={username}
                  onChangeText={setUsername}
                  editable={!loading}
                  onStatusChange={setUsernameStatus}
                />
                <Text style={styles.sectionLabel}>Choose an avatar</Text>
                <View style={styles.avatarPickerWrap}>
                  <AvatarPicker selected={avatarId} onSelect={setAvatarId} />
                </View>
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {info ? <Text style={styles.infoText}>{info}</Text> : null}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={mode === 'login' ? handleLogin : handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.onGradient} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'login' ? 'Log in' : 'Create account'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={mode === 'login' ? switchToSignup : switchToLogin}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>
                {mode === 'login' ? 'Create account' : 'Log in instead'}
              </Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: 32 },
  logo: {
    fontSize: 48, fontWeight: fontWeight.medium, color: colors.onGradient,
    textAlign: 'center', letterSpacing: 1,
  },
  tagline: { color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 32, fontSize: 15 },
  formCard: {},
  // Apple HIG: black fill, white logo+text.
  appleBtn: {
    backgroundColor: '#000',
    borderRadius: radius, padding: 15, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, minHeight: 52,
  },
  appleBtnText: { color: '#fff', fontSize: 16, fontWeight: fontWeight.medium },
  // Google branding: white fill, dark text, colored G — bordered so it reads on the white card.
  googleBtn: {
    backgroundColor: '#fff',
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, padding: 15, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, minHeight: 52,
  },
  googleBtnText: { color: '#1a1a1a', fontSize: 16, fontWeight: fontWeight.medium },
  googleG: { color: '#4285F4', fontSize: 18, fontWeight: fontWeight.medium },
  socialBtnDisabled: { opacity: 0.6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 13, fontWeight: fontWeight.medium, marginHorizontal: 12 },
  sectionLabel: { color: colors.text, fontSize: 14, fontWeight: fontWeight.medium, marginBottom: 12 },
  avatarPickerWrap: { marginBottom: 14 },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, padding: 15, color: colors.text, marginBottom: 14, fontSize: 16,
  },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: 14, fontSize: 14, fontWeight: fontWeight.medium },
  infoText: { color: colors.text, textAlign: 'center', marginBottom: 14, fontSize: 14, fontWeight: fontWeight.medium },
  primaryBtn: {
    backgroundColor: colors.accentCoral,
    borderRadius: radius, padding: 16, alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { color: colors.onGradient, fontWeight: fontWeight.medium, fontSize: 16 },
  secondaryBtn: { padding: 14, alignItems: 'center', marginTop: 6 },
  secondaryBtnText: { color: colors.accentCoral, fontWeight: fontWeight.medium, fontSize: 15 },
});
