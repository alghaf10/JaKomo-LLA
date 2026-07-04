import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ImageBackground, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
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
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
    } else if (!data.session) {
      setInfo('Check your email to confirm your account.');
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=800' }}
      style={styles.background}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          {/* Location pill */}
          <View style={styles.pill}>
            <Text style={styles.pillText}>📍 Ciudad de México</Text>
          </View>

          {/* Logo */}
          <Text style={styles.logo}>JaKomo</Text>
          <Text style={styles.tagline}>Learn What You Need Fast!- ¡órale!</Text>

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
          <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <Text style={styles.primaryBtnText}>Log in</Text>
            )}
          </TouchableOpacity>

          {/* Secondary button */}
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleSignUp} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.secondaryBtnText}>Create account</Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  pill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginBottom: 18,
  },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logo: {
    fontSize: 48, fontWeight: '800', color: '#fff',
    textAlign: 'center', letterSpacing: 1,
  },
  tagline: {
    color: 'rgba(255,255,255,0.9)', textAlign: 'center',
    marginBottom: 36, fontSize: 15,
  },
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
