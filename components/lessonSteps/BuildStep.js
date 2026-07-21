import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { normalize } from '../../lib/answerCheck';
import { stepStyles as s } from './common';

// Gradable: tap word tiles in order to build `answer`. Optional `extraTiles`
// are distractors. Word order matters, so it's an exact normalized match (not
// fuzzy — that's for typed/spoken answers).
export default function BuildStep({ step, onResolve }) {
  // Build tiles once (stable ids for duplicate words), shuffled.
  const tiles = useMemo(() => {
    const words = [...String(step.answer || '').split(/\s+/).filter(Boolean), ...(step.extraTiles || [])];
    const withIds = words.map((word, i) => ({ id: `${i}-${word}`, word }));
    for (let i = withIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [withIds[i], withIds[j]] = [withIds[j], withIds[i]];
    }
    return withIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selected, setSelected] = useState([]); // array of tile ids, in order
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);

  const byId = (id) => tiles.find((t) => t.id === id);
  const inPool = tiles.filter((t) => !selected.includes(t.id));

  const handleCheck = () => {
    if (answered || selected.length === 0) return;
    const built = selected.map((id) => byId(id).word).join(' ');
    const ok = normalize(built) === normalize(step.answer);
    setCorrect(ok);
    setAnswered(true);
    onResolve(ok);
  };

  return (
    <>
      {step.prompt ? <Text style={s.prompt}>{step.prompt}</Text> : null}
      {step.translation ? <Text style={s.cue}>{step.translation}</Text> : null}

      {/* Assembled answer row */}
      <View style={s.answerRow}>
        {selected.map((id) => (
          <TouchableOpacity
            key={id}
            style={s.tile}
            disabled={answered}
            onPress={() => setSelected((prev) => prev.filter((x) => x !== id))}
          >
            <Text style={s.tileText}>{byId(id).word}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Remaining pool */}
      <View style={s.tileWrap}>
        {inPool.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={s.tile}
            disabled={answered}
            onPress={() => setSelected((prev) => [...prev, t.id])}
          >
            <Text style={s.tileText}>{t.word}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {answered ? (
        <View style={[s.card, s.feedbackCard]}>
          <Text style={s.feedbackText}>
            {correct
              ? (step.feedbackCorrect || '¡Bien hecho!')
              : (step.feedbackWrong || `Not quite — "${step.answer}".`)}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[s.checkBtn, selected.length === 0 && s.checkBtnDisabled]}
          onPress={handleCheck}
          disabled={selected.length === 0}
        >
          <Text style={s.checkBtnText}>Check</Text>
        </TouchableOpacity>
      )}
    </>
  );
}
