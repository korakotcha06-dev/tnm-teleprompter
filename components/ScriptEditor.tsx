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
      updateScript(active.id, {
        title: title.trim() || 'Untitled',
        content,
        language,
      });
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

  const charCount = content.length;
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const estMin = Math.max(1, Math.ceil(wordCount / 130));

  return (
    <section className="panel" aria-label="Editor">
      <div className="panel-head">
        <div className="title">
          <span className="marker" />
          {active ? 'Edit Script' : 'New Script'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleNew} className="btn btn-sm">
            + New
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn btn-primary btn-sm"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 8 L6 12 L14 4" />
            </svg>
            Save to Library
          </button>
          {active && (
            <Link href={`/run?id=${active.id}`} className="btn btn-sm">
              <svg width="10" height="10" viewBox="0 0 12 12">
                <path d="M2 1 L10 6 L2 11 Z" fill="currentColor" />
              </svg>
              Run
            </Link>
          )}
        </div>
      </div>

      <div className="editor-grid">
        <input
          type="text"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Script title — e.g. บทเรียนที่ 3: การจัดองค์ประกอบภาพ"
        />

        <div className="field-row">
          <textarea
            className="textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              language === 'th'
                ? 'พิมพ์หรือวางสคริปต์ของคุณที่นี่ — กด Save เพื่อบันทึก หรือกด Run จาก Library เพื่อขึ้นจอ'
                : 'Type or paste your script here — hit Save, then Run it from the Library.'
            }
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="label-inline">Language</span>
            <select
              className="select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              <option value="th">ไทย (Thai)</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="editor-foot stats" style={{ border: 'none', background: 'none', padding: 0 }}>
            <span>
              <span className="v">{charCount}</span> chars
            </span>
            <span>
              <span className="v">{wordCount}</span> words
            </span>
            <span>
              <span className="v">~{estMin}</span> min @ 130 wpm
            </span>
          </div>
        </div>
        {savedAt && (
          <p className="editor-saved label-inline">Saved at {savedAt}</p>
        )}
      </div>
    </section>
  );
}
