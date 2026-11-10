-- 0014: how a player's week is set, as one choice.
--
--   program  their group's program, or their own
--   custom   weeks the trainer builds from their targets
--   auto     custom, built each Monday without the trainer (Autopilot)
--
-- Null: not chosen yet; read as custom if they have a custom week, else
-- program. `autopilot` (0010) stays in step with mode = 'auto'.
--
-- Run after 0013. Safe to run twice.

alter table player_plans add column if not exists mode text;
alter table player_plans drop constraint if exists player_plans_mode_check;
alter table player_plans add constraint player_plans_mode_check check (mode is null or mode in ('program', 'custom', 'auto'));
