// JaKomo design system — single source of truth for the visual overhaul.
// NO hardcoded colors/sizes anywhere else once screens adopt this. Import the
// named constants below. The identity is WARM — neutrals lean brown/tan, never
// cold blue-gray. Tune the hexes here to re-skin the whole app.

export const colors = {
  // Primary brand gradient stops (coral -> pink -> purple). Appears on every
  // screen header. See `gradient` below for the assembled config.
  gradientCoral: '#F0997B',
  gradientPink: '#D4537E',
  gradientPurple: '#7F77DD',

  // Accents on light surfaces.
  accentCoral: '#D85A30', // darker coral — text/icons needing contrast on white
  accentCoralTint: 'rgba(216,90,48,0.12)', // faint coral wash for badges/highlights on light
  accentPink: '#D4537E', // lighter accent

  // Answer/result states — warm, harmonized with the coral/pink/purple family
  // (deliberately NOT iOS system green/red). Used for quiz/flashcard feedback.
  success: '#3E9E7A', // warm sage green
  successTint: 'rgba(62,158,122,0.15)',
  danger: '#BE3B39', // warm brick red (distinct from the orange coral accent)
  dangerTint: 'rgba(190,59,57,0.15)',

  // Surfaces.
  bg: '#FAF7F2', // warm off-white content background (not stark white)
  card: '#FFFFFF', // card surface

  // Warm neutrals (defined here so we can tune later — all brown-leaning):
  text: '#2B2420', // warm near-black for primary text
  textMuted: '#8A7D74', // warm gray for captions/secondary text
  border: '#E6DDD2', // warm light-gray hairline border

  // On-gradient (frosted glass) tokens for GlassButton / GradientHeader.
  glassFill: 'rgba(255,255,255,0.20)',
  glassBorder: 'rgba(255,255,255,0.55)',
  onGradient: '#FFFFFF', // text/icons on the gradient

  // Bottom tab bar (still dark/blur until its restyle wave).
  tabActive: '#FFFFFF',
  tabInactive: 'rgba(255,255,255,0.55)',
};

// expo-linear-gradient config matching CSS `linear-gradient(150deg, coral 0%,
// pink 55%, purple 100%)`. start/end were computed from the 150deg direction
// vector (dx=sin150=0.5, dy=-cos150=0.866) mapped into the unit square, so the
// coral starts top-left and purple lands bottom-right at a 150deg slope.
export const gradient = {
  colors: [colors.gradientCoral, colors.gradientPink, colors.gradientPurple],
  locations: [0, 0.55, 1],
  start: { x: 0.25, y: 0.067 },
  end: { x: 0.75, y: 0.933 },
};

// 12px radius everywhere — cards, buttons, tiles, inputs.
export const radius = 12;

// Spacing scale (multiples of 4).
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Two weights only, clean.
export const fontWeight = {
  regular: '400',
  medium: '500',
};

export const fontSize = {
  header: 22,
  body: 16,
  caption: 13,
};

export default { colors, gradient, radius, spacing, fontWeight, fontSize };
