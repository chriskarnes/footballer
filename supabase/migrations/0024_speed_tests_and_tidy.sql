-- 0024: Speed test results on the account, deleting a drill keeps the
-- progression labels lined up, and 0020's functions locked down.
--
--   profiles.speed_tests          The player's Speed card (every test day), so
--                                 it follows them to another phone and their
--                                 trainer can see it. The app keeps a copy on
--                                 the phone too, for test day signed out.
--   academy_player_speed_tests    Staff only: one player's card, for the
--                                 trainer's player page.
--   delete_drill                  As 0023, but a player's built week also
--                                 drops the drill's entry from `changes`
--                                 ("Level up", "Next drill"), which runs beside
--                                 drill_ids like `steps` does. 0023 left it, so
--                                 every label after the deleted drill moved
--                                 onto the wrong one.
--   0020 grants                   claim_academy, approve_academy_request and
--                                 academy_setup_mark were granted to signed-in
--                                 users but never taken from public. Each
--                                 checks its caller, so nothing was exposed;
--                                 this matches 0023.
--
-- Safe to run more than once.

alter table profiles add column if not exists speed_tests jsonb;

create or replace function public.academy_player_speed_tests(p_academy uuid, p_player uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(p_academy) then raise exception 'staff only'; end if;
  if not exists (select 1 from academy_members where academy_id = p_academy and user_id = p_player) then
    return null;
  end if;
  return (select speed_tests from profiles where id = p_player);
end; $$;

revoke all on function public.academy_player_speed_tests(uuid, uuid) from public, anon;
grant execute on function public.academy_player_speed_tests(uuid, uuid) to authenticated;

create or replace function public.delete_drill(p_drill uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a uuid;
  emptied text;
begin
  select academy_id into a from drills where id = p_drill;
  if not found then return; end if;
  if not public.is_staff(a) then raise exception 'staff only'; end if;

  select string_agg(name, ', ' order by name) into emptied from (
    select name from library_sessions
     where academy_id = a and p_drill = any(drill_ids) and cardinality(array_remove(drill_ids, p_drill)) = 0
    union all
    select name from academy_sessions
     where academy_id = a and library_id is null and p_drill = any(drill_ids)
       and cardinality(array_remove(drill_ids, p_drill)) = 0
  ) s;
  if emptied is not null then
    raise exception 'only drill in: %', emptied using errcode = 'P0001';
  end if;

  update library_sessions set drill_ids = array_remove(drill_ids, p_drill)
   where academy_id = a and p_drill = any(drill_ids);
  update academy_sessions set drill_ids = array_remove(drill_ids, p_drill)
   where academy_id = a and library_id is null and p_drill = any(drill_ids);

  -- steps and changes run beside drill_ids, one per drill, and either may be
  -- shorter (or empty): keep each remaining drill's own entry.
  update player_week_sessions s
     set drill_ids = array(select d from unnest(s.drill_ids) with ordinality u(d, i)
                            where d <> p_drill order by i),
         steps = array(select s.steps[i::int] from unnest(s.drill_ids) with ordinality u(d, i)
                        where d <> p_drill and i <= cardinality(s.steps) order by i),
         changes = array(select s.changes[i::int] from unnest(s.drill_ids) with ordinality u(d, i)
                          where d <> p_drill and i <= cardinality(s.changes) order by i)
   where academy_id = a and p_drill = any(drill_ids);
  delete from player_week_sessions where academy_id = a and cardinality(drill_ids) = 0;

  delete from drills where id = p_drill;
end; $$;

revoke all on function public.delete_drill(uuid) from public, anon;
grant execute on function public.delete_drill(uuid) to authenticated;

revoke all on function public.claim_academy(text), public.approve_academy_request(uuid, text, text),
  public.academy_setup_mark(uuid, text) from public, anon;
grant execute on function public.claim_academy(text), public.approve_academy_request(uuid, text, text),
  public.academy_setup_mark(uuid, text) to authenticated;
