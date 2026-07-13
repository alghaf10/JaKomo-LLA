import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import OnboardingLevelScreen from '../screens/OnboardingLevelScreen';
import OnboardingGoalScreen from '../screens/OnboardingGoalScreen';
import OnboardingMinutesScreen from '../screens/OnboardingMinutesScreen';
import OnboardingSummaryScreen from '../screens/OnboardingSummaryScreen';

const Stack = createNativeStackNavigator();

// Nested stack so users can move back/forward between the four steps; wrapped
// in OnboardingProvider so answers persist across that movement and the
// summary always reflects the latest picks. Registered as one root route,
// mirroring how MainTabs wraps in SocialBadgeProvider.
export default function OnboardingNavigator() {
  return (
    <OnboardingProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="OnboardingLevel" component={OnboardingLevelScreen} />
        <Stack.Screen name="OnboardingGoal" component={OnboardingGoalScreen} />
        <Stack.Screen name="OnboardingMinutes" component={OnboardingMinutesScreen} />
        <Stack.Screen name="OnboardingSummary" component={OnboardingSummaryScreen} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}
