'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import type { Language, Script } from '@/types';

type Props = {
  /**
   * Active script being edited (or null when composing a new one).
   * Parent uses `key={active?.id ?? 'new'}` so this component remounts when
   * the active script changes — that mounts fresh local state derived from
   * `active`, avoiding the `react-hooks/set-state-in-effect` anti-pattern.
   */
  active: Script | null;
};

export function ScriptEditor({ active }: Props) {
  const hydrated = useScriptStore((s) => s.hydrated);
  const hydrate = useScriptStore((s) => s.hydrate);
  const createScript = useScriptStore((s) => s.createScript);
  const updateScript = useScriptStore((s) => s.updateScript);
  const setActive = useScriptStore((s) => s.setActive);

  // Derive initial form state from `active` prop. The parent remounts this
  // component (via `key`) whenever the active script switches, so these
  // initializers run fresh on every script change — no effect sync needed.
  const [title, setTitle] = useState(active?.title ?? '');
  const [content, setContent] = useState(active?.content ?? '');
  const [language, setLanguage] = useState<Language>(active?.language ?? 'th');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const handleSave = () => {
    if (!title.trim() && !content.trim()) return;
    if (active) {
      updateScript(active.id, { title: title.trim() || 'Untitled', content, language });
    } else {
      const s = createScript(title || 'Untitled', content, language);
      setActive(s.id);
    }
    setSavedAt(new Date().toLocaleTimeString());
  };

  const handleNew = () => {
    // Clears active selection; parent's `key` flip remounts editor with empty state.
    setActive(null);
  };

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const estMin = Math.max(1, Math.ceil(wordCount / 130));

  return (
    <section className="flex flex-1 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {active ? 'Edit Script' : 'New Script'}
          </h2>
          {savedAt && (
            <p className="text-xs text-emerald-500">Saved at {savedAt}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleNew}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            New
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-amber-300"
          >
            Save
          </button>
          {active && (
            <Link
              href={`/run?id=${active.id}`}
              className="rounded-md border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-500 transition hover:bg-amber-400 hover:text-black"
            >
              ▶ Run
            </Link>
          )}
        </div>
      </header>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Script title…"
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition focus:border-amber-400 dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
      />

      <div className="flex items-center gap-2 text-xs">
        <label className="text-zinc-500">Language:</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-800 dark:border-zinc-800 dark:bg-black dark:text-zinc-200"
        >
          <option value="th">ไทย (th)</option>
          <option value="en">English (en)</option>
        </select>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          language === 'th'
            ? 'พิมพ์สคริปต์ของคุณที่นี่…'
            : 'Type your script here…'
        }
        rows={16}
        className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 font-thai text-base leading-relaxed text-zinc-900 outline-none transition focus:border-amber-400 dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
      />

      <p className="text-xs text-zinc-500">
        {content.length} chars · {wordCount} words · ~{estMin} min @ 130 wpm
      </p>
    </section>
  );
}
