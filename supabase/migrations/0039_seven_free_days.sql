-- 0039: a player's free days are 7, not 14.
--
-- The default for an academy that hasn't been given its own number. An
-- academy where families already pay keeps what it was set to, and so does
-- one given something other than 14 (a founding trainer's 90).
--
-- Safe to run more than once.

alter table academies alter column player_trial_days set default 7;
update academies set player_trial_days = 7
  where player_trial_days = 14 and billing_mode <> 'players_pay';
