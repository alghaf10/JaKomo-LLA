import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { getLessonIconName } from '../lib/lessonIcons';

// Circular themed badge (theme-color fill, white icon) that replaces the
// per-lesson identity emoji in the UI. The content `.emoji` field is untouched.
export default function LessonBadge({ lessonId, size = 44, style }) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Ionicons
        name={getLessonIconName(lessonId)}
        size={Math.round(size * 0.55)}
        color={colors.onGradient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.accentCoral,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
