import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

// Provided credentials. The webClientId is what makes the Google ID token's
// audience line up with Supabase's Google provider config.
const GOOGLE_IOS_CLIENT_ID = '291396605020-tst5af47nind6ne3neqibonfjmvja4fq.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID = '291396605020-hb90m3tgb4paqeh21ljff8k4i0358rp4.apps.googleusercontent.com';

// Normalized result for both providers:
//   { error: null }                       success (session established)
//   { cancelled: true }                    user backed out — caller stays silent
//   { error, kind: 'duplicate'|'network'|'generic' }
const CANCELLED = { cancelled: true };
const ok = { error: null };

// Supabase doesn't type identity-conflict distinctly, so classify by message.
const classifyError = (error) => {
  const message = (error?.message || '').toLowerCase();
  if (/already|exists|identity|registered/.test(message)) return 'duplicate';
  if (/network|fetch|timeout|connection/.test(message)) return 'network';
  return 'generic';
};

let googleConfigured = false;
const ensureGoogleConfigured = () => {
  if (googleConfigured) return;
  GoogleSignin.configure({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });
  googleConfigured = true;
};

export const isAppleAuthAvailable = async () => {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (e) {
    return false;
  }
};

export const signInWithApple = async () => {
  try {
    // Nonce: Apple embeds the SHA-256 hash in the identity token; Supabase
    // verifies it against the RAW nonce we pass. "Skip nonce" is OFF for
    // Apple in our Supabase config, so this must be explicit.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { error: new Error('No identity token from Apple'), kind: 'generic' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return { error, kind: classifyError(error) };
    return ok;
  } catch (e) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return CANCELLED;
    console.log('Apple sign-in error:', e);
    return { error: e, kind: classifyError(e) };
  }
};

export const signInWithGoogle = async () => {
  try {
    ensureGoogleConfigured();
    await GoogleSignin.hasPlayServices(); // no-op on iOS; harmless

    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return CANCELLED;

    const idToken = response.data?.idToken;
    if (!idToken) {
      return { error: new Error('No ID token from Google'), kind: 'generic' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    if (error) return { error, kind: classifyError(error) };
    return ok;
  } catch (e) {
    if (e?.code === statusCodes.SIGN_IN_CANCELLED || e?.code === statusCodes.IN_PROGRESS) {
      return CANCELLED;
    }
    console.log('Google sign-in error:', e);
    return { error: e, kind: classifyError(e) };
  }
};
