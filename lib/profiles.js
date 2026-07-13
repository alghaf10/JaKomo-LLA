import { supabase } from './supabase';

const FRIEND_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const MAX_FRIEND_CODE_ATTEMPTS = 5;

const PROFILE_COLUMNS = 'user_id, first_name, avatar_id, friend_code, active_language, username, discoverable, level_estimate, goal, goal_date, daily_minutes, created_at';

// Keep in sync with the CHECK constraints and is_username_available in
// db/username_system.sql — these give instant client-side feedback; the DB
// is the enforcement.
export const USERNAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{2,19}$/;
export const RESERVED_USERNAMES = ['jakomo', 'admin', 'support', 'moderator'];

export const generateFriendCode = () => {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += FRIEND_CODE_CHARS[Math.floor(Math.random() * FRIEND_CODE_CHARS.length)];
  }
  return `JK-${code}`;
};

export const fetchProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.log('Error fetching profile:', error);
    return { data: null, error };
  }
  return { data, error: null };
};

const isUsernameUniqueViolation = (error) => (
  error?.code === '23505' && /username/i.test(error?.message || '')
);

export const createProfile = async ({ userId, firstName, avatarId, username }) => {
  let lastError = null;

  for (let attempt = 0; attempt < MAX_FRIEND_CODE_ATTEMPTS; attempt++) {
    const friendCode = generateFriendCode();
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        first_name: firstName,
        avatar_id: avatarId,
        friend_code: friendCode,
        username,
      })
      .select(PROFILE_COLUMNS)
      .single();

    if (!error) return { data, error: null };

    lastError = error;
    // A 23505 on the username index is a username race, not a friend-code
    // collision — regenerating friend codes won't fix it, so bail with a
    // flag the caller can turn into "pick another username".
    if (isUsernameUniqueViolation(error)) {
      return { data: null, error, usernameTaken: true };
    }
    if (error.code !== '23505') break; // not a unique-violation, don't retry
  }

  return { data: null, error: lastError };
};

export const updateAvatar = async (userId, avatarId) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_id: avatarId })
    .eq('user_id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  return { data, error };
};

// Uses maybeSingle(): if the caller has no profiles row yet (e.g. signup's
// profile insert was blocked by a pending email confirmation), this
// resolves with data: null instead of throwing — the "Complete your
// profile" flow will set active_language when the row is finally created.
export const updateActiveLanguage = async (userId, languageCode) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ active_language: languageCode })
    .eq('user_id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  return { data, error };
};

// Boolean-only by design (and by grant: callable pre-session during signup).
export const isUsernameAvailable = async (candidate) => {
  const { data, error } = await supabase.rpc('is_username_available', { candidate });
  if (error) return { available: false, error };
  return { available: Boolean(data), error: null };
};

// Returns null for both "no such user" and "not discoverable" — the two are
// indistinguishable by design (no existence leak).
export const findUserByUsername = async (candidate) => {
  const { data, error } = await supabase.rpc('find_user_by_username', { candidate });
  if (error) return { data: null, error };
  return { data: (data && data[0]) || null, error: null };
};

export const claimUsername = async (userId, username) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('user_id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error && isUsernameUniqueViolation(error)) {
    return { data: null, error, taken: true };
  }
  return { data, error };
};

export const updateDiscoverable = async (userId, discoverable) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ discoverable })
    .eq('user_id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  return { data, error };
};

export const updateOnboarding = async (userId, { levelEstimate, goal, goalDate, dailyMinutes }) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      level_estimate: levelEstimate,
      goal,
      goal_date: goalDate,
      daily_minutes: dailyMinutes,
    })
    .eq('user_id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  return { data, error };
};

// Social sign-in (Apple/Google) creates an auth user but no profiles row.
// ChooseUsername claims via UPDATE, which needs a row to exist — so a new
// social user gets a minimal row here (username/language/onboarding left
// null) the moment they first authenticate, and resolveAuthedRoute then
// routes them through ChooseUsername -> LanguageSelect -> Onboarding just
// like email signup. Called from App.js's route resolver so it's a single
// deterministic path with no race against the auth-state-change fetch.
export const ensureSocialProfile = async (session) => {
  const user = session?.user;
  const provider = user?.app_metadata?.provider;
  if (!user || (provider !== 'apple' && provider !== 'google')) {
    return { data: null, error: null, created: false };
  }

  const { data: existing } = await fetchProfile(user.id);
  if (existing) return { data: existing, error: null, created: false };

  const meta = user.user_metadata || {};
  const firstName = (meta.given_name || meta.name || meta.full_name || 'Friend')
    .toString().trim().split(' ')[0] || 'Friend';

  const { data, error } = await createProfile({ userId: user.id, firstName, avatarId: 1 });
  if (error) {
    console.log('Error creating social profile:', error);
    return { data: null, error, created: false };
  }
  return { data, error: null, created: true };
};

// Single source of truth for the first-run gating chain. Precedence matches
// the required order: username -> language -> onboarding -> app. Used by
// App.js (initial route), ChooseUsername, LanguageSelect, and the onboarding
// summary so every hand-off agrees. A profile that has already cleared a
// step (e.g. an onboarded user changing language) never re-enters it.
export const resolveAuthedRoute = (profile) => {
  if (!profile) return 'MainTabs'; // no row yet (legacy) — don't trap; other flows handle it
  if (!profile.username) return 'ChooseUsername';
  if (!profile.active_language) return 'LanguageSelect';
  if (!profile.level_estimate) return 'Onboarding';
  return 'MainTabs';
};
