import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  StyleSheet, ImageBackground, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import BACKGROUNDS from '../lib/backgrounds';
import { textShadow } from '../components/GlassCard';
import AvatarPicker from '../components/AvatarPicker';
import UsernameField from '../components/UsernameField';
import { createProfile } from '../lib/profiles';
import { signInWithApple, signInWithGoogle, isAppleAuthAvailable } from '../lib/auth';

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

  // On success App.js handles routing via onAuthStateChange; cancel is silent.
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
      // A lost username race here is recoverable: the account exists, the
      // profile doesn't — the ChooseUsername/complete-profile flow picks
      // it up on next launch.
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
    <ImageBackground
      source={BACKGROUNDS.login}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo */}
            <Text style={styles.logo}>JaKomo</Text>
            <Text style={styles.tagline}>Learn What You Need Fast!- ¡órale!</Text>

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
                  placeholderTextColor="rgba(255,255,255,0.7)"
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

            {/* Inputs */}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            {/* Error / info message */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {info ? <Text style={styles.infoText}>{info}</Text> : null}

            {/* Frosted glass primary button */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={mode === 'login' ? handleLogin : handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1a1a1a" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'login' ? 'Log in' : 'Create account'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Secondary button */}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={mode === 'login' ? switchToSignup : switchToLogin}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>
                {mode === 'login' ? 'Create account' : 'Log in instead'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  container: { flex: 1 },
  // Apple HIG: black fill, white logo+text.
  appleBtn: {
    backgroundColor: '#000',
    borderRadius: 14, padding: 15, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, minHeight: 52,
  },
  appleBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  // Google branding: white fill, dark text, colored G.
  googleBtn: {
    backgroundColor: '#fff',
    borderRadius: 14, padding: 15, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, minHeight: 52,
  },
  googleBtnText: { color: '#1a1a1a', fontSize: 16, fontWeight: '600' },
  googleG: { color: '#4285F4', fontSize: 18, fontWeight: '800' },
  socialBtnDisabled: { opacity: 0.6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  dividerText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginHorizontal: 12 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 },
  logo: {
    fontSize: 48, fontWeight: '800', color: '#fff',
    textAlign: 'center', letterSpacing: 1, ...textShadow,
  },
  tagline: {
    color: 'rgba(255,255,255,0.9)', textAlign: 'center',
    marginBottom: 36, fontSize: 15,
  },
  sectionLabel: {
    color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 12,
  },
  avatarPickerWrap: { marginBottom: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, padding: 15, color: '#fff',
    marginBottom: 14, fontSize: 16,
  },
  errorText: {
    color: '#ffb4b4', textAlign: 'center', marginBottom: 14, fontSize: 14, fontWeight: '600',
  },
  infoText: {
    color: '#fff', textAlign: 'center', marginBottom: 14, fontSize: 14, fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1,
    borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12,
  },
  secondaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
