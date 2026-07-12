-- Phase 6 (battles) DB changes.
--
-- 1. review_cards is self-scoped RLS ("read own cards": auth.uid() = user_id),
--    confirmed empirically with two disposable accounts before writing any
--    client code against it. That blocks two required behaviors: checking an
--    opponent's card count before allowing a challenge, and building a
--    question from their hard cards. Both need a SECURITY DEFINER bridge.
--    Scoped to accepted friends only, matching "challenge a friend from the
--    Friends list" -- not open to arbitrary cross-user querying.
create or replace function count_review_cards_for_battle(target_user_id uuid, target_language text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  are_friends boolean;
  card_count integer;
begin
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = target_user_id)
        or (requester_id = target_user_id and addressee_id = auth.uid()))
  ) into are_friends;

  if not are_friends then
    raise exception 'Not authorized';
  end if;

  select count(*) into card_count
  from review_cards
  where user_id = target_user_id and language = target_language;

  return card_count;
end;
$$;

grant execute on function count_review_cards_for_battle(uuid, text) to authenticated;

create or replace function get_hard_review_cards_for_battle(target_user_id uuid, target_language text)
returns table (phrase text, translation text, interval_days integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  are_friends boolean;
begin
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = target_user_id)
        or (requester_id = target_user_id and addressee_id = auth.uid()))
  ) into are_friends;

  if not are_friends then
    raise exception 'Not authorized';
  end if;

  return query
    select rc.phrase, rc.translation, rc.interval_days
    from review_cards rc
    where rc.user_id = target_user_id and rc.language = target_language
    order by rc.interval_days asc
    limit 5;
end;
$$;

grant execute on function get_hard_review_cards_for_battle(uuid, text) to authenticated;

-- 2. battle_players' own "see players" SELECT policy is self-referential --
--    its subquery filters battle_players by querying battle_players again,
--    which Postgres must evaluate via the same RLS policy, causing genuine
--    infinite recursion (confirmed empirically: "infinite recursion detected
--    in policy for relation battle_players" on the very first insert+select
--    of a battles row, since battles' own SELECT policy subqueries
--    battle_players). This breaks essentially everything battles-related.
--    Fix mirrors the is_member() pattern already used correctly elsewhere in
--    this schema for an identical membership-lookup shape: a SECURITY
--    DEFINER function breaks the recursion since its internal query runs
--    outside the caller's RLS context.
create or replace function is_battle_participant(target_battle_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from battle_players
    where battle_id = target_battle_id and user_id = auth.uid()
  );
$$;

drop policy if exists "see players" on public.battle_players;

create policy "see players" on public.battle_players
for select
using (is_battle_participant(battle_id));

-- 3. battle_players "join battle" INSERT policy is self-insert-only
--    (user_id = auth.uid()), but the game rules require the CHALLENGER to
--    create both battle_players rows at challenge time (their own side 1
--    AND the opponent's side 2) -- the opponent hasn't acted yet, so they
--    can't self-insert. A multi-row insert containing a row that fails
--    WITH CHECK is rejected in full (confirmed empirically: challenger's own
--    row silently never landed either, since the whole statement aborted),
--    which cascaded into "Not a participant" everywhere downstream. Fix:
--    one RPC that atomically creates the battle and both player rows,
--    scoped to accepted friends only, matching "challenge a friend from the
--    Friends list."
create or replace function create_battle_challenge(opponent_id uuid, battle_language text)
returns battles
language plpgsql
security definer
set search_path = public
as $$
declare
  are_friends boolean;
  new_battle battles;
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

  insert into battles (mode, language, group_id, status, turn_user, created_by)
  values ('async', battle_language, null, 'pending', null, auth.uid())
  returning * into new_battle;

  insert into battle_players (battle_id, user_id, side) values
    (new_battle.id, auth.uid(), 1),
    (new_battle.id, opponent_id, 2);

  return new_battle;
end;
$$;

grant execute on function create_battle_challenge(uuid, text) to authenticated;

-- 4. battles "play" UPDATE policy had no WITH CHECK, meaning any participant
--    could directly PATCH status='finished' and winner_side, bypassing the
--    judge-battle edge function entirely. Points weren't at risk (points_history
--    has no client insert policy), but the win/loss record itself was
--    forgeable. This WITH CHECK blocks that while leaving every legitimate
--    client-driven transition (accept, decline, turn-flip) untouched, since
--    none of them set winner_side or status='finished'.
drop policy if exists "play" on public.battles;

create policy "play" on public.battles
for update
using (
  exists (
    select 1 from battle_players
    where battle_players.battle_id = battles.id and battle_players.user_id = auth.uid()
  )
)
with check (
  winner_side is null
  and status <> 'finished'
);
