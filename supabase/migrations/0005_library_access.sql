-- Which academies see the bundled drill library.
--
-- NOT APPLIED AUTOMATICALLY. Run after 0004.
--
-- Everything in the library except Speed & Stamina is licensed content, for
-- the demo academy only. Every other academy starts with Speed and, later,
-- programs of its own. Off by default, so a new academy can never see it by
-- accident; only someone with database access turns it on.
alter table academies add column if not exists library_access boolean not null default false;
grant select (library_access) on academies to anon, authenticated;

update academies set library_access = true where slug = 'demo';
