'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ScriptEditor } from '@/components/ScriptEditor';
import { ScriptLibrary } from '@/components/ScriptLibrary';
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
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-900 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Teleprompter
            </h1>
            <p className="text-xs text-zinc-500">
              Touchnewmedia · v0.1 · localStorage only
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-500 sm:inline">
              Voice integration · v0.2
            </span>
            <Link
              href="/settings"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              ⚙ Settings
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6 md:flex-row">
        <ScriptLibrary />
        {/*
          key={active?.id ?? 'new'}: remounts ScriptEditor whenever the active
          script switches, so its useState initializers re-derive form values
          from the new `active` prop — avoids react-hooks/set-state-in-effect.
        */}
        <ScriptEditor key={active?.id ?? 'new'} active={active} />
      </div>
    </main>
  );
}
