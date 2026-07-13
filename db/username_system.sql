-- v3 Phase 1a: username system.
--
-- Usernames become the primary way to find friends; JK- friend codes keep
-- working as a secondary path. Uniqueness is case-insensitive, format is
-- enforced at the DB level (clients write username via a direct UPDATE on
-- their own profiles row, so RPC-only validation would not bind the write
-- path), and discoverability gates every search surface.

-- 1. Columns. username stays NULL until a user picks one (existing users
--    get a blocking chooser on next app open).
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists discoverable boolean not null default true;

-- 2. Format: 3-20 chars, letters/digits/underscore, must start with a letter.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z][A-Za-z0-9_]{2,19}$');

-- 3. Reserved words, also at the DB level for the same direct-write reason.
--    Keep this list in sync with is_username_available below and
--    RESERVED_USERNAMES in lib/profiles.js.
alter table public.profiles drop constraint if exists profiles_username_reserved;
alter table public.profiles add constraint profiles_username_reserved
  check (username is null or lower(username) not in ('jakomo', 'admin', 'support', 'moderator'));

-- 4. Case-insensitive uniqueness. NULLs never collide, so existing users
--    are unaffected until they choose.
create unique index if not exists profiles_username_lower_idx
on public.profiles (lower(username));

-- 5. public_profiles view rebuild.
--
--    !! RECREATING THIS VIEW DROPS ITS GRANTS — this has bitten us before.
--    The grants restored below are the complete set the app depends on:
--      - grant select to authenticated  (friend/member/opponent lookups,
--        JK- friend-code redemption)
--      - grant select to anon           (defensive: pre-session surfaces)
--    If you touch this view again, re-grant BOTH or every profile lookup
--    in the app silently returns permission errors.
--
--    username is exposed ONLY while discoverable: this view is freely
--    queryable by any authenticated user (that's how JK- lookup works), so
--    an unconditional username column would let a crafted client bypass
--    the discoverable gate in find_user_by_username by querying the view
--    directly. Hidden users' usernames read as NULL everywhere.
drop view if exists public.public_profiles;

create view public.public_profiles as
select
  user_id,
  first_name,
  avatar_id,
  friend_code,
  case when discoverable then username end as username
from public.profiles;

grant select on public.public_profiles to authenticated;
grant select on public.public_profiles to anon;

-- 6. Availability check. SECURITY DEFINER because it must work BEFORE the
--    caller can read other profiles — during signup there is no session at
--    all, hence the anon grant (same chicken-and-egg as find_group_by_code,
--    one step earlier).
--
--    !! BOOLEAN-ONLY FOREVER. This function is callable anonymously; it must
--    never return profile data or anything beyond taken/free. Do not extend
--    its return type.
create or replace function is_username_available(candidate text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(candidate));
begin
  if normalized !~ '^[a-z][a-z0-9_]{2,19}$' then
    return false;
  end if;

  if normalized in ('jakomo', 'admin', 'support', 'moderator') then
    return false;
  end if;

  return not exists (
    select 1 from profiles where lower(username) = normalized
  );
end;
$$;

grant execute on function is_username_available(text) to anon;
grant execute on function is_username_available(text) to authenticated;

-- 7. Exact-match search. Zero rows for "doesn't exist" and "not
--    discoverable" alike — indistinguishable by design (no existence leak).
create or replace function find_user_by_username(candidate text)
returns table (user_id uuid, first_name text, avatar_id integer, friend_code text, username text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select p.user_id::uuid, p.first_name::text, p.avatar_id::integer,
           p.friend_code::text, p.username::text
    from profiles p
    where lower(p.username) = lower(trim(candidate))
      and p.discoverable;
end;
$$;

grant execute on function find_user_by_username(text) to authenticated;
