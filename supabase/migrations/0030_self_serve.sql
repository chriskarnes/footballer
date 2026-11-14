-- 0030: self-serve — training on your own, with no trainer.
--
-- An academy is a trainer's (the usual) or self-serve: the platform's own
-- space for players with no trainer, where Train's session builder, Library,
-- Plan and Speed are the whole app. There is one, at play.train.futbol.
--
--   kind   'trainer' or 'self_serve'.
--   open   anyone may join a self-serve space with one tap. Off, it's by
--          invite link only. It can't be on while the space holds the
--          licensed (Forge) library: that content is for private use.
--
-- Safe to run more than once.

alter table academies add column if not exists kind text not null default 'trainer';
alter table academies add column if not exists open boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'academies_kind_check') then
    alter table academies add constraint academies_kind_check check (kind in ('trainer', 'self_serve'));
  end if;
  -- Licensed content stays private: a space with it can't be opened to all.
  if not exists (select 1 from pg_constraint where conname = 'academies_open_only_unlicensed') then
    alter table academies add constraint academies_open_only_unlicensed
      check (not open or (kind = 'self_serve' and not library_access));
  end if;
end $$;
grant select (kind, open) on academies to anon, authenticated;

-- The platform's self-serve space. No owner: platform admins run it from
-- the admin panel. Unlisted (it isn't a trainer to find), and closed.
insert into academies (slug, name, kind, library_access, listed, open)
values ('play', 'Train.futbol', 'self_serve', true, false, false)
on conflict (slug) do nothing;

-- Players browse the library and have Speed; there's no trainer to set either.
insert into academy_plan_defaults (academy_id, player_library, player_speed)
select id, true, true from academies where slug = 'play'
on conflict (academy_id) do update set player_library = true, player_speed = true;

-- Its invite link, for sharing while it's closed.
insert into academy_invites (code, academy_id, role)
select public.new_invite_code(), id, 'player' from academies where slug = 'play'
on conflict (academy_id, role) do nothing;

-- ------------------------------------------------------------------------
-- One tap in, when a self-serve space is open. A trainer's academy, or a
-- closed space, needs its invite link as before.
create or replace function public.join_self_serve(p_slug text) returns text
language plpgsql security definer set search_path = public as $$
declare
  a academies;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into a from academies where slug = p_slug;
  if not found or a.kind <> 'self_serve' then raise exception 'not self-serve'; end if;
  if not a.open then raise exception 'not open'; end if;
  insert into academy_members (academy_id, user_id, role) values (a.id, auth.uid(), 'player')
  on conflict (academy_id, user_id) do nothing;
  return (select role from academy_members where academy_id = a.id and user_id = auth.uid());
end; $$;
revoke all on function public.join_self_serve(text) from public, anon;
grant execute on function public.join_self_serve(text) to authenticated;

-- Opening or closing a self-serve space: platform admins only.
create or replace function public.admin_set_open(p_academy uuid, p_open boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  update academies set open = p_open, updated_at = now() where id = p_academy and kind = 'self_serve';
  if not found then raise exception 'not self-serve'; end if;
end; $$;
revoke all on function public.admin_set_open(uuid, boolean) from public, anon;
grant execute on function public.admin_set_open(uuid, boolean) to authenticated;

-- Whether there is an open self-serve space, and where: for the main site's
-- "No trainer?" way in, shown only once there's somewhere to go.
create or replace function public.open_self_serve() returns text
language sql stable security definer set search_path = public as $$
  select slug from academies where kind = 'self_serve' and open order by created_at limit 1;
$$;
revoke all on function public.open_self_serve() from public;
grant execute on function public.open_self_serve() to anon, authenticated;
