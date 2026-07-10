import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from './lib/supabase';
import { fetchProfile } from './lib/profiles';
import LoginScreen from './screens/LoginScreen';
import LanguageSelectScreen from './screens/LanguageSelectScreen';
import HomeScreen from './screens/HomeScreen';
import LessonScreen from './screens/LessonScreen';
import NumbersLessonScreen from './screens/NumbersLessonScreen';
import LettersLessonScreen from './screens/LettersLessonScreen';
import PracticeScreen from './screens/PracticeScreen';
import ProfileScreen from './screens/ProfileScreen';
import StreakScreen from './screens/StreakScreen';
import FriendsScreen from './screens/FriendsScreen';
import GroupsScreen from './screens/GroupsScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import GroupChatScreen from './screens/GroupChatScreen';

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
  const [activeLanguage, setActiveLanguage] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const resolveActiveLanguage = async (currentSession) => {
      if (!currentSession?.user) {
        if (isMounted) setActiveLanguage(null);
        return;
      }
      const fallback = currentSession.user.user_metadata?.language || null;
      try {
        const { data: profileData } = await withTimeout(
          fetchProfile(currentSession.user.id),
          SESSION_CHECK_TIMEOUT_MS,
        );
        if (isMounted) setActiveLanguage(profileData?.active_language || fallback);
      } catch (error) {
        console.log('Profile check failed or timed out:', error);
        if (isMounted) setActiveLanguage(fallback);
      }
    };

    const initSession = async () => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), SESSION_CHECK_TIMEOUT_MS);
        if (isMounted) setSession(data.session);
        await resolveActiveLanguage(data.session);
      } catch (error) {
        console.log('Session check failed or timed out, falling back to Login:', error);
        if (isMounted) {
          setSession(null);
          setActiveLanguage(null);
        }
      } finally {
        if (isMounted) setCheckingSession(false);
      }
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      resolveActiveLanguage(newSession);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (checkingSession) {
    return (
      <SafeAreaProvider>
        <View style={styles.splash}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  const initialAuthedRoute = activeLanguage ? 'Home' : 'LanguageSelect';

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={session ? initialAuthedRoute : 'Login'}
          screenOptions={{ headerShown: false }}
        >
          {session ? (
            <>
              <Stack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Lesson" component={LessonScreen} />
              <Stack.Screen name="NumbersLesson" component={NumbersLessonScreen} />
              <Stack.Screen name="LettersLesson" component={LettersLessonScreen} />
              <Stack.Screen name="Practice" component={PracticeScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="Streak" component={StreakScreen} />
              <Stack.Screen name="Friends" component={FriendsScreen} />
              <Stack.Screen name="Groups" component={GroupsScreen} />
              <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
              <Stack.Screen name="GroupChat" component={GroupChatScreen} />
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
