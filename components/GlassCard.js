import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

// Frosted dark card for ON-GRADIENT / on-image surfaces. Still used by:
//   - LanguageSelectScreen (full-bleed image background)
//   - any glass surface sitting on the brand gradient
// The lesson-family + Profile screens moved to the light theme (Card + theme
// tokens) in the v3 restyle and no longer use this.
export default function GlassCard({
  children,
  style,
  overlayColor = 'rgba(255,255,255,0.12)',
  borderColor = 'rgba(255,255,255,0.3)',
}) {
  return (
    <View style={[styles.shell, { borderColor }, style]}>
      <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: overlayColor }]}
      />
      {children}
    </View>
  );
}

export const textShadow = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
  },
});
