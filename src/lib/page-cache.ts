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

/** Clears the cache if the signed-in account isn't the one the cache was filled for. */
export async function notePageCacheUser(id: string | null): Promise<void> {
  try {
    const was = localStorage.getItem(LAST);
    if ((was ?? '') === (id ?? '')) return;
    await clearPageCache();
    if (id) localStorage.setItem(LAST, id); else localStorage.removeItem(LAST);
  } catch { /* storage blocked */ }
}
