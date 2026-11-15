-- 0031: the eighth audit.
--
--   library tables      The licensed (Forge) library is no longer readable
--                       with the public key. The app reads it on the server,
--                       after deciding this visitor may see it.
--   request_academy     Only the server calls it ("Get started"), so its
--                       limits can't be skipped by calling it directly. A
--                       second request for the same email from someone else
--                       is kept, not silently dropped.
--   request_to_join     A self-serve space has no one to ask.
--   play                Only the self-serve space may use that address.
--   admin_invite        Platform admins see, and can replace, a self-serve
--                       space's invite link: it has no owner to do it.
--
-- Run after the app that reads the library on the server is deployed (the
-- app falls back to its bundled copy either way). Needs
-- SUPABASE_SERVICE_ROLE_KEY on the server for "Get started" to keep working.
--
-- Safe to run more than once.

-- ------------------------------------------------------------------------
-- The library: no reads with the public key.
drop policy if exists "library read" on programs;
drop policy if exists "library read" on sessions;
drop policy if exists "library read" on exercises;
alter table programs  enable row level security;
alter table sessions  enable row level security;
alter table exercises enable row level security;
revoke all on table programs, sessions, exercises from anon, authenticated;

-- ------------------------------------------------------------------------
-- "Get started": server only. Same as 0029, except a recent request for the
-- same email from a different sender is stored too, so the real one isn't
-- lost to someone who typed that email first.
create or replace function public.request_academy(
  p_name text, p_email text, p_academy_name text, p_slug text, p_city text,
  p_players text, p_trainers text, p_content text, p_message text, p_from text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  recent academy_requests;
begin
  select * into recent from academy_requests
   where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour'
   order by created_at desc limit 1;
  if found and p_from is not null and recent.sent_from = p_from then
    -- A typo fixed by the same sender, before anyone has looked at it.
    if recent.status = 'new' then
      update academy_requests set
        name = trim(p_name), academy_name = trim(p_academy_name), slug = nullif(lower(trim(p_slug)), ''),
        city = nullif(trim(p_city), ''), players = nullif(p_players, ''), trainers = nullif(p_trainers, ''),
        content = nullif(p_content, ''), message = nullif(trim(p_message), '')
       where id = recent.id;
    end if;
    return;
  end if;
  -- The same sender twice, with no way to tell it's them: once is enough.
  if found and p_from is null then return; end if;
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
-- The 0026 version, if it's still there, goes the same way.
do $$ begin
  revoke all on function public.request_academy(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
exception when undefined_function then null; end $$;

-- ------------------------------------------------------------------------
-- As 0029, but a self-serve space isn't asked: its way in is its link, or
-- one tap once it's open.
create or replace function public.request_to_join(p_slug text, p_name text, p_message text default null, p_as text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  a uuid;
  who text := case when p_as in ('player', 'parent') then p_as end;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into a from academies where slug = p_slug;
  if a is null then raise exception 'academy not found'; end if;
  if (select kind from academies where id = a) = 'self_serve' then raise exception 'self-serve'; end if;
  if exists (select 1 from academy_members where academy_id = a and user_id = auth.uid()) then
    return 'member';
  end if;
  if exists (select 1 from join_requests where academy_id = a and user_id = auth.uid()
               and role = 'trainer' and declined_at is null) then
    return 'trainer_asked';
  end if;
  insert into join_requests (academy_id, user_id, name, message, as_who, role)
  values (a, auth.uid(), trim(p_name), nullif(trim(p_message), ''), who, 'player')
  on conflict (academy_id, user_id) do update
    set name = excluded.name, message = excluded.message, as_who = coalesce(excluded.as_who, join_requests.as_who),
        role = 'player', declined_at = null, created_at = now();
  if who is not null and not exists (
    select 1 from academy_members where user_id = auth.uid() and role in ('owner', 'trainer')
  ) then
    insert into profiles (id, signed_up_by) values (auth.uid(), who)
    on conflict (id) do update set signed_up_by = coalesce(profiles.signed_up_by, excluded.signed_up_by);
  end if;
  return 'requested';
end; $$;
revoke all on function public.request_to_join(text, text, text, text) from public, anon;
grant execute on function public.request_to_join(text, text, text, text) to authenticated;

-- Any requests already waiting on a self-serve space: no one could answer them.
delete from join_requests where academy_id in (select id from academies where kind = 'self_serve');

-- ------------------------------------------------------------------------
-- The address `play` is the self-serve space's, and no trainer's.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'academies_play_is_self_serve') then
    alter table academies add constraint academies_play_is_self_serve
      check (slug <> 'play' or kind = 'self_serve');
  end if;
end $$;

-- ------------------------------------------------------------------------
-- A self-serve space's invite link, for platform admins: read it, or
-- replace it (the old one stops working).
create or replace function public.admin_invite(p_academy uuid, p_rotate boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare
  c text;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  if not exists (select 1 from academies where id = p_academy and kind = 'self_serve') then
    raise exception 'not self-serve';
  end if;
  if p_rotate then
    c := public.new_invite_code();
    insert into academy_invites (code, academy_id, role) values (c, p_academy, 'player')
    on conflict (academy_id, role) do update set code = excluded.code, created_at = now();
    return c;
  end if;
  select code into c from academy_invites where academy_id = p_academy and role = 'player';
  return c;
end; $$;
revoke all on function public.admin_invite(uuid, boolean) from public, anon;
grant execute on function public.admin_invite(uuid, boolean) to authenticated;
