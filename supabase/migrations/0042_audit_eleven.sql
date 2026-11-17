-- 0042: the eleventh audit.
--
--   player_trials        The day each player first joined an academy. Their
--                        free days count from it, so leaving and joining
--                        again doesn't start them over. Kept when they
--                        leave; goes with the account.
--   player_billing.price_cents  What a family's own subscription charges.
--                        A price changed since is for new families, and the
--                        ones already paying were shown the new one.
--   academy_trainer      Says whose account the trainer is, so a note gets
--                        the owner's photo only when the owner wrote it.
--   The billing functions (0037 to 0041) are taken from the signed-out
--   role as the earlier ones are. Each already refuses anyone who isn't
--   staff or an admin; this is the same door closed twice.
--
-- Run after the app that uses these is deployed (it reads the day they
-- joined this time, and the academy's price, until this runs).
--
-- Safe to run more than once.

create table if not exists player_trials (
  academy_id uuid not null references academies(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  primary key (academy_id, user_id)
);

alter table player_trials enable row level security;
revoke all on player_trials from anon, authenticated;
grant select on player_trials to authenticated;

drop policy if exists "player trials read" on player_trials;
create policy "player trials read" on player_trials for select
  using (user_id = auth.uid() or public.is_staff(academy_id) or public.is_admin());

-- Everyone already here: from the day they joined.
insert into player_trials (academy_id, user_id, started_at)
  select academy_id, user_id, joined_at from academy_members where role = 'player'
  on conflict (academy_id, user_id) do nothing;

-- And everyone from now on, the first time only.
create or replace function public.note_player_trial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'player' then
    insert into player_trials (academy_id, user_id, started_at)
      values (new.academy_id, new.user_id, coalesce(new.joined_at, now()))
      on conflict (academy_id, user_id) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists academy_members_trial on academy_members;
create trigger academy_members_trial after insert on academy_members
  for each row execute function public.note_player_trial();

-- ------------------------------------------------------------------------
alter table player_billing add column if not exists price_cents int;

-- ------------------------------------------------------------------------
revoke all on function public.admin_set_free_until(uuid, date) from anon;
revoke all on function public.admin_set_player_pay(uuid, boolean, int, int) from anon;
revoke all on function public.admin_set_billing(uuid, text, int, int) from anon;
revoke all on function public.set_player_active(uuid, uuid, boolean) from anon;
revoke all on function public.set_player_paid(uuid, uuid, boolean) from anon;
revoke all on function public.admin_inactive(uuid, uuid[]) from anon;

-- ------------------------------------------------------------------------
-- As 0018, with whose it is: a note is given the owner's photo only when
-- the owner wrote it. It went by first name, so a second trainer with the
-- same first name wore the owner's face.
create or replace function public.academy_trainer(p_academy uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id',       m.user_id,
    'name',     nullif(split_part(trim(coalesce(p.display_name, '')), ' ', 1), ''),
    'photo_at', case when p.avatar_data is not null then p.avatar_updated_at end)
  from academy_members m left join profiles p on p.id = m.user_id
  where public.is_member(p_academy) and m.academy_id = p_academy and m.role = 'owner'
  order by m.joined_at
  limit 1;
$$;
revoke all on function public.academy_trainer(uuid) from public, anon;
grant execute on function public.academy_trainer(uuid) to authenticated;
