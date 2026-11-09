/**
 * The video id in a YouTube link, from any of the shapes people paste:
 * youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, /live/ID.
 * Null for anything else, which is then just a link.
 */
export function youtubeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
