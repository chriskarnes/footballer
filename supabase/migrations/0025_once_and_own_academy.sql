-- 0025: a finished session saved once, however often the phone sends it.
--
--   workouts.client_id    The phone's own id for one finish. A save that
--                         reached us but whose answer was lost to the signal
--                         is sent again; the unique index turns the second
--                         copy into an error the app answers with the first
--                         one's id, so it isn't counted twice.
--
-- Safe to run more than once.

alter table workouts add column if not exists client_id uuid;
create unique index if not exists workouts_user_client
  on workouts (user_id, client_id) where client_id is not null;
