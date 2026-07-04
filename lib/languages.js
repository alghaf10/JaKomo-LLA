import esMX from '../content/es-MX';

export const LANGUAGES = [
  esMX,
  { code: 'ko-KR', name: 'Korean', flag: '🇰🇷', comingSoon: true },
];

export const getLanguage = (code) => (
  LANGUAGES.find((lang) => lang.code === code && !lang.comingSoon) || esMX
);
