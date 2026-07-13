// Pure client-side estimate — a lookup table, not an API call. Phase 2's
// AI plan will supersede this; for now it gives new users a realistic,
// encouraging number at the end of onboarding.

const BASE_WEEKS = {
  beginner: 16,
  some_words: 10,
  simple_conversations: 6,
};

const MINUTES_MULTIPLIER = {
  5: 1.5,
  10: 1.0,
  20: 0.7,
};

export const MINUTES_TIERS = [5, 10, 20];

export const estimateWeeks = (levelEstimate, dailyMinutes) => {
  const base = BASE_WEEKS[levelEstimate];
  const mult = MINUTES_MULTIPLIER[dailyMinutes];
  if (!base || !mult) return null;
  return Math.round(base * mult);
};

// Next tier up from the chosen minutes, or null if already at the top (20+).
export const suggestNextTier = (dailyMinutes) => {
  const idx = MINUTES_TIERS.indexOf(dailyMinutes);
  if (idx === -1 || idx === MINUTES_TIERS.length - 1) return null;
  return MINUTES_TIERS[idx + 1];
};
