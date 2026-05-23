'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import type { Language, Script } from '@/types';

const SAVE_DEBOUNCE_MS = 600;

type SaveStatus = 'idle' | 'saving' | 'saved';

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
  const [status, setStatus] = useState<SaveStatus>('idle');

  // When composing a NEW script, the first auto-save creates it and stashes
  // the new id here so subsequent keystrokes UPDATE that one row instead of
  // spawning duplicates. The ref is the synchronous source of truth for the
  // save logic (immune to stale closures / rapid double-clicks); `createdId`
  // mirrors it purely so the Run link can render without reading a ref during
  // render. We intentionally do NOT call setActive() during typing — that
  // would flip the parent's `key` and remount this editor, yanking the caret
  // out of the textarea mid-word.
  const createdIdRef = useRef<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest field values, read by the debounced/flush save paths so they never
  // act on a stale closure. Updated after each render.
  const latestRef = useRef({ title, content, language });
  useEffect(() => {
    latestRef.current = { title, content, language };
  }, [title, content, language]);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Create-or-update using the latest field values. Empty drafts (no title and
  // no content) are skipped so we never persist a blank row.
  const doSave = useCallback(() => {
    const { title, content, language } = latestRef.current;
    if (!title.trim() && !content.trim()) {
      setStatus('idle');
      return;
    }
    const targetId = active?.id ?? createdIdRef.current;
    if (targetId) {
      updateScript(targetId, {
        title: title.trim() || 'Untitled',
        content,
        language,
      });
    } else {
      const s = createScript(title || 'Untitled', content, language);
      createdIdRef.current = s.id;
      setCreatedId(s.id);
    }
    setSavedAt(new Date().toLocaleTimeString());
    setStatus('saved');
  }, [active, createScript, updateScript]);

  // Flush the pending debounced save on unmount so the final keystroke isn't
  // lost (e.g. navigating away within the debounce window). Read via ref so
  // the cleanup runs only at unmount, not on every doSave identity change.
  const doSaveRef = useRef(doSave);
  useEffect(() => {
    doSaveRef.current = doSave;
  });
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        doSaveRef.current();
      }
    };
  }, []);

  // Debounced auto-save — restarted on every edit. The 'saving' status flips
  // to 'saved' once the timer fires and the write lands.
  const scheduleSave = useCallback(() => {
    setStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      doSave();
    }, SAVE_DEBOUNCE_MS);
  }, [doSave]);

  const handleSave = () => {
    // Explicit Save flushes immediately, cancelling any pending debounce.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    doSave();
  };

  const handleNew = () => {
    // Cancel any pending save and reset to a blank draft. setActive(null) is a
    // no-op when already composing new (active === null), so we clear local
    // state directly rather than relying on a parent `key` remount.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    createdIdRef.current = null;
    setCreatedId(null);
    setTitle('');
    setContent('');
    setLanguage('th');
    setSavedAt(null);
    setStatus('idle');
    setActive(null);
  };

  const handleTitleChange = (next: string) => {
    setTitle(next);
    scheduleSave();
  };

  const handleContentChange = (next: string) => {
    setContent(next);
    scheduleSave();
  };

  const handleLanguageChange = (next: Language) => {
    setLanguage(next);
    scheduleSave();
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="editor-autosave label-inline" aria-live="polite">
            {status === 'saving'
              ? 'Saving…'
              : status === 'saved'
                ? `Auto-saved${savedAt ? ` ${savedAt}` : ''}`
                : 'Auto-saves'}
          </span>
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
            Save now
          </button>
          {(active?.id ?? createdId) && (
            <Link
              href={`/run?id=${active?.id ?? createdId}`}
              className="btn btn-sm"
            >
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
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Script title — e.g. บทเรียนที่ 3: การจัดองค์ประกอบภาพ"
        />

        <div className="field-row">
          <textarea
            className="textarea"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={
              language === 'th'
                ? 'พิมพ์หรือวางสคริปต์ของคุณที่นี่ — บันทึกอัตโนมัติ กด Run จาก Library เพื่อขึ้นจอ'
                : 'Type or paste your script here — it saves automatically, then Run it from the Library.'
            }
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="label-inline">Language</span>
            <select
              className="select"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
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
      </div>
    </section>
  );
}
