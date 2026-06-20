import type { MetadataRoute } from 'next';

// Required for `output: 'export'` — emit the sitemap as a static file at build.
export const dynamic = 'force-static';

// Static sitemap emitted at build (output: 'export' → /teleprompter/sitemap.xml).
// Only the public landing page is listed — /run and /settings are app interiors
// that need client state (a ?id) and carry no standalone SEO value.
// Submit https://thetnm.com/teleprompter/sitemap.xml in Google Search Console,
// or add a `Sitemap:` line to thetnm.com's root robots.txt.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      // Trailing slash to match the rendered canonical (trailingSlash: true).
      // A slash mismatch makes Google treat the sitemap loc ≠ the canonical.
      url: 'https://thetnm.com/teleprompter/',
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
