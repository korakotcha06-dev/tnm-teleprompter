import type { ReactNode } from 'react';
import { BRAND } from '@/lib/brand';
import { SiteFooter } from './SiteFooter';

/**
 * Marketing promo band — sells TNM e-learning production. Presentational; the
 * two CTAs link out (LINE quote / Vimeo showreel) via BRAND, both in a new tab.
 * Footer is nested inside (matches the design's `.promo > .foot` structure).
 */
export function SitePromo() {
  return (
    <section className="promo">
      <div className="promo-inner">
        <div className="promo-eyebrow">Why this is free</div>
        <h2>
          We made this <span className="em">because</span> we shoot e-learning.
        </h2>
        <p className="promo-sub">
          Touchnewmedia is a full-service production studio in Chiang Mai. We
          film, edit, and design online courses for universities, brands, and
          instructors across Thailand. The teleprompter is the tool we wished
          existed for our own talents — so we built it, polished it, and gave it
          away. When you&apos;re ready for a real camera in front of you,
          we&apos;re here.
        </p>

        <div className="promo-grid">
          <Svc
            num="01"
            title="E-learning production"
            desc="Lecture, course, and training video production end-to-end — studio or on-location. Multi-cam, prompters, and on-set direction included."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2" y="6" width="14" height="12" rx="2" />
                <path d="M22 8 L16 12 L22 16 Z" />
              </svg>
            }
          />
          <Svc
            num="02"
            title="Course design & scripting"
            desc="Instructional designers and scriptwriters who turn syllabi into watchable videos. Storyboards, decks, and prompter-ready scripts."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 4h12l4 4v12H4z" />
                <path d="M16 4v4h4" />
                <path d="M8 13h8M8 17h5" />
              </svg>
            }
          />
          <Svc
            num="03"
            title="Motion graphics & post"
            desc="Animated explainers, lower-thirds, charts, and lesson openers. Editing, color, sound — all under one roof."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 8v8l7-4z" fill="currentColor" />
              </svg>
            }
          />
          <Svc
            num="04"
            title="LMS-ready delivery"
            desc="We deliver in the formats and aspect ratios your LMS, YouTube channel, or Thai MOOC platform actually needs — captioned and chaptered."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <path d="M8 21h8M12 18v3" />
              </svg>
            }
          />
        </div>

        <div className="promo-cta">
          <div className="left">
            <div className="promo-eyebrow" style={{ margin: 0, color: 'var(--text-dim)' }}>
              <span style={{ color: 'var(--tnm-amber)' }}>Now booking</span> — Q3
              / Q4 2026
            </div>
            <h3>Have a course to film? Let&apos;s talk before the semester starts.</h3>
            <p>
              Pilot episode, full course, or just a single recording day —
              we&apos;ll quote it within 48 hours.
            </p>
          </div>
          <div className="actions">
            <a
              className="btn btn-primary btn-lg btn-arrow"
              href={BRAND.quoteHref}
              target="_blank"
              rel="noopener"
            >
              Get a quote
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
            <a
              className="btn btn-lg"
              href={BRAND.showreelHref}
              target="_blank"
              rel="noopener"
            >
              View showreel
            </a>
          </div>
        </div>
      </div>
      <SiteFooter />
    </section>
  );
}

function Svc({
  num,
  title,
  desc,
  icon,
}: {
  num: string;
  title: string;
  desc: string;
  icon: ReactNode;
}) {
  return (
    <div className="svc">
      <div className="num">{num}</div>
      <div className="ic">{icon}</div>
      <div className="ttl">{title}</div>
      <div className="desc">{desc}</div>
    </div>
  );
}
