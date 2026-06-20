'use client';

import { useEffect } from 'react';
import { ScriptEditor } from '@/components/ScriptEditor';
import { ScriptLibrary } from '@/components/ScriptLibrary';
import { SiteNav } from '@/components/SiteNav';
import { SiteHero } from '@/components/SiteHero';
import { SitePromo } from '@/components/SitePromo';
import { useScriptStore } from '@/lib/stores/useScriptStore';

// Structured data (SoftwareApplication) — helps Google show this as a free web
// app in TH/EN results. Rendered into the static-exported HTML.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TNM Teleprompter',
  alternateName: 'โปรแกรม Teleprompter ภาษาไทย ฟรี',
  // Trailing slash → matches the rendered canonical + sitemap loc.
  url: 'https://thetnm.com/teleprompter/',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web Browser',
  inLanguage: ['th', 'en'],
  description:
    'เทเลพรอมเตอร์ (บอกบท) ออนไลน์ฟรี ภาษาไทยเป็นหลัก รองรับอังกฤษ — ตรวจจับเสียงพูดแล้วไฮไลต์คำและเลื่อนบทตามอัตโนมัติ ไม่ต้องสมัครสมาชิก ไม่ต้องติดตั้ง ใช้งานในเบราว์เซอร์ บทเก็บในเครื่องผู้ใช้.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB' },
  author: {
    '@type': 'Organization',
    name: 'Touchnewmedia Co., Ltd.',
    url: 'https://thetnm.com',
  },
};

export default function Home() {
  const scripts = useScriptStore((s) => s.scripts);
  const activeScriptId = useScriptStore((s) => s.activeScriptId);
  const hydrated = useScriptStore((s) => s.hydrated);
  const hydrate = useScriptStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const active = scripts.find((s) => s.id === activeScriptId) ?? null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <SiteNav />
      {/* Hydration guard: pass null until the store hydrates so the static
          HTML and first client render agree (placeholder "—"), then the real
          count fills in. Prevents a hydration mismatch + count flash. */}
      <SiteHero scriptCount={hydrated ? scripts.length : null} />

      <main className="shell">
        <ScriptLibrary />
        {/*
          key={active?.id ?? 'new'}: remounts ScriptEditor whenever the active
          script switches, so its useState initializers re-derive form values
          from the new `active` prop — avoids react-hooks/set-state-in-effect.
        */}
        <ScriptEditor key={active?.id ?? 'new'} active={active} />
      </main>

      <SitePromo />
    </>
  );
}
