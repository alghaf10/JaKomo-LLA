-- v3 Phase 1b: onboarding questions.
--
-- Four soft-preference columns collected in a one-time post-signup flow
-- (Level -> Goal -> Minutes -> Summary). They feed the profile now and drive
-- an AI-generated learning plan in Phase 2. No CHECKs: these are preferences,
-- not security boundaries, and 'goal' in particular holds free text when the
-- user picks "Other". All nullable — existing users get a blocking one-time
-- flow (routed on missing level_estimate), same pattern as ChooseUsername.

alter table public.profiles add column if not exists level_estimate text;  -- 'beginner' | 'some_words' | 'simple_conversations'
alter table public.profiles add column if not exists goal text;            -- 'trip' | 'family' | 'work' | 'fun' | free text
alter table public.profiles add column if not exists goal_date date;       -- only when goal = 'trip' and a date was picked
alter table public.profiles add column if not exists daily_minutes integer; -- 5 | 10 | 20
