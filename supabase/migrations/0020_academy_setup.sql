-- Approving a trainer's request, the trainer claiming the academy, and the
-- setup checklist they work through after.
--
-- NOT APPLIED AUTOMATICALLY. Run it in the Supabase SQL editor after 0019.
-- Safe to run twice.
--
--   approve_academy_request  A platform admin approves a "Get started"
--                            request: the academy is made, unlisted and with
--                            no owner, and the request gets a claim code.
--   claim_preview            What /claim/<code> shows before sign-in.
--   claim_academy            The trainer, signed in with the email they asked
--                            with, becomes the owner.
--   academies.setup          Which setup steps the owner has marked done
--                            ({"you": ts, "done": ts}). The rest of the
--                            checklist is read from what the academy has in
--                            it. Academies that exist before this runs are
--                            marked done, so they never see the checklist.
--   academy_setup_mark       Marks one of those steps. "done" also lists the
--                            academy in Find your trainer.

-- ------------------------------------------------------------- REQUESTS ---
alter table academy_requests add column if not exists academy_id uuid references academies(id) on delete set null;
alter table academy_requests add column if not exists claim_code text unique
  check (claim_code is null or char_length(claim_code) >= 8);
alter table academy_requests add column if not exists claimed_at timestamptz;
-- approved: the academy is made and waiting to be claimed. set_up: claimed.
alter table academy_requests drop constraint if exists academy_requests_status_check;
alter table academy_requests add constraint academy_requests_status_check
  check (status in ('new','contacted','approved','set_up','declined'));

-- -------------------------------------------------------------- ACADEMY ---
-- Only the first run marks the academies already there as set up: a second
-- run must not mark one approved since.
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'academies' and column_name = 'setup') then
    alter table academies add column setup jsonb not null default '{}'::jsonb;
    update academies set setup = jsonb_build_object('done', now());
  end if;
end $$;
grant select (setup, listed) on academies to anon, authenticated;

-- ------------------------------------------------------------- APPROVE ---
-- Admins only. Makes the academy at p_slug (the request's, or one the admin
-- chose instead), unlisted until its trainer finishes setup, with its two
-- invite links, and no owner: the trainer becomes that by claiming it.
-- Approving the same request again returns what the first approval made.
create or replace function public.approve_academy_request(p_request uuid, p_slug text, p_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r academy_requests;
  a uuid;
  code text;
begin
  if not public.is_admin() then raise exception 'not an admin'; end if;
  select * into r from academy_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if r.academy_id is not null then
    return jsonb_build_object('slug', (select slug from academies where id = r.academy_id), 'code', r.claim_code);
  end if;
  if exists (select 1 from academies where slug = lower(trim(p_slug))) then
    raise exception 'address taken';
  end if;

  insert into academies (slug, name, city, listed)
  values (lower(trim(p_slug)), trim(p_name), r.city, false)
  returning id into a;
  insert into academy_invites (code, academy_id, role) values
    (public.new_invite_code(), a, 'player'), (public.new_invite_code(), a, 'trainer');
  code := public.new_invite_code();
  update academy_requests
     set academy_id = a, claim_code = code, status = 'approved',
         slug = lower(trim(p_slug)), academy_name = trim(p_name)
   where id = p_request;
  return jsonb_build_object('slug', lower(trim(p_slug)), 'code', code);
end; $$;

-- --------------------------------------------------------------- CLAIM ---
-- Before sign-in: the academy, and a hint at which email to use. Never the
-- email itself: the link can be forwarded.
create or replace function public.claim_preview(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug', a.slug, 'name', a.name, 'trainer', split_part(r.name, ' ', 1),
    'hint', left(r.email, 1) || '•••@' || split_part(r.email, '@', 2),
    'claimed', r.claimed_at is not null)
  from academy_requests r join academies a on a.id = r.academy_id
  where r.claim_code = p_code;
$$;

-- The signed-in account becomes the owner, if it's the email the request
-- came from. Claimed already by this account: nothing changes.
create or replace function public.claim_academy(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r academy_requests;
  me text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into r from academy_requests where claim_code = p_code for update;
  if not found or r.academy_id is null then raise exception 'claim not found'; end if;
  if r.claimed_at is not null then
    if exists (select 1 from academy_members where academy_id = r.academy_id
               and user_id = auth.uid() and role = 'owner') then
      return jsonb_build_object('slug', (select slug from academies where id = r.academy_id));
    end if;
    raise exception 'already claimed';
  end if;
  select lower(email) into me from auth.users where id = auth.uid();
  if me is distinct from lower(r.email) then raise exception 'wrong email'; end if;

  insert into academy_members (academy_id, user_id, role) values (r.academy_id, auth.uid(), 'owner')
  on conflict (academy_id, user_id) do update set role = 'owner';
  update academy_requests set claimed_at = now(), status = 'set_up' where id = r.id;
  return jsonb_build_object('slug', (select slug from academies where id = r.academy_id));
end; $$;

-- --------------------------------------------------------------- SETUP ---
create or replace function public.academy_setup_mark(p_academy uuid, p_step text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from academy_members where academy_id = p_academy
                 and user_id = auth.uid() and role = 'owner') then
    raise exception 'owner only';
  end if;
  if p_step not in ('you', 'done') then raise exception 'unknown step'; end if;
  update academies
     set setup = setup || jsonb_build_object(p_step, now()),
         listed = case when p_step = 'done' then true else listed end
   where id = p_academy;
end; $$;

grant execute on function public.claim_preview(text) to anon, authenticated;
grant execute on function public.claim_academy(text) to authenticated;
grant execute on function public.approve_academy_request(uuid, text, text) to authenticated;
grant execute on function public.academy_setup_mark(uuid, text) to authenticated;
