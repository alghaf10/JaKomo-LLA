import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import LessonScreen from '../screens/LessonScreen';
import NumbersLessonScreen from '../screens/NumbersLessonScreen';
import LettersLessonScreen from '../screens/LettersLessonScreen';
import StreakScreen from '../screens/StreakScreen';
import LearningPlanScreen from '../screens/LearningPlanScreen';
import VoiceSpikeScreen from '../screens/VoiceSpikeScreen'; // TODO: remove after Phase 3a spike
import PracticeScreen from '../screens/PracticeScreen';
import SocialScreen from '../screens/SocialScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import BattleScreen from '../screens/BattleScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { SocialBadgeProvider, useSocialBadge } from '../contexts/SocialBadgeContext';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const SocialStack = createNativeStackNavigator();

// Screens that take over the full screen and hide the tab bar while focused.
const HOME_HIDDEN_ROUTES = ['Lesson', 'NumbersLesson', 'LettersLesson'];
const SOCIAL_HIDDEN_ROUTES = ['GroupChat', 'Battle'];

// Ionicons names per tab: [outline (inactive), filled (focused)].
const TAB_ICONS = {
  HomeTab: ['home-outline', 'home'],
  PracticeTab: ['school-outline', 'school'],
  SocialTab: ['people-outline', 'people'],
  ProfileTab: ['person-outline', 'person'],
};

const VISIBLE_TAB_BAR_STYLE = {
  backgroundColor: 'rgba(20,20,20,0.4)',
  borderTopColor: 'rgba(255,255,255,0.15)',
  borderTopWidth: StyleSheet.hairlineWidth,
};

const tabBarStyleForRoute = (route, hiddenRoutes) => {
  const focusedRouteName = getFocusedRouteNameFromRoute(route);
  if (focusedRouteName && hiddenRoutes.includes(focusedRouteName)) {
    return { display: 'none' };
  }
  return VISIBLE_TAB_BAR_STYLE;
};

const tabBarBackground = () => (
  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
);

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeIndex" component={HomeScreen} />
      <HomeStack.Screen name="Lesson" component={LessonScreen} />
      <HomeStack.Screen name="NumbersLesson" component={NumbersLessonScreen} />
      <HomeStack.Screen name="LettersLesson" component={LettersLessonScreen} />
      <HomeStack.Screen name="Streak" component={StreakScreen} />
      <HomeStack.Screen name="LearningPlan" component={LearningPlanScreen} />
      <HomeStack.Screen name="VoiceSpike" component={VoiceSpikeScreen} />{/* TODO: remove after Phase 3a spike */}
    </HomeStack.Navigator>
  );
}

function SocialStackScreen() {
  return (
    <SocialStack.Navigator screenOptions={{ headerShown: false }}>
      <SocialStack.Screen name="SocialIndex" component={SocialScreen} />
      <SocialStack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <SocialStack.Screen name="GroupChat" component={GroupChatScreen} />
      <SocialStack.Screen name="Battle" component={BattleScreen} />
    </SocialStack.Navigator>
  );
}

function MainTabsNavigator() {
  const { badgeTotal } = useSocialBadge();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: VISIBLE_TAB_BAR_STYLE,
        tabBarBackground,
        tabBarIcon: ({ focused, color }) => {
          const [outline, filled] = TAB_ICONS[route.name];
          return (
            <Ionicons name={focused ? filled : outline} size={24} color={color} />
          );
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackScreen}
        options={({ route }) => ({
          title: 'Home',
          tabBarStyle: tabBarStyleForRoute(route, HOME_HIDDEN_ROUTES),
        })}
      />
      <Tab.Screen name="PracticeTab" component={PracticeScreen} options={{ title: 'Practice' }} />
      <Tab.Screen
        name="SocialTab"
        component={SocialStackScreen}
        options={({ route }) => ({
          title: 'Social',
          tabBarBadge: badgeTotal > 0 ? badgeTotal : undefined,
          tabBarStyle: tabBarStyleForRoute(route, SOCIAL_HIDDEN_ROUTES),
        })}
      />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function MainTabs() {
  return (
    <SocialBadgeProvider>
      <MainTabsNavigator />
    </SocialBadgeProvider>
  );
}
