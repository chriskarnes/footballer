/**
 * Work done signed out, or with no signal, waiting to be sent.
 *
 * Train and Plan need no sign-in, so a first session — or a first week — is
 * usually made signed out. Rather than claim it was saved, or tell the player
 * it will be gone tomorrow, it is kept here and <PendingSaves /> sends it once
 * there is an account to send it to.
 *
 * A short list per kind (five at most, a week at most): two sessions done on a
 * field with no signal are both kept, but nothing piles up into a backlog that
 * lands in someone's account weeks later.
 *
 * Each entry remembers whose it is. Work done signed in goes only to that
 * account, so on a shared family phone a sibling who signs in next doesn't
 * get it in their history; it waits for its owner. Work done signed out has
 * no owner yet and goes to whoever signs in, which is the point of keeping it.
 *
 * localStorage belongs to one browser. A sign-in link opened in a different
 * one (a mail app's built-in browser, say) won't find it — the work is lost
 * there, which is no worse than before.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 5;

/** The body the endpoint takes. */
export type Payload = Record<string, unknown>;
type Entry = { id: string; at: number; uid: string | null; payload: Payload };

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function slot(key: string, endpoint: string, method: 'POST' | 'PATCH' = 'POST') {
  function read(): Entry[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const v = JSON.parse(raw);
      // Before the list: one { at, payload }, signed out.
      const list: Entry[] = Array.isArray(v) ? v : v?.payload ? [{ id: newId(), at: v.at, uid: null, payload: v.payload }] : [];
      return list.filter((e) => typeof e?.at === 'number' && Date.now() - e.at <= MAX_AGE_MS && e.payload);
    } catch { return []; }
  }
  function write(list: Entry[]): void {
    try {
      if (list.length) localStorage.setItem(key, JSON.stringify(list.slice(-MAX_ENTRIES)));
      else localStorage.removeItem(key);
    } catch { /* private mode or storage blocked: it just isn't kept */ }
  }

  /** Keeps one; returns its id, to change it later (a feel picked after). */
  function stash(payload: Payload, uid: string | null = null): string {
    const id = newId();
    write([...read(), { id, at: Date.now(), uid, payload }]);
    return id;
  }
  /** Changes a waiting entry's body, if it's still waiting. */
  function update(id: string, payload: Payload): void {
    write(read().map((e) => (e.id === id ? { ...e, payload } : e)));
  }
  const has = (id: string) => read().some((e) => e.id === id);
  /** Anything waiting that this account (or nobody signed in) would send. */
  const peek = (uid: string | null = null) => read().some((e) => e.uid === null || e.uid === uid);
  const clear = () => write([]);

  async function send(uid: string): Promise<boolean> {
    let sent = false;
    for (const e of read()) {
      if (e.uid !== null && e.uid !== uid) continue;   // someone else's: waits for them
      try {
        const res = await fetch(endpoint, {
          method, headers: { 'content-type': 'application/json' },
          body: JSON.stringify(e.payload),
        });
        // A 4xx other than sign-in won't get better by sending again.
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401)) {
          write(read().filter((x) => x.id !== e.id));
          sent ||= res.ok;
        }
      } catch { return sent; }                         // offline again: try later
    }
    return sent;
  }

  let inflight: Promise<boolean> | null = null;

  /**
   * Sends what's waiting for this account, oldest first. Resolves true when
   * anything was saved. A failure leaves it waiting, so a flaky connection
   * doesn't throw it away.
   */
  function flush(uid: string): Promise<boolean> {
    // One send at a time: React mounting an effect twice in development would
    // otherwise save it twice.
    inflight ??= send(uid).finally(() => { inflight = null; });
    return inflight;
  }

  return { stash, update, has, peek, clear, flush };
}

/** A session finished in the runner. */
export const pendingWorkout = slot('forge.pendingWorkout', '/api/workouts');
/** A planned session (one already in the week) finished with no signal: the
 *  PATCH that marks it done, sent when the phone is back online. */
export const pendingFinish = slot('forge.pendingFinish', '/api/workouts', 'PATCH');
/** A week built on Plan. Sent as a new plan that becomes the active one. */
export const pendingPlan = slot('forge.pendingPlan', '/api/plans');

/** Fired on window when PendingSaves has sent something: a finish screen still
 *  saying "No signal" can say it's saved. */
export const PENDING_SENT = 'forge:pending-sent';
