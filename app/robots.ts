import type { MetadataRoute } from 'next';

// Required for `output: 'export'` — emit robots.txt as a static file at build.
export const dynamic = 'force-static';

// Emitted at /teleprompter/robots.txt. NOTE: search engines only honor robots
// rules at the DOMAIN ROOT (https://thetnm.com/robots.txt), so for crawl rules
// to take effect add the Sitemap line below to thetnm.com's root robots.txt.
// This file is still useful as a discoverable pointer to the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://thetnm.com/teleprompter/sitemap.xml',
  };
}
