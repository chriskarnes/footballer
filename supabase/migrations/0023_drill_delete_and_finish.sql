-- 0023: deleting a drill takes it out of every session, and finishing setup
-- sets "listed" in the same statement.
--
--   delete_drill           Staff only. Takes the drill out of the library's
--                          sessions (the 0017 trigger carries that into the
--                          program weeks they're placed in), out of program
--                          sessions of their own, and out of players' built
--                          weeks (with its progression step), then deletes it.
--                          Refuses if that would leave a library or program
--                          session with no drills, naming them, so the trainer
--                          can change those first. A player's built session
--                          left empty is removed.
--   academy_setup_finish   Owner only. Marks setup done and sets listed to
--                          the owner's choice, in one update. academy_setup_mark
--                          ('done') always listed it, and a second write to
--                          unlist could fail and leave it listed.
--
-- Safe to run more than once.

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

  -- steps runs beside drill_ids, one per drill, and may be shorter (or empty):
  -- keep each remaining drill's own step.
  update player_week_sessions s
     set drill_ids = array(select d from unnest(s.drill_ids) with ordinality u(d, i)
                            where d <> p_drill order by i),
         steps = array(select s.steps[i::int] from unnest(s.drill_ids) with ordinality u(d, i)
                        where d <> p_drill and i <= cardinality(s.steps) order by i)
   where academy_id = a and p_drill = any(drill_ids);
  delete from player_week_sessions where academy_id = a and cardinality(drill_ids) = 0;

  delete from drills where id = p_drill;
end; $$;

create or replace function public.academy_setup_finish(p_academy uuid, p_listed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from academy_members where academy_id = p_academy
                 and user_id = auth.uid() and role = 'owner') then
    raise exception 'owner only';
  end if;
  update academies
     set setup = setup || jsonb_build_object('done', now()),
         listed = coalesce(p_listed, true)
   where id = p_academy;
end; $$;

revoke all on function public.delete_drill(uuid), public.academy_setup_finish(uuid, boolean) from public, anon;
grant execute on function public.delete_drill(uuid), public.academy_setup_finish(uuid, boolean) to authenticated;
