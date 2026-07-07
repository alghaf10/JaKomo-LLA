import { supabase } from './supabase';

const GROUP_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const MAX_CODE_ATTEMPTS = 5;
const GROUP_COLUMNS = 'id, name, owner_id, join_code, is_public, created_at';

export const generateJoinCode = () => {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += GROUP_CODE_CHARS[Math.floor(Math.random() * GROUP_CODE_CHARS.length)];
  }
  return `GP-${code}`;
};

export const createGroup = async ({ ownerId, name, isPublic }) => {
  let lastError = null;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase
      .from('groups')
      .insert({ name, owner_id: ownerId, join_code: joinCode, is_public: isPublic })
      .select(GROUP_COLUMNS)
      .single();

    if (!error) {
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: data.id, user_id: ownerId });
      return { data, error: memberError || null };
    }

    lastError = error;
    if (error.code !== '23505') break;
  }

  return { data: null, error: lastError };
};

export const fetchMyGroups = async (userId) => {
  const { data: memberships, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (membershipError) return { data: [], error: membershipError };

  const groupIds = memberships.map((m) => m.group_id);
  if (groupIds.length === 0) return { data: [], error: null };

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select(GROUP_COLUMNS)
    .in('id', groupIds)
    .order('created_at', { ascending: false });

  if (groupsError) return { data: [], error: groupsError };

  const { data: allMembers, error: rosterError } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  if (rosterError) console.log('Error fetching member counts:', rosterError);

  const countByGroupId = {};
  (allMembers || []).forEach((m) => {
    countByGroupId[m.group_id] = (countByGroupId[m.group_id] || 0) + 1;
  });

  return {
    data: groups.map((g) => ({ ...g, memberCount: countByGroupId[g.id] ?? null })),
    error: null,
  };
};

export const searchPublicGroups = async (query) => {
  const { data, error } = await supabase
    .from('groups')
    .select(GROUP_COLUMNS)
    .eq('is_public', true)
    .ilike('name', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

// Bypasses the groups SELECT RLS (public OR member OR owner) via a
// SECURITY DEFINER RPC, so private groups can still be found by code.
export const findGroupByCode = async (code) => {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await supabase.rpc('find_group_by_code', { code: normalized });

  if (error) return { data: null, error };
  return { data: (data && data[0]) || null, error: null };
};

export const fetchMembership = async (groupId, userId) => {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  return { data, error };
};

export const joinGroup = async (groupId, userId) => {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId });

  if (error && error.code === '23505') return { error: null };
  return { error };
};

export const leaveGroup = async (groupId, userId) => {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  return { error };
};

export const fetchGroupById = async (groupId) => {
  const { data, error } = await supabase
    .from('groups')
    .select(GROUP_COLUMNS)
    .eq('id', groupId)
    .maybeSingle();

  return { data, error };
};

export const fetchGroupMemberRows = async (groupId) => {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

export const renameGroup = async (groupId, name) => {
  const { data, error } = await supabase
    .from('groups')
    .update({ name })
    .eq('id', groupId)
    .select(GROUP_COLUMNS)
    .single();

  return { data, error };
};

export const toggleGroupVisibility = async (groupId, isPublic) => {
  const { data, error } = await supabase
    .from('groups')
    .update({ is_public: isPublic })
    .eq('id', groupId)
    .select(GROUP_COLUMNS)
    .single();

  return { data, error };
};

export const deleteGroup = async (groupId) => {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  return { error };
};
