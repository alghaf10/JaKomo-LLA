import { supabase } from './supabase';

const FRIEND_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const MAX_FRIEND_CODE_ATTEMPTS = 5;

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
    .select('user_id, first_name, avatar_id, friend_code, active_language, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.log('Error fetching profile:', error);
    return { data: null, error };
  }
  return { data, error: null };
};

export const createProfile = async ({ userId, firstName, avatarId }) => {
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
      })
      .select('user_id, first_name, avatar_id, friend_code, active_language, created_at')
      .single();

    if (!error) return { data, error: null };

    lastError = error;
    if (error.code !== '23505') break; // not a unique-violation, don't retry
  }

  return { data: null, error: lastError };
};

export const updateAvatar = async (userId, avatarId) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_id: avatarId })
    .eq('user_id', userId)
    .select('user_id, first_name, avatar_id, friend_code, active_language, created_at')
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
    .select('user_id, first_name, avatar_id, friend_code, active_language, created_at')
    .maybeSingle();

  return { data, error };
};
