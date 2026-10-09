/**
 * Work done signed out, waiting for an account.
 *
 * Train and Plan need no sign-in, so a first session — or a first week — is
 * usually made signed out. Rather than claim it was saved, or tell the player
 * it will be gone tomorrow, it is kept here and <PendingSaves /> sends it once
 * there is an account to send it to.
 *
 * One slot per kind, not a queue: it is "the session you just did" and "the
 * week you just built". A second one replaces the first rather than piling up
 * a backlog that lands in someone's account all at once weeks later. Each also
 * expires, for the same reason.
 *
 * localStorage belongs to one browser. A sign-in link opened in a different
 * one (a mail app's built-in browser, say) won't find it — the work is lost
 * there, which is no worse than before.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The body the endpoint's POST takes. */
export type Payload = Record<string, unknown>;

function slot(key: string, endpoint: string) {
  function clear(): void {
    try { localStorage.removeItem(key); } catch { /* nothing to clear */ }
  }

  function peek(): Payload | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { at, payload } = JSON.parse(raw);
      if (typeof at !== 'number' || Date.now() - at > MAX_AGE_MS) { clear(); return null; }
      return payload ?? null;
    } catch { return null; }
  }

  function stash(payload: Payload): void {
    try {
      localStorage.setItem(key, JSON.stringify({ at: Date.now(), payload }));
    } catch { /* private mode or storage blocked: it just isn't kept */ }
  }

  async function send(): Promise<boolean> {
    const payload = peek();
    if (!payload) return false;
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      clear();
      return true;
    } catch { return false; }
  }

  let inflight: Promise<boolean> | null = null;

  /**
   * Sends what's waiting, if anything. Resolves true only when it was saved. A
   * 401 leaves it waiting; any other failure leaves it too, so a flaky
   * connection at sign-in doesn't throw it away.
   */
  function flush(): Promise<boolean> {
    // One send at a time. Two overlapping calls — React mounting an effect twice
    // in development is the one that happens — would otherwise both succeed and
    // save it twice.
    inflight ??= send().finally(() => { inflight = null; });
    return inflight;
  }

  return { stash, peek, clear, flush };
}

/** A session finished in the runner. */
export const pendingWorkout = slot('forge.pendingWorkout', '/api/workouts');
/** A week built on Plan. Sent as a new plan that becomes the one followed. */
export const pendingPlan = slot('forge.pendingPlan', '/api/plans');
