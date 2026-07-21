// Lesson 8 — Tú vs. Usted. DRAFT SCAFFOLD (structure only). Kept hidden
// (draft: true in content/es-MX/index.js) until content lands + review.
//
// Different shape from the other lessons: s01–s07 are SCENARIO quiz steps —
// each is a social situation with exactly TWO options (the tú phrasing and the
// usted phrasing of the same request). correctIndex is the register the moment
// calls for. BOTH feedback fields carry real content here (distinct markers):
//   [FAHAD: signaled — correct] = what the right register signaled
//   [FAHAD: signaled — wrong]   = what the wrong register would land as socially
// Convention: option 0 = tú phrasing, option 1 = usted phrasing.
export default {
  id: 'es-MX/tu-vs-usted-1',
  lessonType: 'scenario',
  title: 'Tú vs. Usted',
  location: 'Ciudad de México',
  steps: [
    {
      id: 'tu-vs-usted-1-s01',
      type: 'quiz',
      question: '[FAHAD: en]',
      options: ['[FAHAD: es — tú]', '[FAHAD: es — usted]'],
      correctIndex: 0, // [FAHAD: set register for this scenario]
      feedbackCorrect: '[FAHAD: signaled — correct]',
      feedbackWrong: '[FAHAD: signaled — wrong]',
    },
    {
      id: 'tu-vs-usted-1-s02',
      type: 'quiz',
      question: '[FAHAD: en]',
      options: ['[FAHAD: es — tú]', '[FAHAD: es — usted]'],
      correctIndex: 0, // [FAHAD: set register for this scenario]
      feedbackCorrect: '[FAHAD: signaled — correct]',
      feedbackWrong: '[FAHAD: signaled — wrong]',
    },
    {
      id: 'tu-vs-usted-1-s03',
      type: 'quiz',
      question: '[FAHAD: en]',
      options: ['[FAHAD: es — tú]', '[FAHAD: es — usted]'],
      correctIndex: 0, // [FAHAD: set register for this scenario]
      feedbackCorrect: '[FAHAD: signaled — correct]',
      feedbackWrong: '[FAHAD: signaled — wrong]',
    },
    {
      id: 'tu-vs-usted-1-s04',
      type: 'quiz',
      question: '[FAHAD: en]',
      options: ['[FAHAD: es — tú]', '[FAHAD: es — usted]'],
      correctIndex: 0, // [FAHAD: set register for this scenario]
      feedbackCorrect: '[FAHAD: signaled — correct]',
      feedbackWrong: '[FAHAD: signaled — wrong]',
    },
    {
      id: 'tu-vs-usted-1-s05',
      type: 'quiz',
      question: '[FAHAD: en]',
      options: ['[FAHAD: es — tú]', '[FAHAD: es — usted]'],
      correctIndex: 0, // [FAHAD: set register for this scenario]
      feedbackCorrect: '[FAHAD: signaled — correct]',
      feedbackWrong: '[FAHAD: signaled — wrong]',
    },
    {
      id: 'tu-vs-usted-1-s06',
      type: 'quiz',
      question: '[FAHAD: en]',
      options: ['[FAHAD: es — tú]', '[FAHAD: es — usted]'],
      correctIndex: 0, // [FAHAD: set register for this scenario]
      feedbackCorrect: '[FAHAD: signaled — correct]',
      feedbackWrong: '[FAHAD: signaled — wrong]',
    },
    {
      id: 'tu-vs-usted-1-s07',
      type: 'quiz',
      question: '[FAHAD: en]',
      options: ['[FAHAD: es — tú]', '[FAHAD: es — usted]'],
      correctIndex: 0, // [FAHAD: set register for this scenario]
      feedbackCorrect: '[FAHAD: signaled — correct]',
      feedbackWrong: '[FAHAD: signaled — wrong]',
    },
    {
      id: 'tu-vs-usted-1-s08',
      type: 'teach',
      phrase: '[FAHAD: es]',
      translation: '[FAHAD: en]',
      culture: '[FAHAD: en]',
    },
    {
      id: 'tu-vs-usted-1-s09',
      type: 'listen',
      phrase: '[FAHAD: es]',
      options: ['[FAHAD: en]', '[FAHAD: en]', '[FAHAD: en]'],
      correctIndex: 0,
      feedbackCorrect: '[FAHAD: en]',
      feedbackWrong: '[FAHAD: en]',
    },
    {
      id: 'tu-vs-usted-1-s10',
      type: 'fill',
      prompt: '[FAHAD: en]',
      frame: '[FAHAD: es] ___ [FAHAD: es]',
      answer: '[FAHAD: es]',
    },
    {
      id: 'tu-vs-usted-1-s11',
      type: 'speak',
      phrase: '[FAHAD: es]',
      translation: '[FAHAD: en]',
    },
    {
      id: 'tu-vs-usted-1-s12',
      type: 'match',
      pairs: [
        { es: '[FAHAD: es]', en: '[FAHAD: en]' },
        { es: '[FAHAD: es]', en: '[FAHAD: en]' },
        { es: '[FAHAD: es]', en: '[FAHAD: en]' },
        { es: '[FAHAD: es]', en: '[FAHAD: en]' },
      ],
    },
  ],
};
