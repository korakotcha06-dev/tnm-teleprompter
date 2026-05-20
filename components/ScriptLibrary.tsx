'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';

export function ScriptLibrary() {
  const scripts = useScriptStore((s) => s.scripts);
  const activeScriptId = useScriptStore((s) => s.activeScriptId);
  const setActive = useScriptStore((s) => s.setActive);
  const deleteScript = useScriptStore((s) => s.deleteScript);
  const hydrated = useScriptStore((s) => s.hydrated);
  const hydrate = useScriptStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const sorted = [...scripts].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : -1
  );

  return (
    <aside className="flex w-72 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Library
        </h2>
        <span className="text-xs text-zinc-500">{sorted.length} script{sorted.length === 1 ? '' : 's'}</span>
      </header>

      {!hydrated && <p className="text-xs text-zinc-500">Loading…</p>}

      {hydrated && sorted.length === 0 && (
        <p className="rounded-md border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
          No scripts yet.
          <br />
          Create one to get started.
        </p>
      )}

      <ul className="flex flex-col gap-2 overflow-auto">
        {sorted.map((s) => (
          <li
            key={s.id}
            className={`rounded-md border p-3 transition ${
              activeScriptId === s.id
                ? 'border-amber-400 bg-amber-400/10'
                : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-700'
            }`}
          >
            <button
              type="button"
              onClick={() => setActive(s.id)}
              className="block w-full text-left"
            >
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {s.title}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {s.language.toUpperCase()} ·{' '}
                {new Date(s.updatedAt).toLocaleDateString()}
              </p>
            </button>
            <div className="mt-2 flex gap-2">
              <Link
                href={`/run?id=${s.id}`}
                className="flex-1 rounded-md bg-amber-400 px-2 py-1 text-center text-xs font-medium text-black transition hover:bg-amber-300"
              >
                ▶ Run
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${s.title}"?`)) deleteScript(s.id);
                }}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 transition hover:border-red-500 hover:text-red-500 dark:border-zinc-800"
              >
                Del
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
