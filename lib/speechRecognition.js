// Thin, swappable wrapper around on-device speech-to-text for the 'speak' step.
// Wraps jamsch/expo-speech-recognition's EVENT-based API into the single-utterance
// promise that SpeakStep expects. SpeakStep is unchanged by this wrapper.
//
// The package is currently NOT bundled (removed from package.json / app.json)
// because it fails to autolink on EAS. We load it LAZILY and degrade to
// "unavailable" when absent, so importing this file never throws "Cannot find
// native module" and SpeakStep falls back to its simulate field.
//
// TODO(stt-1.1): module fails to autolink on EAS despite correct
// expo-module.config.json — investigate as isolated experiment before re-adding.

// Cached load: the native module, null when unavailable, undefined = untried.
let cachedModule;

function loadModule() {
  if (cachedModule !== undefined) return cachedModule;
  cachedModule = null;
  try {
    // DELIBERATE: computed specifier defeats Metro static resolution while the
    // package is uninstalled. When re-adding in stt-1.1, restore a normal
    // top-level import — grep for STT_PACKAGE_NOT_STATICALLY_RESOLVED.
    const STT_PACKAGE_NOT_STATICALLY_RESOLVED = 'expo-speech-recognition';
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(STT_PACKAGE_NOT_STATICALLY_RESOLVED);
    cachedModule = (mod && mod.ExpoSpeechRecognitionModule) || null;
  } catch (_) {
    cachedModule = null;
  }
  return cachedModule;
}

// Sync availability check (matches how SpeakStep reads it at render time).
export function isSpeechRecognitionAvailable() {
  const mod = loadModule();
  if (!mod) return false;
  try {
    return mod.isRecognitionAvailable();
  } catch (_) {
    return false;
  }
}

// Run one utterance in `language` and resolve { transcript }. Requests
// mic + speech permission first. Rejects on unavailable/denied/error/no-result/
// timeout; SpeakStep already catches and leaves the step unanswered.
export async function recognizeOnce({ language = 'es-MX' } = {}) {
  const mod = loadModule();
  if (!mod) throw new Error('STT unavailable: expo-speech-recognition native module not present');

  const perm = await mod.requestPermissionsAsync();
  if (!perm.granted) throw new Error('SpeechRecognitionPermissionDenied');

  return new Promise((resolve, reject) => {
    let settled = false;
    let best = '';
    const subs = [];
    let timer;

    const cleanup = () => {
      subs.forEach((sub) => { try { sub.remove(); } catch (_) {} });
      clearTimeout(timer);
    };
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(arg);
    };

    subs.push(mod.addListener('result', (e) => {
      const t = e?.results?.[0]?.transcript;
      if (typeof t === 'string' && t) best = t;
      if (e?.isFinal && best) finish(resolve, { transcript: best });
    }));
    subs.push(mod.addListener('error', (e) => {
      finish(reject, new Error(e?.error || 'SpeechRecognitionError'));
    }));
    subs.push(mod.addListener('end', () => {
      // Ended (silence/timeout on device) — accept the best interim if any.
      if (best) finish(resolve, { transcript: best });
      else finish(reject, new Error('SpeechRecognitionNoResult'));
    }));

    // Safety net in case no 'end' fires.
    timer = setTimeout(() => {
      try { mod.stop(); } catch (_) {}
      if (best) finish(resolve, { transcript: best });
      else finish(reject, new Error('SpeechRecognitionTimeout'));
    }, 15000);

    try {
      mod.start({ lang: language, continuous: false, interimResults: false });
    } catch (e) {
      finish(reject, e instanceof Error ? e : new Error('SpeechRecognitionStartFailed'));
    }
  });
}
