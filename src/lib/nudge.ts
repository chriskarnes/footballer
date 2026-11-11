import type { Progress } from './progress';

/** A nudge written from what the dashboard knows about a player's week, for the trainer to edit. */
export function nudgeDraft(first: string, pr: Pick<Progress, 'daysSince' | 'due' | 'done'>): string {
  return pr.daysSince === null
    ? `Hi ${first}, your first session is waiting. Even 15 minutes today gets you started.`
    : pr.daysSince >= 7
      ? `Hi ${first}, haven’t seen you train in ${pr.daysSince} days. 15 minutes today is plenty to get going again.`
      : `Hi ${first}, you’re ${Math.max(1, pr.due - pr.done)} behind this week. Can you fit one in today?`;
}
