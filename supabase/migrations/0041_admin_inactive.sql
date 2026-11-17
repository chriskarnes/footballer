-- 0041: the admin panel can see who has been switched off.
--
-- A trainer can make a player inactive (0040): still on the roster, not
-- training, not charged for. The admin panel's reads (0026) were written
-- before that and don't say so.
--
--   admin_inactive   The memberships that are switched off: in one academy,
--                    for a list of accounts, or both. Platform admins only.
--
-- Safe to run more than once.

create or replace function public.admin_inactive(p_academy uuid default null, p_users uuid[] default null)
returns table (academy_id uuid, user_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return query
    select m.academy_id, m.user_id from academy_members m
    where not m.active
      and (p_academy is null or m.academy_id = p_academy)
      and (p_users is null or m.user_id = any(p_users));
end; $$;
revoke all on function public.admin_inactive(uuid, uuid[]) from public;
grant execute on function public.admin_inactive(uuid, uuid[]) to authenticated;
