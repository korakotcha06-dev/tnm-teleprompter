// Touchnewmedia brand constants — single source of truth for company-facing
// copy + outbound links used across the site chrome (nav, hero, promo, footer).
// v0.5.0 brand reskin. All external CTAs open in a new tab (see usage:
// target="_blank" rel="noopener").

export const BRAND = {
  company: 'Touchnewmedia Co., Ltd.',
  email: 'korakot.cha@thetnm.com',
  emailHref: 'mailto:korakot.cha@thetnm.com',
  ig: '@touchnewmedia',
  igHref: 'https://instagram.com/touchnewmedia',
  locations: 'Chiang Mai · Bangkok',
  lineId: 'tib7057v',
  quoteHref: 'https://line.me/ti/p/~tib7057v', // "Get a quote" → LINE
  showreelHref: 'https://vimeo.com/thetnm', // "View showreel" → Vimeo
  /** External link to Touchnewmedia company site (rendered in SiteNav). */
  siteHref: 'https://thetnm.com',
  /** Visible label for the company-site link in SiteNav. */
  siteLabel: 'thetnm.com',
  /** Brand build label shown in the nav pill + hero meta. Touch-approved. */
  versionLabel: 'v0.5.3 · Auto-save',
} as const;
