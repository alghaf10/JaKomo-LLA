import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../theme';

// White surface card for the warm off-white content area. 12px radius, soft
// shadow. (GlassCard is the separate dark/frosted card for on-image screens
// not yet migrated.)
export default function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: spacing.lg,
    // Soft warm shadow (iOS) + elevation (Android).
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
