-- 0012: weeks that build on each other.
--
--   - How a session felt, from the player: easy, about right, hard. With
--     which drills they actually ticked, it's what steps a drill up or holds
--     it.
--   - A step per drill in a built session (more reps, longer), and whether
--     the week was a lighter one.
--   - A drill can name its harder version, which takes over when the drill
--     has been stepped up as far as it goes.
--
-- Run after 0011. Safe to run twice.

alter table workouts add column if not exists feel text check (feel is null or feel in ('easy', 'right', 'hard'));
-- Trainer sessions had no record of which drills were ticked: drill ids as served.
alter table workouts add column if not exists done_ids text[];

alter table player_week_sessions add column if not exists steps smallint[] not null default '{}';
alter table player_week_sessions add column if not exists light boolean not null default false;
-- Per drill, against last week: new, same, up, harder, hold. For the labels.
alter table player_week_sessions add column if not exists changes text[] not null default '{}';

alter table drills add column if not exists harder_id uuid references drills(id) on delete set null;
alter table drills drop constraint if exists drills_harder_not_self;
alter table drills add constraint drills_harder_not_self check (harder_id is null or harder_id <> id);

-- As 0007, plus how it felt and what was ticked. The return type changes, so
-- it is dropped and made again.
drop function if exists public.academy_completions(uuid, timestamptz);
create function public.academy_completions(p_academy uuid, p_since timestamptz)
returns table (user_id uuid, source text, source_ref text, completed_at timestamptz, feel text, done_ids text[])
language sql stable security definer set search_path = public as $$
  select w.user_id, w.source, w.source_ref, w.completed_at, w.feel, w.done_ids
  from workouts w
  join academy_members m on m.user_id = w.user_id and m.academy_id = p_academy and m.role = 'player'
  where public.is_staff(p_academy)
    and w.status = 'completed' and w.source in ('academy', 'addon')
    and w.completed_at >= p_since;
$$;
revoke all on function public.academy_completions(uuid, timestamptz) from public;
grant execute on function public.academy_completions(uuid, timestamptz) to authenticated;
