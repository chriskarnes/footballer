-- 0044: the under-13 rules (0043) kept by the database too, and a daily cap
-- on the emails asking a parent or guardian.
--
--   profiles_child_rules  A trigger on profiles, for writes made signed in
--                         (the app's own pages, or anyone's browser with the
--                         public key, which "own profile" lets write any
--                         column of their own row):
--                           - a player under 13 who isn't staff anywhere
--                             keeps no photo, club or area;
--                           - their age isn't raised past 12, or cleared,
--                             until a parent or guardian has agreed;
--                           - who signed up (player or parent), once said,
--                             stays said.
--                         The server's own key and the SQL editor aren't held
--                         to it: that's how an admin puts right an age chosen
--                         by mistake (admin → the person → Age).
--   profiles delete       Signed-in accounts can't delete their own profile
--                         row any more. Nothing in the app did; deleting it and
--                         making it again was a way round the age rule.
--                         Deleting the account still removes it.
--   parent_consents       requests_sent and requests_since: how many request
--                         emails an account has sent since when, so asking
--                         can't be used to email strangers.
--
-- Run after the app that uses these is deployed. Safe to run more than once.

alter table parent_consents add column if not exists requests_sent int not null default 0;
alter table parent_consents add column if not exists requests_since timestamptz;

create or replace function public.profiles_child_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  young constant text[] := array['u10', '10_12'];
begin
  -- Only writes made signed in. The server's own key (service_role) and the
  -- SQL editor (no role at all) are trusted.
  if coalesce(auth.role(), '') <> 'authenticated' then return new; end if;

  -- Said once: player or parent.
  if tg_op = 'UPDATE' and old.signed_up_by is not null then
    new.signed_up_by := old.signed_up_by;
  end if;

  -- A trainer or owner anywhere keeps their own photo and age as they like.
  if exists (select 1 from academy_members m where m.user_id = new.id and m.role in ('owner', 'trainer')) then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.age_band = any (young)
     and (new.age_band is null or not (new.age_band = any (young)))
     and not exists (select 1 from parent_consents c where c.user_id = new.id and c.agreed_at is not null) then
    raise exception 'a parent or guardian agrees first';
  end if;

  if new.age_band = any (young) then
    new.avatar_type := null;
    new.avatar_data := null;
    new.avatar_updated_at := null;
    new.region := null;
    new.club := null;
  end if;
  return new;
end $$;
revoke all on function public.profiles_child_rules() from public, anon, authenticated;

drop trigger if exists profiles_child_rules on profiles;
create trigger profiles_child_rules before insert or update on profiles
  for each row execute function public.profiles_child_rules();

revoke delete on profiles from anon, authenticated;
