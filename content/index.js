import esMX from './es-MX';

const LANGUAGES = [
  esMX,
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷', comingSoon: true },
];

export const getLanguages = () => LANGUAGES;

export const getLanguage = (code) => (
  LANGUAGES.find((lang) => lang.code === code && !lang.comingSoon) || esMX
);

export const getLessons = (code) => getLanguage(code).lessons;
