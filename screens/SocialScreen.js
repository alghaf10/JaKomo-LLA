import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FriendsScreen from './FriendsScreen';
import GroupsScreen from './GroupsScreen';
import BattlesScreen from './BattlesScreen';

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
  segmentedControl: {
    flex: 1, flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1,
    borderRadius: 14, padding: 4,
  },
  segmentBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
  },
  segmentBtnActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  segmentText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: '#1a1a1a' },
});
