-- Fix for group_messages soft-delete (Phase 5 chat moderation).
--
-- Symptom: sender/owner could never set deleted_at on a message via a plain
-- UPDATE, and even after fixing that, the resulting UPDATE event never
-- reached other group members over realtime.
--
-- Root causes (both confirmed empirically against a live DB, not assumed):
--
-- 1. The original "moderate" UPDATE policy had a USING clause but no
--    WITH CHECK. Postgres RLS does NOT fall back to reusing the UPDATE
--    policy's own USING clause as the WITH CHECK in this situation -- when
--    the table also has a SELECT policy, the resulting row must independently
--    satisfy that SELECT policy too, regardless of what the UPDATE policy's
--    own check says. "read chat" required deleted_at IS NULL, so any write
--    that set deleted_at to non-null was rejected for everyone, including
--    the sender and the owner. Adding an explicit WITH CHECK to "moderate"
--    (tested first) did NOT fix this, because the SELECT-policy requirement
--    is enforced independently of the UPDATE policy's own check -- proven via
--    an isolated reproduction with a scratch table before and after adding
--    an explicit WITH CHECK.
--
--    Fix: move the soft-delete write into a SECURITY DEFINER RPC that does
--    its own sender/owner authorization check and writes as its owner,
--    sidestepping the SELECT-policy conflict entirely. lib/chat.js's
--    softDeleteMessage now calls this RPC instead of a raw UPDATE.
--
-- 2. Even after the write succeeded (via the RPC), Realtime's
--    postgres_changes authorization for the UPDATE event is evaluated
--    against the SELECT policy using the row's POST-change state. Since
--    deleted_at was now non-null, the row failed "read chat"'s
--    deleted_at IS NULL condition for every subscriber, so Realtime
--    silently dropped the broadcast -- no member ever saw the message
--    disappear live.
--
--    Fix: relax "read chat" to just check membership, not deleted_at.
--    The app's own queries (fetchRecentMessages/fetchOlderMessages in
--    lib/chat.js) already explicitly filter .is('deleted_at', null), so
--    deleted messages still never appear in normal fetches -- this only
--    changes what's visible to realtime and to anyone querying the table
--    directly. Trade-off: a member could see a soft-deleted message's
--    content via a direct REST query, where before RLS hid it outright.
--    Accepted as low-risk for a group chat feature with no other RLS-only
--    protection against similar client-side-only filtering (e.g. blocked
--    users' messages are also only filtered client-side, not via RLS).

-- Part 1: soft-delete RPC (sender or group owner only).
create or replace function public.soft_delete_group_message(message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg record;
begin
  select gm.sender_id, gm.group_id, g.owner_id
  into msg
  from group_messages gm
  join groups g on g.id = gm.group_id
  where gm.id = message_id;

  if msg is null then
    raise exception 'Message not found';
  end if;

  if msg.sender_id != auth.uid() and msg.owner_id != auth.uid() then
    raise exception 'Not authorized to delete this message';
  end if;

  update group_messages set deleted_at = now() where id = message_id;
end;
$$;

grant execute on function public.soft_delete_group_message(uuid) to authenticated;

-- Part 2: relax the SELECT policy so deletions propagate live to members.
drop policy if exists "read chat" on public.group_messages;

create policy "read chat" on public.group_messages
for select
using (is_member(group_id));

-- Part 3 (kept for defense-in-depth / documentation, though the app no
-- longer performs soft-deletes through a raw UPDATE): "moderate" now has
-- an explicit WITH CHECK matching its USING clause, so at least the
-- write-permission half of the policy is internally consistent even
-- though the SELECT-policy interaction above means it alone was never
-- sufficient for soft-deletes.
drop policy if exists "moderate" on public.group_messages;

create policy "moderate" on public.group_messages
for update
using (
  sender_id = auth.uid()
  or auth.uid() = (select owner_id from public.groups where groups.id = group_messages.group_id)
)
with check (
  sender_id = auth.uid()
  or auth.uid() = (select owner_id from public.groups where groups.id = group_messages.group_id)
);
