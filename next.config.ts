import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['recharts', 'maplibre-gl'],
  },
  // Tell Turbopack and the file tracer exactly which directory is the
  // project root. We have a parent `package.json` at `C:\Users\idkch\`
  // holding dev tools; without this pin, Next.js would infer the wrong
  // root and emit a multi-lockfile warning.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
