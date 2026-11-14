-- 0028: the name given when asking to join is the one the trainer sees.
--
-- Every new account starts with the front of its email as its name (the
-- signup trigger in schema.sql). Letting someone in only filled the name
-- when there was none, so "Sam Rivera" typed into the request lost to
-- "srivera82". A name that is just the email's front now counts as none.
--
-- Also: the helpers that say which academy a session was for are for the
-- database's own functions, not for calling from the app.
--
-- Safe to run more than once.

revoke all on function public.session_academy(text, text) from authenticated;
revoke all on function public.elsewhere(uuid, text, text) from authenticated;

create or replace function public.placeholder_name(p_user uuid, p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select nullif(trim(coalesce(p_name, '')), '') is null
      or lower(trim(p_name)) = lower(split_part((select email from auth.users where id = p_user), '@', 1));
$$;
revoke all on function public.placeholder_name(uuid, text) from public, anon, authenticated;

-- As 0027, with the placeholder test.
create or replace function public.answer_join_request(p_academy uuid, p_user uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r join_requests;
begin
  if not public.is_staff(p_academy) then raise exception 'not staff'; end if;
  select * into r from join_requests where academy_id = p_academy and user_id = p_user and declined_at is null;
  if not found then raise exception 'no such request'; end if;
  if r.role = 'trainer' and public.academy_role(p_academy) is distinct from 'owner' then
    raise exception 'only the owner lets trainers in';
  end if;
  if p_approve then
    insert into academy_members (academy_id, user_id, role) values (p_academy, p_user, r.role)
    on conflict (academy_id, user_id) do update
      set role = case when excluded.role = 'trainer' and academy_members.role = 'player' then 'trainer' else academy_members.role end;
    if r.role = 'player' then
      insert into profiles (id, display_name, signed_up_by) values (p_user, r.name, r.as_who)
      on conflict (id) do update set
        display_name = case when public.placeholder_name(p_user, profiles.display_name)
                            then excluded.display_name else profiles.display_name end,
        signed_up_by = coalesce(profiles.signed_up_by, excluded.signed_up_by);
    end if;
    delete from join_requests where academy_id = p_academy and user_id = p_user;
  else
    update join_requests set declined_at = now() where academy_id = p_academy and user_id = p_user;
  end if;
end; $$;
revoke all on function public.answer_join_request(uuid, uuid, boolean) from public, anon;
grant execute on function public.answer_join_request(uuid, uuid, boolean) to authenticated;

-- As 0027, with the placeholder test where the player link lets them in.
create or replace function public.join_academy(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  inv academy_invites;
  existing text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from academy_invites where code = p_code;
  if not found then raise exception 'invite not found'; end if;

  select role into existing from academy_members where academy_id = inv.academy_id and user_id = auth.uid();

  if inv.role = 'trainer' and coalesce(existing, '') not in ('owner', 'trainer') then
    insert into join_requests (academy_id, user_id, name, role)
    values (inv.academy_id, auth.uid(),
            left(coalesce(nullif(trim((select display_name from profiles where id = auth.uid())), ''),
                          (select email from auth.users where id = auth.uid()), 'Trainer'), 80),
            'trainer')
    on conflict (academy_id, user_id) do update
      set role = 'trainer', declined_at = null, created_at = now();
    return jsonb_build_object('academy_id', inv.academy_id, 'role', 'asked',
      'slug', (select slug from academies where id = inv.academy_id));
  end if;

  if existing is null then
    insert into academy_members (academy_id, user_id, role) values (inv.academy_id, auth.uid(), 'player');
    existing := 'player';
  end if;

  insert into profiles (id, display_name)
    select auth.uid(), r.name from join_requests r
     where r.academy_id = inv.academy_id and r.user_id = auth.uid() and r.role = 'player'
  on conflict (id) do update set display_name = case when public.placeholder_name(auth.uid(), profiles.display_name)
                                                     then excluded.display_name else profiles.display_name end;
  delete from join_requests where academy_id = inv.academy_id and user_id = auth.uid() and role = 'player';

  return jsonb_build_object('academy_id', inv.academy_id, 'role', existing,
    'slug', (select slug from academies where id = inv.academy_id));
end; $$;
revoke all on function public.join_academy(text) from public, anon;
grant execute on function public.join_academy(text) to authenticated;
