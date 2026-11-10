-- Whose email an account is: the player's own, or a parent signing up for
-- their child. Asked on the join page; null for accounts made before it was.
--
-- NOT APPLIED AUTOMATICALLY. Paste into the Supabase SQL editor. Until it
-- runs, the join page still works and the answer is dropped.

alter table profiles add column if not exists signed_up_by text;
alter table profiles drop constraint if exists profiles_signed_up_by_check;
alter table profiles add  constraint profiles_signed_up_by_check
  check (signed_up_by is null or signed_up_by in ('player', 'parent'));
