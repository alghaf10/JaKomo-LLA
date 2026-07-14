import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize, fontWeight } from '../theme';

// Button for light content areas.
//   primary   (default): coral fill, white text.
//   secondary: white fill, warm-gray border, coral text.
export default function SolidButton({
  label, icon, onPress, style, disabled, variant = 'primary',
}) {
  const secondary = variant === 'secondary';
  const contentColor = secondary ? colors.accentCoral : colors.onGradient;
  return (
    <TouchableOpacity
      style={[styles.btn, secondary ? styles.secondary : styles.primary, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {icon ? (
        <Ionicons name={icon} size={18} color={contentColor} style={styles.icon} />
      ) : null}
      {label ? <Text style={[styles.label, { color: contentColor }]}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primary: { backgroundColor: colors.accentCoral },
  secondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 0.5,
  },
  disabled: { opacity: 0.5 },
  icon: { marginRight: spacing.sm },
  label: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
  },
});
