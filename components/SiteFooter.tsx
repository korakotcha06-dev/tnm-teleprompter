import { BRAND } from '@/lib/brand';

/**
 * Studio footer — copyright, locations, contact. Presentational. Rendered
 * inside SitePromo (matches the design's `.promo > .foot` nesting) so the
 * footer shares the promo section's gradient backdrop.
 */
export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="l">© 2026 {BRAND.company}</div>
      <div className="c">
        <span className="bar" />
        <span>{BRAND.locations}</span>
        <span className="bar" />
      </div>
      <div className="r">
        <a href={BRAND.emailHref} target="_blank" rel="noopener">
          {BRAND.email}
        </a>{' '}
        · IG{' '}
        <a href={BRAND.igHref} target="_blank" rel="noopener">
          {BRAND.ig}
        </a>
      </div>
    </footer>
  );
}
