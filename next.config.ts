import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    // Pin workspace root to this project so Turbopack doesn't pick up
    // the user's parent lockfile and emit a warning on every start.
    root: path.resolve('.'),
  },
};

export default nextConfig;
