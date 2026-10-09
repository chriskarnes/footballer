/**
 * A finished session waiting for an account.
 *
 * Train needs no sign-in, so most first sessions are finished signed out. The
 * runner used to answer that with "Saved to your history" whatever the server
 * said. Now it keeps the session here and tells the player that signing in will
 * save it; <PendingWorkout /> sends it once they have.
 *
 * One slot, not a queue: it is "the session you just did", and a second
 * finished session replaces the first rather than piling up a backlog that
 * lands in someone's history all at once weeks later. It also expires, for the
 * same reason.
 *
 * localStorage belongs to one browser. A sign-in link opened in a different
 * one (a mail app's built-in browser, say) won't find it — the session is lost
 * there, which is no worse than before.
 */
const KEY = 'forge.pendingWorkout';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The body POST /api/workouts takes. */
export type WorkoutPayload = Record<string, unknown> & { completed_at?: string };

export function stashWorkout(payload: WorkoutPayload): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), payload }));
  } catch { /* private mode or storage blocked: the session just isn't kept */ }
}

export function peekWorkout(): WorkoutPayload | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { at, payload } = JSON.parse(raw);
    if (typeof at !== 'number' || Date.now() - at > MAX_AGE_MS) { clearWorkout(); return null; }
    return payload ?? null;
  } catch { return null; }
}

export function clearWorkout(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

let inflight: Promise<boolean> | null = null;

/**
 * Sends the waiting session, if there is one. Resolves true only when it was
 * saved. A 401 leaves it waiting; any other failure leaves it too, so a flaky
 * connection at sign-in doesn't throw away the session.
 */
export function flushWorkout(): Promise<boolean> {
  // One send at a time. Two overlapping calls — React mounting an effect twice
  // in development is the one that happens — would otherwise both succeed and
  // put the session in someone's history twice.
  inflight ??= send().finally(() => { inflight = null; });
  return inflight;
}

async function send(): Promise<boolean> {
  const payload = peekWorkout();
  if (!payload) return false;
  try {
    const res = await fetch('/api/workouts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    clearWorkout();
    return true;
  } catch { return false; }
}
