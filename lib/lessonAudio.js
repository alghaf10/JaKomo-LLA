// Audio wrapper for lesson steps. Centralizes TTS so no step component calls
// expo-speech directly — later a step can carry recorded audio and only this
// module changes.
import * as Speech from 'expo-speech';

// Speak arbitrary text (e.g. a quiz option) in the target language.
export function playText(text, { language, rate } = {}) {
  if (!text) return;
  Speech.stop();
  Speech.speak(text, { language, rate });
}

// Speak a step's prompt. Keyed off `phrase` today.
// TODO(audio): when steps gain a recorded `audioAsset`, prefer it here so
// 'listen'/'word'/'teach' can use human audio without touching step data.
export function playPrompt(step, opts) {
  if (!step) return;
  playText(step.phrase, opts);
}

export function stopAudio() {
  Speech.stop();
}
