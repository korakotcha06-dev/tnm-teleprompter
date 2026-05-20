import { BRAND } from '@/lib/brand';

type Props = {
  /**
   * Number of scripts in the library, or `null` while the store is not yet
   * hydrated. The parent passes `hydrated ? scripts.length : null` so the
   * static-exported HTML renders a neutral placeholder ("—") on first paint
   * and only fills in the real count after client hydration — avoiding a
   * server/client text mismatch (hydration warning) and a count flash.
   */
  scriptCount: number | null;
};

/**
 * Hero band — headline + studio blurb + build meta. Presentational; the only
 * dynamic value is `scriptCount` (passed in, hydration-guarded by the parent).
 */
export function SiteHero({ scriptCount }: Props) {
  const countLabel =
    scriptCount === null
      ? '—'
      : `${scriptCount} script${scriptCount === 1 ? '' : 's'}`;

  return (
    <section className="hero">
      <div className="hero-inner">
        <div>
          <div className="hero-tag">
            <span className="sq" />
            <span>
              A FREE TOOL FROM TOUCHNEWMEDIA CO., LTD. · BUILT FOR CREATORS &amp;
              EDUCATORS
            </span>
          </div>
          <h1>
            Tele<span className="accent">prompter</span>
            <br />
            <span className="slash">—</span> for serious takes.
          </h1>
        </div>
        <div className="hero-right">
          <p className="hero-blurb">
            <b>Free.</b> A clean teleprompter built by a working production
            studio. No accounts, no upsells — just paste your script, hit Run,
            and look at the lens. Scripts live in your browser; nothing leaves
            this tab.
          </p>
          <div className="hero-meta">
            <div className="kv">
              <span className="k">Build</span>
              <span className="v">{BRAND.versionLabel}</span>
            </div>
            <div className="kv">
              <span className="k">Storage</span>
              <span className="v">localStorage</span>
            </div>
            <div className="kv">
              <span className="k">In library</span>
              <span className="v" suppressHydrationWarning>
                {countLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
