import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from './lib/supabase';
import LoginScreen from './screens/LoginScreen';
import LanguageSelectScreen from './screens/LanguageSelectScreen';
import HomeScreen from './screens/HomeScreen';
import LessonScreen from './screens/LessonScreen';
import PracticeScreen from './screens/PracticeScreen';
import ProfileScreen from './screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => authListener.subscription.unsubscribe();
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

  const initialAuthedRoute = session?.user?.user_metadata?.language ? 'Home' : 'LanguageSelect';

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
              <Stack.Screen name="Practice" component={PracticeScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
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
