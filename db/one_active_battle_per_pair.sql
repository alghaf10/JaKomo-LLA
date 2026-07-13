-- One active battle per pair of users (duels).
--
-- battles doesn't store both user ids (only created_by); the pair lives as
-- two ROWS in battle_players, which no unique index can see directly. So:
-- a nullable pair_key column on battles holds the normalized pair
-- (least:greatest of the two user ids as text), set only for duels. The
-- partial unique index then covers pending/active battles. 'declined' is
-- deliberately NOT included even though it's "non-finished" -- a declined
-- challenge must never block a new one.
--
-- Run order matters: add column -> backfill -> clean up pre-existing
-- duplicates (test accounts have battled repeatedly; the index would fail
-- to build over them) -> create index -> update the creation RPC.

-- 1. Pair column, duels only (stays NULL for future group battles -- NULLs
--    never collide in a unique index).
alter table public.battles add column if not exists pair_key text;

-- 2. Backfill existing duels from their battle_players rows.
update public.battles b
set pair_key = p.pair_key
from (
  select battle_id, min(user_id::text) || ':' || max(user_id::text) as pair_key
  from public.battle_players
  group by battle_id
  having count(*) = 2
) p
where p.battle_id = b.id
  and b.group_id is null
  and b.pair_key is null;

-- 3. Cleanup: for each pair with multiple pending/active battles, keep the
--    newest and finish the older ones (winner_side stays NULL -> they read
--    as ties in the app; no points involved since points only ever come
--    from the edge function's win path).
update public.battles b
set status = 'finished'
where b.status in ('pending', 'active')
  and b.pair_key is not null
  and exists (
    select 1 from public.battles newer
    where newer.pair_key = b.pair_key
      and newer.status in ('pending', 'active')
      and (newer.created_at > b.created_at
        or (newer.created_at = b.created_at and newer.id > b.id))
  );

-- 4. The index. Partial: finished/declined battles never conflict.
create unique index if not exists one_active_battle_per_pair
on public.battles (pair_key)
where status in ('pending', 'active');

-- 5. Creation RPC now sets pair_key, pre-checks for an existing battle with
--    a friendly message, and converts the unique-violation race (two
--    simultaneous challenges) into the same message.
create or replace function create_battle_challenge(opponent_id uuid, battle_language text)
returns battles
language plpgsql
security definer
set search_path = public
as $$
declare
  are_friends boolean;
  new_battle battles;
  pair text;
begin
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = opponent_id)
        or (requester_id = opponent_id and addressee_id = auth.uid()))
  ) into are_friends;

  if not are_friends then
    raise exception 'Not authorized';
  end if;

  pair := least(auth.uid()::text, opponent_id::text) || ':' || greatest(auth.uid()::text, opponent_id::text);

  if exists (
    select 1 from battles
    where pair_key = pair and status in ('pending', 'active')
  ) then
    raise exception 'You already have an active battle with this friend';
  end if;

  begin
    insert into battles (mode, language, group_id, status, turn_user, created_by, pair_key)
    values ('async', battle_language, null, 'pending', null, auth.uid(), pair)
    returning * into new_battle;
  exception when unique_violation then
    raise exception 'You already have an active battle with this friend';
  end;

  insert into battle_players (battle_id, user_id, side) values
    (new_battle.id, auth.uid(), 1),
    (new_battle.id, opponent_id, 2);

  return new_battle;
end;
$$;

grant execute on function create_battle_challenge(uuid, text) to authenticated;
