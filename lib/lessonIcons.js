// UI-layer mapping: lesson id -> Ionicons name for the themed lesson badge.
// The content `.emoji` field is kept as data but is no longer rendered — this
// is the single place that decides a lesson's icon.
export const LESSON_ICONS = {
  'es-MX/numbers-1': 'calculator',
  'es-MX/letters-1': 'text-outline',
  'es-MX/food-1': 'restaurant',
  'es-MX/transport-1': 'bus',
  'es-MX/market-1': 'basket',
};

export const getLessonIconName = (lessonId) => LESSON_ICONS[lessonId] || 'book-outline';
