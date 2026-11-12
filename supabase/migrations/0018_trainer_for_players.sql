-- The trainer, as their players see them: a first name and a photo.
--
-- NOT APPLIED AUTOMATICALLY. Run it in the Supabase SQL editor (see DEPLOY.md),
-- after 0016. Safe to run twice. Until it runs, a player waiting for their
-- first week reads "Your trainer" and sees no photo.
--
-- Players can't read staff profiles (0004), and that stays. These two
-- functions hand a member of an academy its owner's first name and photo, and
-- nothing else: no email, no surname, no other profile field. The owner is
-- who a player means by "my trainer"; an academy with several trainers still
-- has one owner.
--
-- A trainer's photo was visible only to the trainer (0016). After this, their
-- own academy's members see it too. That is what it is for.

create or replace function public.academy_trainer(p_academy uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name',     nullif(split_part(trim(coalesce(p.display_name, '')), ' ', 1), ''),
    'photo_at', case when p.avatar_data is not null then p.avatar_updated_at end)
  from academy_members m left join profiles p on p.id = m.user_id
  where public.is_member(p_academy) and m.academy_id = p_academy and m.role = 'owner'
  order by m.joined_at
  limit 1;
$$;

create or replace function public.academy_trainer_photo(p_academy uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('type', p.avatar_type, 'data', p.avatar_data)
  from academy_members m join profiles p on p.id = m.user_id
  where public.is_member(p_academy) and m.academy_id = p_academy and m.role = 'owner'
    and p.avatar_type is not null and p.avatar_data is not null
  order by m.joined_at
  limit 1;
$$;

revoke all on function public.academy_trainer(uuid) from public, anon;
revoke all on function public.academy_trainer_photo(uuid) from public, anon;
grant execute on function public.academy_trainer(uuid) to authenticated;
grant execute on function public.academy_trainer_photo(uuid) to authenticated;
