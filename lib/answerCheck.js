// Normalization + fuzzy answer matching for typed ('fill') and spoken ('speak')
// answers. Pure and dependency-free so it can be unit-tested in isolation.

// Lowercase -> strip accents -> strip punctuation -> collapse whitespace -> trim.
// After NFD accent-stripping every letter is plain ASCII (ñ -> n, é -> e), so a
// simple [^a-z0-9\s] punctuation strip is safe and avoids Unicode-property regex.
export function normalize(input) {
  return String(input == null ? '' : input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining accent marks
    .replace(/[^a-z0-9\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// Classic Levenshtein edit distance (insert/delete/substitute).
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

// Length-relative tolerance on the NORMALIZED expected answer:
//   len <= 4 -> exact match only (so gender errors like unos/unas, dist 1, FAIL)
//   len 5-7  -> distance <= 1
//   len 8+   -> distance <= 2
export function maxDistanceFor(len) {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

// True if `input` is an acceptable answer for `expected`, using the
// length-relative threshold above on the normalized expected string.
export function isAcceptable(input, expected) {
  const normExpected = normalize(expected);
  if (!normExpected) return false;
  const distance = levenshtein(normalize(input), normExpected);
  return distance <= maxDistanceFor(normExpected.length);
}
