-- 0013: step-ups are the trainer's call.
--
--   - Academy default: whether built weeks step drills up week to week
--     (with a lighter week every fourth). On unless turned off.
--   - Per player: on, off, or null to follow the academy.
--
-- Off, every built week starts fresh at each drill's own amount; the
-- trainer can still set any drill's step by hand.
--
-- Run after 0012. Safe to run twice.

alter table academy_plan_defaults add column if not exists progress boolean not null default true;
alter table player_plans add column if not exists progress boolean;
