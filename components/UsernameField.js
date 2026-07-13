import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { isUsernameAvailable, USERNAME_REGEX, RESERVED_USERNAMES } from '../lib/profiles';

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

const STATUS_CONTENT = {
  idle: null,
  invalid: { text: '3–20 characters, letters, numbers or _, starting with a letter', color: '#ffb4b4' },
  reserved: { text: 'That name is reserved', color: '#ffb4b4' },
  checking: { text: 'Checking availability…', color: 'rgba(255,255,255,0.7)' },
  available: { text: '✓ Available', color: 'rgba(120,235,150,0.95)' },
  taken: { text: '✗ Already taken', color: '#ffb4b4' },
  error: { text: "Couldn't check availability — keep typing to retry", color: '#ffb4b4' },
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
        placeholderTextColor="rgba(255,255,255,0.7)"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        editable={editable}
      />
      {statusContent && (
        <Text style={[styles.statusText, { color: statusContent.color }]}>
          {statusContent.text}
        </Text>
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
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 14, padding: 15, color: '#fff', fontSize: 16,
    marginBottom: 6,
  },
  statusText: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  suggestionChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)', borderWidth: 1,
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
  },
  suggestionChipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
