-- 0022: join requests tidy up after themselves.
--
-- 1. Joining with the invite link clears any request to join the same
--    academy: the trainer was being asked to let in someone already in.
-- 2. Letting someone in keeps the name they asked with as their name, when
--    they haven't given one: the trainer saw "Sam Jones" on the request and
--    then an email address on their roster.
--
-- Safe to run more than once.

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
  if existing is null then
    insert into academy_members (academy_id, user_id, role) values (inv.academy_id, auth.uid(), inv.role);
    existing := inv.role;
  elsif existing = 'player' and inv.role = 'trainer' then
    update academy_members set role = 'trainer' where academy_id = inv.academy_id and user_id = auth.uid();
    existing := 'trainer';
  end if;

  -- In now, so nothing left to ask; their name from the request, if they had none.
  insert into profiles (id, display_name)
    select auth.uid(), r.name from join_requests r
     where r.academy_id = inv.academy_id and r.user_id = auth.uid()
  on conflict (id) do update set display_name = coalesce(nullif(trim(profiles.display_name), ''), excluded.display_name);
  delete from join_requests where academy_id = inv.academy_id and user_id = auth.uid();

  return jsonb_build_object('academy_id', inv.academy_id, 'role', existing,
    'slug', (select slug from academies where id = inv.academy_id));
end; $$;

create or replace function public.answer_join_request(p_academy uuid, p_user uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  asked text;
begin
  if not public.is_staff(p_academy) then raise exception 'not staff'; end if;
  select name into asked from join_requests where academy_id = p_academy and user_id = p_user;
  if not found then raise exception 'no such request'; end if;
  if p_approve then
    insert into academy_members (academy_id, user_id, role) values (p_academy, p_user, 'player')
    on conflict do nothing;
    insert into profiles (id, display_name) values (p_user, asked)
    on conflict (id) do update set display_name = coalesce(nullif(trim(profiles.display_name), ''), excluded.display_name);
  end if;
  delete from join_requests where academy_id = p_academy and user_id = p_user;
end; $$;

-- Requests from people who have since joined by link, from before this ran.
delete from join_requests r using academy_members m
 where m.academy_id = r.academy_id and m.user_id = r.user_id;
