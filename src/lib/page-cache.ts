/**
 * Empties the service worker's page cache (public/sw.js). Called when the
 * account on this phone changes, so cached signed-in pages never reach the
 * next person to use it offline.
 */
export async function clearPageCache(): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.endsWith('-pages')).map((k) => caches.delete(k)));
  } catch { /* no cache to clear */ }
}

const LAST = 'forge.lastUser';

/**
 * What one signed-in player leaves on the phone that's theirs: the Speed card
 * and its sync marks, the Speed year's start, half-done ticks. Their account
 * has the first two; ticks are a session in progress. Queued saves aren't
 * here: each is marked with its owner and waits for them (pending.ts).
 */
const PERSONAL = [/^forge\.speed\.card/, /^forge\.speed\.year/, /^forge\.ticks:/];

function clearPersonal() {
  for (const k of Object.keys(localStorage)) if (PERSONAL.some((re) => re.test(k))) localStorage.removeItem(k);
}

/**
 * Notes who's signed in. When it changes, the page cache is emptied, and if
 * a signed-in player has left (signed out, or someone else signed in), their
 * things on the phone go too, so a sibling doesn't see them or inherit them.
 * Signed out to signed in keeps them: that's work done before signing in,
 * which the sign-in is there to save.
 */
export async function notePageCacheUser(id: string | null): Promise<void> {
  try {
    const was = localStorage.getItem(LAST);
    if ((was ?? '') === (id ?? '')) return;
    await clearPageCache();
    if (was) clearPersonal();
    if (id) localStorage.setItem(LAST, id); else localStorage.removeItem(LAST);
  } catch { /* storage blocked */ }
}
