-- 0032: "Get started", a typo fixed by its own sender.
--
-- 0031 kept a second request for the same email from someone else, but then
-- compared a correction with only the newest request for that email: once
-- another sender had used it, the first sender's fix was stored as a third
-- request rather than updating theirs. Now a correction finds the sender's
-- own request from the last hour, whatever came in since.
--
-- Safe to run more than once.

create or replace function public.request_academy(
  p_name text, p_email text, p_academy_name text, p_slug text, p_city text,
  p_players text, p_trainers text, p_content text, p_message text, p_from text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  mine academy_requests;
begin
  if p_from is not null then
    -- A typo fixed by the same sender, before anyone has looked at it.
    select * into mine from academy_requests
     where lower(email) = lower(trim(p_email)) and sent_from = left(p_from, 100)
       and created_at > now() - interval '1 hour'
     order by created_at desc limit 1;
    if found then
      if mine.status = 'new' then
        update academy_requests set
          name = trim(p_name), academy_name = trim(p_academy_name), slug = nullif(lower(trim(p_slug)), ''),
          city = nullif(trim(p_city), ''), players = nullif(p_players, ''), trainers = nullif(p_trainers, ''),
          content = nullif(p_content, ''), message = nullif(trim(p_message), '')
         where id = mine.id;
      end if;
      return;
    end if;
  elsif exists (select 1 from academy_requests
                 where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour') then
    -- No telling who sent it: once an hour for an email is enough.
    return;
  end if;
  if (select count(*) from academy_requests where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too many requests';
  end if;
  insert into academy_requests (name, email, academy_name, slug, city, players, trainers, content, message, sent_from)
  values (trim(p_name), lower(trim(p_email)), trim(p_academy_name), nullif(lower(trim(p_slug)), ''),
          nullif(trim(p_city), ''), nullif(p_players, ''), nullif(p_trainers, ''), nullif(p_content, ''),
          nullif(trim(p_message), ''), left(p_from, 100));
end; $$;
revoke all on function public.request_academy(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_academy(text, text, text, text, text, text, text, text, text, text) to service_role;
