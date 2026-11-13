import { ImageResponse } from 'next/og';
import { getAcademy, getLogo } from '@/lib/branding-server';
import { onColor } from '@/lib/brand-colors';

export const dynamic = 'force-dynamic';

const SIZES = new Set([32, 180, 192, 512]);
// Image types the renderer draws; a WebP logo falls back to the initial.
const DRAWABLE = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);

/**
 * An academy's app icon: its logo on its main color, or its initial when
 * there's no logo. /brand/icon?size=192, &maskable=1 for Android's cropped
 * shape, which needs the mark inside the middle 80%. Callers add
 * `v=` (see appOf), so a URL never changes and caches for a year.
 *
 * Without an academy (the bare domain) it's the Train.futbol icon.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const asked = Number(url.searchParams.get('size'));
  const size = SIZES.has(asked) ? asked : 192;
  const maskable = url.searchParams.get('maskable') === '1';

  const { academy } = await getAcademy();
  if (!academy) {
    const file = maskable ? '/icon-maskable-512.png' : size >= 512 ? '/icon-512.png' : size === 180 ? '/apple-touch-icon.png' : '/icon-192.png';
    return Response.redirect(new URL(file, url), 307);
  }

  // No colors: white, the app's own page, so a dark crest shows. (It was
  // near-black, and a black crest on a clear background vanished.)
  const bg = academy.branding.primary ?? '#FFFFFF';
  const logo = academy.branding.logo ? await getLogo() : null;
  const src = logo && DRAWABLE.has(logo.type) ? `data:${logo.type};base64,${logo.data}` : null;
  const mark = Math.round(size * (maskable ? 0.56 : 0.72));
  const initial = (academy.branding.name ?? academy.name).trim().charAt(0).toUpperCase() || 'T';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg }}>
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} width={mark} height={mark} style={{ objectFit: 'contain' }} alt="" />
          : <div style={{ fontSize: Math.round(mark * 0.8), fontWeight: 800, color: onColor(bg), lineHeight: 1 }}>{initial}</div>}
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  );
}

