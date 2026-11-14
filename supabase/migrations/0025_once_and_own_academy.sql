-- 0025: a finished session saved once, however often the phone sends it,
-- and a trainer sees only their own academy's sessions.
--
--   workouts.client_id    The phone's own id for one finish. A save that
--                         reached us but whose answer was lost to the signal
--                         is sent again; the unique index turns the second
--                         copy into an error the app answers with the first
--                         one's id, so it isn't counted twice.
--   academy_players       Leaves out sessions done for another academy (below).
--
-- Safe to run more than once.

alter table workouts add column if not exists client_id uuid;
create unique index if not exists workouts_user_client
  on workouts (user_id, client_id) where client_id is not null;

-- ------------------------------------------------------------------------
-- academy_players: a trainer sees what was done for their academy, not
-- another one's. A player in two academies (a club trainer and a private
-- one) did trainer sessions for each; each trainer saw both, titles and all.
-- Now a session whose source is another academy's session, built week or
-- extra is left out. Their own training (library, Speed, free sessions)
-- isn't any academy's, and is still shown: it's how a trainer knows they're
-- training. A session since deleted still counts here (it was this one's).
-- Otherwise as 0004.

create or replace function public.elsewhere(p_academy uuid, p_source text, p_ref text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_source, '') in ('academy', 'addon') and p_ref is not null and (
    exists (select 1 from academy_sessions s where s.id::text = p_ref and s.academy_id <> p_academy)
    or exists (select 1 from player_week_sessions s where s.id::text = p_ref and s.academy_id <> p_academy)
    or exists (select 1 from addons a where a.id::text = p_ref and a.academy_id <> p_academy));
$$;
revoke all on function public.elsewhere(uuid, text, text) from public, anon;

create or replace function public.academy_players(p_academy uuid, p_since timestamptz, p_player uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(p_academy) then raise exception 'not staff'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id',      m.user_id,
      'joined_at',    m.joined_at,
      'email',        u.email,
      'display_name', p.display_name,
      'positions',    p.positions,
      'age_band',     p.age_band,
      'plan_name',    pl.name,
      'plan_days',    coalesce((
        select jsonb_agg(jsonb_build_object('weekday', d.weekday, 'slot', d.slot, 'kind', d.kind, 'session_id', d.session_id))
        from plan_days d where d.plan_id = pl.id), '[]'::jsonb),
      'last_done',    (select max(coalesce(w.completed_at, w.created_at)) from workouts w
                        where w.user_id = m.user_id and w.status = 'completed'
                          and not public.elsewhere(p_academy, w.source, w.source_ref)),
      'done',         coalesce((
        select jsonb_agg(jsonb_build_object(
          'at', coalesce(w.completed_at, w.created_at), 'title', w.title, 'source', w.source,
          'minutes', coalesce(w.actual_minutes, w.planned_minutes),
          'touches', coalesce(w.actual_touches, w.planned_touches))
          order by coalesce(w.completed_at, w.created_at) desc)
        from workouts w
        where w.user_id = m.user_id and w.status = 'completed'
          and coalesce(w.completed_at, w.created_at) >= p_since
          and not public.elsewhere(p_academy, w.source, w.source_ref)), '[]'::jsonb)
    ))
    from academy_members m
    join auth.users u on u.id = m.user_id
    left join profiles p on p.id = m.user_id
    left join lateral (select id, name from plans where user_id = m.user_id and active
                       order by created_at desc limit 1) pl on true
    where m.academy_id = p_academy and m.role = 'player'
      and (p_player is null or m.user_id = p_player)
  ), '[]'::jsonb);
end; $$;

revoke all on function public.academy_players(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.academy_players(uuid, timestamptz, uuid) to authenticated;
