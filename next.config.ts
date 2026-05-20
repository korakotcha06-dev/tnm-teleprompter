import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Static HTML/JS/CSS export — produces an `out/` folder deployable to any
  // plain web server (no Node runtime). Target: thetnm.com/teleprompter on a
  // WordPress/PHP shared host. See node_modules/next/dist/docs static-exports.
  output: 'export',

  // Deploy under the /teleprompter sub-path. Next inlines this at build time
  // into every link AND asset URL (_next/* served from /teleprompter/_next/*),
  // so assetPrefix is handled automatically — no manual assetPrefix needed.
  basePath: '/teleprompter',

  // trailingSlash: emit folder/index.html for every route (run/index.html,
  // settings/index.html). Apache/shared-host serves these directly with zero
  // rewrite rules — every route is a real file on disk.
  trailingSlash: true,

  // Static export has no image optimizer server; unoptimized passes src through
  // verbatim. Defensive — the app uses no next/image today, but keeps export safe.
  images: { unoptimized: true },

  turbopack: {
    // Pin workspace root to this project so Turbopack doesn't pick up
    // the user's parent lockfile and emit a warning on every start.
    root: path.resolve('.'),
  },
};

export default nextConfig;
