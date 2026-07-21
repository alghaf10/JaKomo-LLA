import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SolidButton from './SolidButton';
import {
  colors, gradient, radius, spacing, fontSize, fontWeight,
} from '../theme';

// First-run explainer for Practice. Shown once (AsyncStorage flag lives in
// PracticeScreen). Themed: scrim + white card with a gradient accent cap.
export default function PracticeIntroOverlay({ onDismiss }) {
  return (
    <View style={styles.scrim}>
      <View style={styles.card}>
        <LinearGradient
          colors={gradient.colors}
          locations={gradient.locations}
          start={gradient.start}
          end={gradient.end}
          style={styles.cap}
        >
          <Ionicons name="albums-outline" size={28} color={colors.onGradient} />
          <Text style={styles.title}>How Practice works</Text>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={styles.p}>
            Practice helps the good stuff stick. It brings back the phrases and culture notes from
            lessons you&apos;ve already finished, spaced out so they stick.
          </Text>
          <Text style={styles.p}>
            You&apos;ll see a card with an English prompt → try to recall the Spanish → tap to reveal
            and hear it → then rate how well you knew it. Easy pushes the card further out; Hard
            brings it back soon.
          </Text>
          <Text style={styles.p}>
            A few minutes a day is all it takes. ¡Ándale!
          </Text>
          <SolidButton label="Got it" onPress={onDismiss} style={styles.btn} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 10,
  },
  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: colors.card, borderRadius: radius, overflow: 'hidden',
  },
  cap: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.xl },
  title: {
    color: colors.onGradient, fontSize: fontSize.header, fontWeight: fontWeight.medium, marginTop: spacing.sm,
  },
  body: { padding: spacing.xl },
  p: { color: colors.text, fontSize: fontSize.body, lineHeight: 23, marginBottom: spacing.md },
  btn: { marginTop: spacing.sm },
});
