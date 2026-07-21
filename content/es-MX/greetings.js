// Lesson 1 — Greetings. Content filled and approved; kept hidden (draft: true in
// content/es-MX/index.js) until the final content-review pass. Step ids s01–s11.
export default {
  id: 'es-MX/greetings-1',
  lessonType: 'scenario',
  title: 'Greetings',
  location: 'Ciudad de México',
  steps: [
    {
      id: 'greetings-1-s01',
      type: 'word',
      phrase: 'buenas',
      translation: 'hi / hello (all-purpose)',
      note: 'The universal Mexican greeting — works morning, noon, and night. Locals use it far more than the textbook "buenos días."',
    },
    {
      id: 'greetings-1-s02',
      type: 'word',
      phrase: '¿mande?',
      translation: 'sorry, what? / come again?',
      note: 'THE Mexican way to ask someone to repeat. You\'ll use this constantly — and that\'s normal.',
    },
    {
      id: 'greetings-1-s03',
      type: 'word',
      phrase: 'mucho gusto',
      translation: 'nice to meet you',
    },
    {
      id: 'greetings-1-s04',
      type: 'teach',
      phrase: 'Buenas, ¿cómo está?',
      translation: 'Hi, how are you?',
      culture: 'With a stranger or someone older, "¿cómo está?" (usted form) is the safe, respectful default. With friends your age you\'d say "¿cómo estás?" — we\'ll get deep into that choice in a later lesson.',
    },
    {
      id: 'greetings-1-s05',
      type: 'teach',
      phrase: '¿Mande? Más despacio, por favor.',
      translation: 'Sorry? Slower, please.',
      culture: 'Saying "¿qué?" when you don\'t understand sounds blunt in Mexico — like snapping "what?" at someone. "¿Mande?" is warm and polite, and Mexicans will instantly know how to help you.',
    },
    {
      id: 'greetings-1-s06',
      type: 'quiz',
      question: 'Someone speaks too fast and you didn\'t catch it. What do you say?',
      options: ['¿Qué?', '¿Mande?', 'No.'],
      correctIndex: 1,
      feedbackCorrect: '¡Exacto! "¿Mande?" is polite and very Mexican — nobody minds repeating.',
      feedbackWrong: '"¿Qué?" sounds blunt, like "WHAT?" — "¿mande?" is the warm way to ask.',
    },
    {
      id: 'greetings-1-s07',
      type: 'listen',
      phrase: 'Buenas, ¿cómo está?',
      options: ['Hi, how are you?', 'Good night, sleep well', 'What\'s your name?'],
      correctIndex: 0,
      // [FAHAD: verify feedback — added, not in the approved spec for s07]
      feedbackCorrect: '¡Sí! "Buenas, ¿cómo está?" — Hi, how are you?',
      feedbackWrong: 'That was "Buenas, ¿cómo está?" — Hi, how are you?',
    },
    {
      id: 'greetings-1-s08',
      type: 'fill',
      // Hint mapped to `prompt` (FillStep renders `prompt` above the frame).
      prompt: 'the all-purpose greeting',
      // Blank normalized to the renderer's "___" marker (spec wrote "_____").
      frame: '___, ¿cómo está?',
      answer: 'Buenas',
    },
    {
      id: 'greetings-1-s09',
      type: 'build',
      // [FAHAD: verify translation — added so the learner sees the target]
      translation: 'Nice to meet you too',
      answer: 'Mucho gusto igualmente',
      extraTiles: ['adiós', 'gracias'],
    },
    {
      id: 'greetings-1-s10',
      type: 'speak',
      phrase: '¿Mande? Más despacio, por favor.',
      translation: 'Sorry? Slower, please.',
    },
    {
      id: 'greetings-1-s11',
      type: 'match',
      pairs: [
        { es: 'buenas', en: 'hello' },
        { es: '¿mande?', en: 'sorry, what?' },
        { es: 'mucho gusto', en: 'nice to meet you' },
        { es: 'más despacio', en: 'slower' },
      ],
    },
  ],
};
