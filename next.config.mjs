/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AVIF where the browser takes it, WebP otherwise.
  images: { formats: ['image/avif', 'image/webp'], remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com' }] },
  // No other site can show the app inside a frame of its own, where a
  // see-through page laid over it could trick a tap on Agree, Pay or Delete
  // (clickjacking). The app never frames itself. frame-ancestors is the
  // current rule; X-Frame-Options is for browsers from before it.
  //
  // A header set here replaces the same header from a route, so the three
  // uploaded-image routes are left out of this policy: theirs sandboxes an
  // uploaded SVG, and says frame-ancestors itself.
  async headers() {
    return [
      { source: '/:path*', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      {
        source: '/((?!(?:brand/logo|me/avatar|me/trainer-photo)$).*)',
        headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }],
      },
    ];
  },
};
export default nextConfig;
