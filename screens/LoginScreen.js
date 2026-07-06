import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ImageBackground, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import BACKGROUNDS from '../lib/backgrounds';
import { textShadow } from '../components/GlassCard';
import AvatarPicker from '../components/AvatarPicker';
import { createProfile } from '../lib/profiles';

export default function LoginScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [firstName, setFirstName] = useState('');
  const [avatarId, setAvatarId] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

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
      const { error: profileError } = await createProfile({
        userId,
        firstName: firstName.trim(),
        avatarId,
      });
      if (profileError) console.log('Error creating profile:', profileError);
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
            {/* Location pill */}
            <View style={styles.pill}>
              <Text style={styles.pillText}>📍 Chichén Itzá</Text>
            </View>

            {/* Logo */}
            <Text style={styles.logo}>JaKomo</Text>
            <Text style={styles.tagline}>Learn What You Need Fast!- ¡órale!</Text>

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
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 },
  pill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginBottom: 18,
  },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '600', ...textShadow },
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
