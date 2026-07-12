import { supabase } from './supabase';

const PUBLIC_PROFILE_COLUMNS = 'user_id, first_name, avatar_id, friend_code';
const FRIENDSHIP_COLUMNS = 'id, requester_id, addressee_id, status, created_at';

export const lookupProfileByFriendCode = async (code) => {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await supabase
    .from('public_profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('friend_code', normalized)
    .maybeSingle();

  return { data, error };
};

export const fetchPublicProfiles = async (userIds) => {
  if (userIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from('public_profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .in('user_id', userIds);

  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

export const fetchFriendshipBetween = async (userIdA, userIdB) => {
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_COLUMNS)
    .or(`and(requester_id.eq.${userIdA},addressee_id.eq.${userIdB}),and(requester_id.eq.${userIdB},addressee_id.eq.${userIdA})`)
    .maybeSingle();

  return { data, error };
};

export const sendFriendRequest = async (requesterId, addresseeId) => {
  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
    .select(FRIENDSHIP_COLUMNS)
    .single();

  return { data, error };
};

export const acceptFriendRequest = async (friendshipId) => {
  const { data, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .select(FRIENDSHIP_COLUMNS)
    .single();

  return { data, error };
};

export const deleteFriendship = async (friendshipId) => {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  return { error };
};

export const fetchIncomingRequests = async (userId) => {
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_COLUMNS)
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

export const fetchOutgoingRequests = async (userId) => {
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_COLUMNS)
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

export const fetchAcceptedFriendships = async (userId) => {
  const { data, error } = await supabase
    .from('friendships')
    .select(FRIENDSHIP_COLUMNS)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

export const blockUser = async (blockerId, blockedId) => {
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  return { error };
};

export const fetchIncomingRequestCount = async (userId) => {
  const { count, error } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('addressee_id', userId)
    .eq('status', 'pending');

  return { count: count || 0, error };
};

export const fetchBlockedUsers = async (userId) => {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);

  if (error) return { data: [], error };
  return { data: (data || []).map((row) => row.blocked_id), error: null };
};

export const unblockUser = async (blockerId, blockedId) => {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  return { error };
};
