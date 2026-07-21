import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isUsernameAvailable, USERNAME_REGEX, RESERVED_USERNAMES } from '../lib/profiles';
import { colors, radius, fontWeight } from '../theme';

const DEBOUNCE_MS = 400;
const MAX_USERNAME_LEN = 20;
const MAX_SUGGESTIONS = 3;

// Build format-valid candidates from the (already format-valid) typed base.
// Each suffix has a known length, so the base is truncated to keep the total
// within MAX_USERNAME_LEN — a suffix can never overflow into an invalid name.
const buildCandidates = (base) => {
  const twoDigits = String(Math.floor(Math.random() * 90) + 10); // 10–99
  const oneDigit = String(Math.floor(Math.random() * 10)); // 0–9
  const year = String(new Date().getFullYear());

  const withSuffix = (suffix) => base.slice(0, MAX_USERNAME_LEN - suffix.length) + suffix;

  const raw = [
    withSuffix(`_${twoDigits}`),
    withSuffix(year),
    withSuffix('_mx'),
    withSuffix(oneDigit),
  ];

  // Dedupe, drop anything equal to the base, and assert format as a
  // belt-and-suspenders guard — a generator bug yields zero chips, never an
  // invalid one.
  const seen = new Set();
  const candidates = [];
  raw.forEach((c) => {
    const lower = c.toLowerCase();
    if (lower === base.toLowerCase() || seen.has(lower)) return;
    if (!USERNAME_REGEX.test(c)) return;
    seen.add(lower);
    candidates.push(c);
  });
  return candidates;
};

// Availability states carry a theme color and (for the pass/fail states) an
// Ionicons name that replaces the old ✓/✗ emoji.
const STATUS_CONTENT = {
  idle: null,
  invalid: { text: '3–20 characters, letters, numbers or _, starting with a letter', color: colors.danger },
  reserved: { text: 'That name is reserved', color: colors.danger },
  checking: { text: 'Checking availability…', color: colors.textMuted },
  available: { text: 'Available', color: colors.success, icon: 'checkmark' },
  taken: { text: 'Already taken', color: colors.danger, icon: 'close' },
  error: { text: "Couldn't check availability — keep typing to retry", color: colors.danger },
};

// Shared by signup, the ChooseUsername screen, and the complete-profile
// card. Reports its status upward via onStatusChange — callers must only
// accept a submission while the status is 'available'.
export default function UsernameField({ value, onChangeText, editable = true, onStatusChange }) {
  const [status, setStatus] = useState('idle');
  const [suggestions, setSuggestions] = useState([]);
  const checkSeqRef = useRef(0);

  useEffect(() => {
    if (onStatusChange) onStatusChange(status);
  }, [status, onStatusChange]);

  // Only the 'taken' branch verifies and shows suggestions. Any input change
  // bumps checkSeqRef, so a stale verification batch is dropped exactly like
  // a stale availability response.
  const verifySuggestions = async (base, seq) => {
    const candidates = buildCandidates(base);
    if (candidates.length === 0) return;

    const results = await Promise.all(
      candidates.map(async (candidate) => {
        const { available } = await isUsernameAvailable(candidate);
        return { candidate, available };
      }),
    );
    if (seq !== checkSeqRef.current) return; // input changed during verification

    setSuggestions(results.filter((r) => r.available).map((r) => r.candidate).slice(0, MAX_SUGGESTIONS));
  };

  useEffect(() => {
    const seq = ++checkSeqRef.current;
    const trimmed = (value || '').trim();
    // Any keystroke clears prior suggestions immediately; they only reappear
    // after a fresh 'taken' result is verified.
    setSuggestions([]);

    if (!trimmed) {
      setStatus('idle');
      return undefined;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      setStatus('invalid');
      return undefined;
    }
    if (RESERVED_USERNAMES.includes(trimmed.toLowerCase())) {
      setStatus('reserved');
      return undefined;
    }

    setStatus('checking');
    const timer = setTimeout(async () => {
      const { available, error } = await isUsernameAvailable(trimmed);
      if (seq !== checkSeqRef.current) return; // stale response, input changed
      if (error) {
        console.log('Error checking username availability:', error);
        setStatus('error');
        return;
      }
      setStatus(available ? 'available' : 'taken');
      if (!available) verifySuggestions(trimmed, seq);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value]);

  const statusContent = STATUS_CONTENT[status];

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        editable={editable}
      />
      {statusContent && (
        <View style={styles.statusRow}>
          {statusContent.icon && (
            <Ionicons name={statusContent.icon} size={14} color={statusContent.color} style={styles.statusIcon} />
          )}
          <Text style={[styles.statusText, { color: statusContent.color }]}>
            {statusContent.text}
          </Text>
        </View>
      )}
      {status === 'taken' && suggestions.length > 0 && (
        <View style={styles.suggestionsRow}>
          {suggestions.map((suggestion) => (
            <TouchableOpacity
              key={suggestion}
              style={styles.suggestionChip}
              onPress={() => onChangeText(suggestion)}
              disabled={!editable}
            >
              <Text style={styles.suggestionChipText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border, borderWidth: 1,
    borderRadius: radius, padding: 15, color: colors.text, fontSize: 16,
    marginBottom: 6,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusIcon: { marginRight: 5 },
  statusText: { fontSize: 13, fontWeight: fontWeight.medium },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  suggestionChip: {
    backgroundColor: colors.accentCoralTint,
    borderColor: colors.accentCoral, borderWidth: 0.5,
    borderRadius: radius, paddingHorizontal: 12, paddingVertical: 7,
  },
  suggestionChipText: { color: colors.accentCoral, fontSize: 13, fontWeight: fontWeight.medium },
});
