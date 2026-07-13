import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from './lib/supabase';
import { fetchProfile, resolveAuthedRoute, ensureSocialProfile } from './lib/profiles';
import LoginScreen from './screens/LoginScreen';
import LanguageSelectScreen from './screens/LanguageSelectScreen';
import ChooseUsernameScreen from './screens/ChooseUsernameScreen';
import OnboardingNavigator from './navigation/OnboardingNavigator';
import MainTabs from './navigation/MainTabs';

const Stack = createNativeStackNavigator();
const SESSION_CHECK_TIMEOUT_MS = 5000;

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Session check timed out')), ms);
  }),
]);

export default function App() {
  const [session, setSession] = useState(null);
  const [authedRoute, setAuthedRoute] = useState('MainTabs');
  const [checkingSession, setCheckingSession] = useState(true);
  // Bridges the gap between a live sign-in flipping `session` truthy and the
  // async profile fetch that decides where to land. Without it, the authed
  // navigator mounts with a stale initialRouteName and a new social user
  // skips the whole setup chain. Scoped to the no-session -> session
  // transition (via hadSessionRef) so token refreshes never flash/remount.
  const [resolvingAfterSignIn, setResolvingAfterSignIn] = useState(false);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const resolveRoute = async (currentSession) => {
      if (!currentSession?.user) return;

      // Metadata language lets an old account skip LanguageSelect even if its
      // profile row predates the active_language column.
      const fallbackLanguage = currentSession.user.user_metadata?.language || null;
      try {
        // Social sign-in has no profiles row yet — create the minimal one so
        // the resolver can route it through ChooseUsername (which needs a row
        // to UPDATE). Inert/no-op for email and for already-set-up accounts.
        const { data: ensuredProfile } = await withTimeout(
          ensureSocialProfile(currentSession),
          SESSION_CHECK_TIMEOUT_MS,
        );

        const profileData = ensuredProfile
          || (await withTimeout(fetchProfile(currentSession.user.id), SESSION_CHECK_TIMEOUT_MS)).data;
        if (!isMounted) return;

        if (!profileData) {
          // No profiles row yet (e.g. email signup insert pending email
          // confirm) — don't trap on gates we can't evaluate.
          setAuthedRoute(fallbackLanguage ? 'MainTabs' : 'LanguageSelect');
        } else {
          setAuthedRoute(resolveAuthedRoute({
            ...profileData,
            active_language: profileData.active_language || fallbackLanguage,
          }));
        }
      } catch (error) {
        console.log('Profile check failed or timed out:', error);
        // Unknown profile state: never block on a gate we can't validate.
        if (isMounted) setAuthedRoute(fallbackLanguage ? 'MainTabs' : 'LanguageSelect');
      }
    };

    const initSession = async () => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), SESSION_CHECK_TIMEOUT_MS);
        if (isMounted) setSession(data.session);
        hadSessionRef.current = Boolean(data.session);
        await resolveRoute(data.session);
      } catch (error) {
        console.log('Session check failed or timed out, falling back to Login:', error);
        if (isMounted) setSession(null);
      } finally {
        if (isMounted) setCheckingSession(false);
      }
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      const wasSignedIn = hadSessionRef.current;
      hadSessionRef.current = Boolean(newSession);
      setSession(newSession);

      // Only the no-session -> session transition needs the resolving gate;
      // token refreshes keep session truthy and must not remount the tree.
      if (newSession && !wasSignedIn) {
        setResolvingAfterSignIn(true);
        await resolveRoute(newSession);
        if (isMounted) setResolvingAfterSignIn(false);
      } else if (newSession) {
        resolveRoute(newSession);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (checkingSession || (session && resolvingAfterSignIn)) {
    return (
      <SafeAreaProvider>
        <View style={styles.splash}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={session ? authedRoute : 'Login'}
          screenOptions={{ headerShown: false }}
        >
          {session ? (
            <>
              <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
              <Stack.Screen name="ChooseUsername" component={ChooseUsernameScreen} />
              <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
              <Stack.Screen name="MainTabs" component={MainTabs} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
});
