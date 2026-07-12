import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FriendsScreen from './FriendsScreen';
import GroupsScreen from './GroupsScreen';

export default function SocialScreen({ navigation }) {
  const [segment, setSegment] = useState('friends');

  const segmentedControl = (
    <View style={styles.segmentedControl}>
      <TouchableOpacity
        style={[styles.segmentBtn, segment === 'friends' && styles.segmentBtnActive]}
        onPress={() => setSegment('friends')}
      >
        <Text style={[styles.segmentText, segment === 'friends' && styles.segmentTextActive]}>
          Friends
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segmentBtn, segment === 'groups' && styles.segmentBtnActive]}
        onPress={() => setSegment('groups')}
      >
        <Text style={[styles.segmentText, segment === 'groups' && styles.segmentTextActive]}>
          Groups
        </Text>
      </TouchableOpacity>
    </View>
  );

  return segment === 'friends'
    ? <FriendsScreen navigation={navigation} headerContent={segmentedControl} />
    : <GroupsScreen navigation={navigation} headerContent={segmentedControl} />;
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
  segmentText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: '#1a1a1a' },
});
