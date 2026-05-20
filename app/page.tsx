'use client';

import { useEffect } from 'react';
import { ScriptEditor } from '@/components/ScriptEditor';
import { ScriptLibrary } from '@/components/ScriptLibrary';
import { SiteNav } from '@/components/SiteNav';
import { SiteHero } from '@/components/SiteHero';
import { SitePromo } from '@/components/SitePromo';
import { useScriptStore } from '@/lib/stores/useScriptStore';

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
