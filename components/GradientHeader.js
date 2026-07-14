import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradient, spacing, fontSize, fontWeight, radius } from '../theme';

// The primary brand gradient band at the top of every screen. Left column is
// title + optional subtitle; `right` is an optional slot (e.g. an avatar).
export default function GradientHeader({ title, subtitle, right, children }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={gradient.colors}
      locations={gradient.locations}
      start={gradient.start}
      end={gradient.end}
      style={[styles.header, { paddingTop: insets.top + spacing.md }]}
    >
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius * 2,
    borderBottomRightRadius: radius * 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  textCol: { flex: 1 },
  title: {
    color: colors.onGradient,
    fontSize: fontSize.header,
    fontWeight: fontWeight.medium,
  },
  subtitle: {
    color: colors.onGradient,
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    opacity: 0.9,
    marginTop: spacing.xs,
  },
  right: { marginLeft: spacing.md },
});
