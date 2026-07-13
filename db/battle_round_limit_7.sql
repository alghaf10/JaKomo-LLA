-- Battle round limit 5 -> 7.
--
-- The RPC's `limit` caps how many distinct questions can ever be generated
-- per battle (questions are drawn from the opponent's hard cards without
-- reuse). At 7 rounds with a 5-card limit, both players run dry after
-- question 5 and the battle deadlocks -- the tie only fires at 14 total
-- moves. Must be applied together with the judge-battle edge function
-- (MAX_MOVES_PER_PLAYER = 7) and the app (lib/battles.js) at the same value.
-- The client-side eligibility threshold also moves to 7 for the same reason.
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
    limit 7;
end;
$$;

grant execute on function get_hard_review_cards_for_battle(uuid, text) to authenticated;
