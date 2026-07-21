import esMX from './es-MX';

const LANGUAGES = [
  esMX,
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷', comingSoon: true },
];

export const getLanguages = () => LANGUAGES;

export const getLanguage = (code) => (
  LANGUAGES.find((lang) => lang.code === code && !lang.comingSoon) || esMX
);

// Draft lessons (scaffolds awaiting content) are hidden everywhere in the app.
export const getLessons = (code) => getLanguage(code).lessons.filter((lesson) => !lesson.draft);

const LESSON_ROUTES_BY_TYPE = {
  scenario: 'Lesson',
  numbers: 'NumbersLesson',
  letters: 'LettersLesson',
};

export const getLessonRouteName = (lessonType) => LESSON_ROUTES_BY_TYPE[lessonType] || 'Lesson';
