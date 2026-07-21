import React from 'react';
import {
  Modal, View, Text, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SolidButton from './SolidButton';
import {
  colors, radius, spacing, fontSize, fontWeight,
} from '../theme';

// [Ionicons name, text]. ⏱ was not in the queued list — mapped to time-outline.
const HELP_LINES = [
  ['flag-outline', "Questions come from your opponent's tricky words — and theirs from yours"],
  ['calculator', 'Up to 7 questions each'],
  ['flash', '3 correct in a row wins instantly'],
  ['time-outline', '5 seconds per question — no answer counts as wrong'],
  ['repeat', "Turn-based: the Social tab badge shows when it's your move"],
  ['people-outline', "Nobody gets 3 in a row? It's a tie"],
];

export default function BattleHelpOverlay({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>How Battles Work</Text>
          {HELP_LINES.map(([icon, text]) => (
            <View key={icon} style={styles.lineRow}>
              <Ionicons name={icon} size={18} color={colors.accentCoral} style={styles.lineIcon} />
              <Text style={styles.lineText}>{text}</Text>
            </View>
          ))}
          <SolidButton label="Got it!" onPress={onClose} style={styles.gotItBtn} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
  },
  card: {
    padding: spacing.xl, width: '100%', maxWidth: 400,
    backgroundColor: colors.card, borderRadius: radius,
  },
  title: {
    color: colors.text, fontSize: fontSize.header, fontWeight: fontWeight.medium, marginBottom: 18,
  },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  lineIcon: { marginRight: 10, marginTop: 1 },
  lineText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  gotItBtn: { marginTop: 10 },
});
