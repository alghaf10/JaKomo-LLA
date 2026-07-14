import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize, fontWeight } from '../theme';

// Frosted button for use ON the gradient. White text/icon, translucent fill.
export default function GlassButton({ label, icon, onPress, style, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon ? (
        <Ionicons name={icon} size={18} color={colors.onGradient} style={styles.icon} />
      ) : null}
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassFill,
    borderColor: colors.glassBorder,
    borderWidth: 0.5,
    borderRadius: radius,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  disabled: { opacity: 0.5 },
  icon: { marginRight: spacing.sm },
  label: {
    color: colors.onGradient,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
  },
});
