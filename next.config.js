/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Tour images are stored as arbitrary external URLs in the database, so we
    // allow HTTPS hosts while keeping optimization enabled. Plain HTTP is not
    // allowed — it would let the image optimizer be used to proxy insecure URLs.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    return [
      {
        source: '/airport-taxi-itanagar',
        destination: '/itanagar-airport-taxi',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Conservative HSTS: protects this host without includeSubDomains/preload,
          // so it can never break a non-HTTPS subdomain (e.g. a mail host).
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        ],
      },
    ]
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  },
}

module.exports = nextConfig

