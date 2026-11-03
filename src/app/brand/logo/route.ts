import { getLogo } from '@/lib/branding-server';

// Not prerendered: a build-time snapshot would serve the logo from deploy day.
export const dynamic = 'force-dynamic';

/**
 * The uploaded logo. Callers always ask with `?v=<updated_at>`, so a given URL
 * never changes content and can be cached for a year; a new upload is a new URL.
 *
 * SVG is served with a sandboxing CSP: it is admin-supplied, but an SVG opened
 * directly is a document that could run script on this origin.
 */
export async function GET() {
  const logo = await getLogo();
  if (!logo) return new Response(null, { status: 404 });
  return new Response(Buffer.from(logo.data, 'base64'), {
    headers: {
      'Content-Type': logo.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
