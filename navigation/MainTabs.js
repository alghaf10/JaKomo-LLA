import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

import HomeScreen from '../screens/HomeScreen';
import LessonScreen from '../screens/LessonScreen';
import NumbersLessonScreen from '../screens/NumbersLessonScreen';
import LettersLessonScreen from '../screens/LettersLessonScreen';
import StreakScreen from '../screens/StreakScreen';
import PracticeScreen from '../screens/PracticeScreen';
import SocialScreen from '../screens/SocialScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import BattleScreen from '../screens/BattleScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { SocialBadgeProvider, useSocialBadge } from '../contexts/SocialBadgeContext';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const SocialStack = createNativeStackNavigator();

// Screens that take over the full screen and hide the tab bar while focused.
const HOME_HIDDEN_ROUTES = ['Lesson', 'NumbersLesson', 'LettersLesson'];
const SOCIAL_HIDDEN_ROUTES = ['GroupChat', 'Battle'];

const TAB_ICONS = {
  HomeTab: '🏠',
  PracticeTab: '🧠',
  SocialTab: '👥',
  ProfileTab: '👤',
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
  const { pendingRequestCount } = useSocialBadge();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarStyle: VISIBLE_TAB_BAR_STYLE,
        tabBarBackground,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>
            {TAB_ICONS[route.name]}
          </Text>
        ),
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
          tabBarBadge: pendingRequestCount > 0 ? pendingRequestCount : undefined,
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
