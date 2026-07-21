import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FriendsScreen from './FriendsScreen';
import GroupsScreen from './GroupsScreen';
import BattlesScreen from './BattlesScreen';
import { colors, radius, fontWeight } from '../theme';

const SEGMENTS = [
  { key: 'friends', label: 'Friends' },
  { key: 'groups', label: 'Groups' },
  { key: 'battles', label: 'Battles' },
];

export default function SocialScreen({ navigation }) {
  const [segment, setSegment] = useState('friends');

  const segmentedControl = (
    <View style={styles.segmentedControl}>
      {SEGMENTS.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={[styles.segmentBtn, segment === key && styles.segmentBtnActive]}
          onPress={() => setSegment(key)}
        >
          <Text style={[styles.segmentText, segment === key && styles.segmentTextActive]}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (segment === 'groups') {
    return <GroupsScreen navigation={navigation} headerContent={segmentedControl} />;
  }
  if (segment === 'battles') {
    return <BattlesScreen navigation={navigation} headerContent={segmentedControl} />;
  }
  return <FriendsScreen navigation={navigation} headerContent={segmentedControl} />;
}

const styles = StyleSheet.create({
  // Sits on the gradient header — glass track, solid white active pill.
  segmentedControl: {
    flex: 1, flexDirection: 'row',
    backgroundColor: colors.glassFill,
    borderColor: colors.glassBorder, borderWidth: 0.5,
    borderRadius: radius, padding: 4,
  },
  segmentBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius - 4,
  },
  segmentBtnActive: { backgroundColor: colors.onGradient },
  segmentText: { color: colors.onGradient, fontSize: 13, fontWeight: fontWeight.medium },
  segmentTextActive: { color: colors.accentCoral },
});
