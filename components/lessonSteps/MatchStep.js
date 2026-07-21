import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { playText } from '../../lib/lessonAudio';
import { stepStyles as s } from './common';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Gradable: tap an ES item then its EN match. `pairs: [{ es, en }]`. Correct
// (for scoring) only if completed with zero mismatches.
export default function MatchStep({ step, language, speechRate, onResolve }) {
  const pairs = step.pairs || [];
  const esItems = useMemo(() => shuffle(pairs.map((p, i) => ({ key: i, text: p.es }))), []); // eslint-disable-line react-hooks/exhaustive-deps
  const enItems = useMemo(() => shuffle(pairs.map((p, i) => ({ key: i, text: p.en }))), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedEs, setSelectedEs] = useState(null);
  const [done, setDone] = useState([]); // matched pair keys
  const [mistakes, setMistakes] = useState(0);

  const finish = (doneKeys) => {
    if (doneKeys.length === pairs.length) {
      // Resolve on next tick so the last green state paints first.
      setTimeout(() => onResolve(mistakes === 0), 350);
    }
  };

  const tapEn = (enKey) => {
    if (selectedEs == null || done.includes(enKey)) return;
    if (selectedEs === enKey) {
      const next = [...done, enKey];
      setDone(next);
      setSelectedEs(null);
      playText(pairs[enKey].es, { language: language.speechLanguage, rate: speechRate });
      finish(next);
    } else {
      setMistakes((m) => m + 1);
      setSelectedEs(null);
    }
  };

  const allDone = done.length === pairs.length;

  return (
    <>
      <Text style={s.question}>Match the pairs</Text>
      <View style={s.matchColumns}>
        <View style={s.matchCol}>
          {esItems.map((it) => (
            <TouchableOpacity
              key={it.key}
              disabled={done.includes(it.key)}
              onPress={() => setSelectedEs(it.key)}
              style={[
                s.matchItem,
                selectedEs === it.key && s.matchItemSelected,
                done.includes(it.key) && s.matchItemDone,
              ]}
            >
              <Text style={s.matchItemText}>{it.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.matchCol}>
          {enItems.map((it) => (
            <TouchableOpacity
              key={it.key}
              disabled={done.includes(it.key)}
              onPress={() => tapEn(it.key)}
              style={[s.matchItem, done.includes(it.key) && s.matchItemDone]}
            >
              <Text style={s.matchItemText}>{it.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {allDone ? (
        <View style={[s.card, s.feedbackCard]}>
          <Text style={s.feedbackText}>
            {mistakes === 0 ? '¡Todo correcto!' : `Matched — with ${mistakes} slip${mistakes === 1 ? '' : 's'}.`}
          </Text>
        </View>
      ) : null}
    </>
  );
}
