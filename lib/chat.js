import { supabase } from './supabase';

const MESSAGE_COLUMNS = 'id, group_id, sender_id, body, created_at, deleted_at';
export const MESSAGE_PAGE_SIZE = 50;

export const fetchRecentMessages = async (groupId) => {
  const { data, error } = await supabase
    .from('group_messages')
    .select(MESSAGE_COLUMNS)
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

export const fetchOlderMessages = async (groupId, beforeCreatedAt) => {
  const { data, error } = await supabase
    .from('group_messages')
    .select(MESSAGE_COLUMNS)
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .lt('created_at', beforeCreatedAt)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  if (error) return { data: [], error };
  return { data: data || [], error: null };
};

export const sendMessage = async (groupId, senderId, body) => {
  const { data, error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, sender_id: senderId, body })
    .select(MESSAGE_COLUMNS)
    .single();

  return { data, error };
};

// A plain client-side UPDATE can never set deleted_at here: the table's
// SELECT policy (deleted_at IS NULL) independently gates the resulting row
// on UPDATE regardless of the UPDATE policy's own WITH CHECK, so the RPC
// does the sender/owner check itself and writes as its SECURITY DEFINER owner.
export const softDeleteMessage = async (messageId) => {
  const { error } = await supabase.rpc('soft_delete_group_message', { message_id: messageId });
  return { error };
};

export const reportMessage = async ({ reporterId, reportedUserId, messageId, reason }) => {
  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      message_id: messageId,
      reason,
    });

  return { error };
};

export const fetchMyBlockedIds = async (userId) => {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);

  if (error) return { data: [], error };
  return { data: (data || []).map((row) => row.blocked_id), error: null };
};

// Subscription lifecycle is intentionally isolated here: callers subscribe
// on focus and must unsubscribeFromGroupMessages on blur/unmount so no
// channels leak when navigating away from a chat.
export const subscribeToGroupMessages = (groupId, { onInsert, onUpdate }) => {
  const channel = supabase
    .channel(`group-messages-${groupId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
      (payload) => onInsert(payload.new),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
      (payload) => onUpdate(payload.new),
    )
    .subscribe((status, err) => {
      // TEMPORARY: remove once realtime delivery is confirmed working on-device.
      console.log(`[chat] group-messages-${groupId} subscription status:`, status, err || '');
    });

  return channel;
};

export const unsubscribeFromGroupMessages = (channel) => {
  if (channel) supabase.removeChannel(channel);
};
