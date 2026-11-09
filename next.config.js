/** @type {import('next').NextConfig} */

// Local Firebase emulator mode (npm run dev). Off in `dev:live`, `build` and
// production, where everything below is identical to the non-emulator config.
const useFirebaseEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
const emulatorConnectSrc = useFirebaseEmulator ? ' http://127.0.0.1:8085 http://127.0.0.1:9099' : '';

const nextConfig = {
  reactStrictMode: true,
  // Separate build cache so code compiled for emulator mode is never reused by a
  // normal run (and vice versa) — Firebase settings are baked in at compile time.
  ...(useFirebaseEmulator ? { distDir: '.next-emulator' } : {}),
  images: {
    unoptimized: true,
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://fonts.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com" + emulatorConnectSrc,
              "frame-ancestors 'self'",
            ].join('; ')
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;


