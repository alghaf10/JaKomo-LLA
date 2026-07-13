import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import GlassCard, { textShadow } from './GlassCard';

const HELP_LINES = [
  ['🎯', "Questions come from your opponent's tricky words — and theirs from yours"],
  ['🔢', 'Up to 7 questions each'],
  ['⚡', '3 correct in a row wins instantly'],
  ['⏱', '5 seconds per question — no answer counts as wrong'],
  ['🔁', "Turn-based: the Social tab badge shows when it's your move"],
  ['🤝', "Nobody gets 3 in a row? It's a tie"],
];

export default function BattleHelpOverlay({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <GlassCard style={styles.card} overlayColor="rgba(0,0,0,0.45)">
          <Text style={styles.title}>How Battles Work</Text>
          {HELP_LINES.map(([emoji, text]) => (
            <View key={emoji} style={styles.lineRow}>
              <Text style={styles.lineEmoji}>{emoji}</Text>
              <Text style={styles.lineText}>{text}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.gotItBtn} onPress={onClose}>
            <Text style={styles.gotItBtnText}>Got it!</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: { padding: 24, width: '100%', maxWidth: 400 },
  title: {
    color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 18, ...textShadow,
  },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  lineEmoji: { fontSize: 16, marginRight: 10 },
  lineText: { flex: 1, color: '#fff', fontSize: 14, lineHeight: 20 },
  gotItBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 10,
  },
  gotItBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 15 },
});
