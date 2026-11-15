-- 0033: the ninth audit.
--
--   academies          No longer listable with the public key: a visitor sees
--                      listed academies, and members and admins their own.
--                      An academy's face (name, colours, logo) is still
--                      public by its address, through academy_public and
--                      academy_logo, which is all a visitor's page needs.
--   admin_remove_member  Platform admins can take someone out of a
--                      self-serve space: it has no owner to do it.
--   academy_players    A trainer sees "Library session", not the licensed
--                      library's own session names, for training done
--                      somewhere with the library when their academy hasn't it.
--   request_academy    A sender writing again after an admin has looked at
--                      their request is stored as a new request, not dropped.
--
-- Run after the app that reads academies through academy_public is deployed
-- (it falls back to the table before this runs).
--
-- Safe to run more than once.

-- ------------------------------------------------------------------------
-- An academy's face, by its address: what its own pages show anyone.
create or replace function public.academy_public(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'slug', a.slug, 'name', a.name, 'time_zone', a.time_zone,
    'palette_id', a.palette_id, 'primary_color', a.primary_color, 'accent_color', a.accent_color,
    'logo_type', a.logo_type, 'updated_at', a.updated_at, 'library_access', a.library_access,
    'kind', a.kind, 'open', a.open)
  from academies a where a.slug = p_slug;
$$;
revoke all on function public.academy_public(text) from public;
grant execute on function public.academy_public(text) to anon, authenticated;

create or replace function public.academy_logo(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when a.logo_type is null or a.logo_data is null then null
              else jsonb_build_object('type', a.logo_type, 'data', a.logo_data) end
  from academies a where a.slug = p_slug;
$$;
revoke all on function public.academy_logo(text) from public;
grant execute on function public.academy_logo(text) to anon, authenticated;

-- Listing academies: the listed ones, your own, or all for an admin.
drop policy if exists "academy read" on academies;
create policy "academy read" on academies for select
  using (listed or public.academy_role(id) is not null or public.is_admin());

-- ------------------------------------------------------------------------
-- Taking someone out of a self-serve space. Their training stays theirs.
create or replace function public.admin_remove_member(p_academy uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  if not exists (select 1 from academies where id = p_academy and kind = 'self_serve') then
    raise exception 'not self-serve';
  end if;
  delete from academy_members where academy_id = p_academy and user_id = p_user and role = 'player';
  if not found then raise exception 'not a member'; end if;
end; $$;
revoke all on function public.admin_remove_member(uuid, uuid) from public, anon;
grant execute on function public.admin_remove_member(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------------
-- As 0025, but the licensed library's session names stay out of an academy
-- that doesn't have it.
create or replace function public.academy_players(p_academy uuid, p_since timestamptz, p_player uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  licensed boolean := coalesce((select library_access from academies where id = p_academy), false);
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
        select jsonb_agg(jsonb_build_object('weekday', d.weekday, 'slot', d.slot, 'kind', d.kind,
                                            'session_id', case when licensed then d.session_id end))
        from plan_days d where d.plan_id = pl.id), '[]'::jsonb),
      'last_done',    (select max(coalesce(w.completed_at, w.created_at)) from workouts w
                        where w.user_id = m.user_id and w.status = 'completed'
                          and not public.elsewhere(p_academy, w.source, w.source_ref)),
      'done',         coalesce((
        select jsonb_agg(jsonb_build_object(
          'at', coalesce(w.completed_at, w.created_at),
          'title', case when not licensed and w.source in ('library', 'coach') then 'Library session' else w.title end,
          'source', w.source,
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

-- ------------------------------------------------------------------------
-- As 0032, but a sender's own request that an admin has already looked at
-- isn't edited behind their back, and isn't dropped either: the new one is
-- stored beside it.
create or replace function public.request_academy(
  p_name text, p_email text, p_academy_name text, p_slug text, p_city text,
  p_players text, p_trainers text, p_content text, p_message text, p_from text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  mine academy_requests;
begin
  if p_from is not null then
    select * into mine from academy_requests
     where lower(email) = lower(trim(p_email)) and sent_from = left(p_from, 100)
       and created_at > now() - interval '1 hour'
     order by created_at desc limit 1;
    if found and mine.status = 'new' then
      -- A typo fixed by the same sender, before anyone has looked at it.
      update academy_requests set
        name = trim(p_name), academy_name = trim(p_academy_name), slug = nullif(lower(trim(p_slug)), ''),
        city = nullif(trim(p_city), ''), players = nullif(p_players, ''), trainers = nullif(p_trainers, ''),
        content = nullif(p_content, ''), message = nullif(trim(p_message), '')
       where id = mine.id;
      return;
    end if;
  elsif exists (select 1 from academy_requests
                 where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour') then
    -- No telling who sent it: once an hour for an email is enough.
    return;
  end if;
  if (select count(*) from academy_requests where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too many requests';
  end if;
  insert into academy_requests (name, email, academy_name, slug, city, players, trainers, content, message, sent_from)
  values (trim(p_name), lower(trim(p_email)), trim(p_academy_name), nullif(lower(trim(p_slug)), ''),
          nullif(trim(p_city), ''), nullif(p_players, ''), nullif(p_trainers, ''), nullif(p_content, ''),
          nullif(trim(p_message), ''), left(p_from, 100));
end; $$;
revoke all on function public.request_academy(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_academy(text, text, text, text, text, text, text, text, text, text) to service_role;
