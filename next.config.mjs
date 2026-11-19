/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AVIF where the browser takes it, WebP otherwise.
  images: { formats: ['image/avif', 'image/webp'], remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com' }] },
};
export default nextConfig;
