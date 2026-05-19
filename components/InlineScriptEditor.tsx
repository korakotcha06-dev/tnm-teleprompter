'use client';

// InlineScriptEditor — overlay editor for /run/[id] (v0.2 addition).
//
// Inspired by cueprompter.com's "one-page, edit-in-place" feel — the user
// switches between viewing the tokenized teleprompter and editing the raw
// script body without leaving the run page. No router navigation, no
// editor → save → bounce-back round-trip.
//
// Behavior contract (paired with RunController):
//   - Mounted only while RunController's mode === 'edit'.
//   - autofocus the textarea on mount and place caret at end of content.
//   - Every keystroke schedules a 500ms-debounced `updateScript()` so
//     localStorage stays in sync (refresh-safe mid-edit, no manual Save).
//   - Esc key fires `onExit` (RunController flips mode back to 'view').
//   - Done button fires `onExit` too.
//   - Title input mirrors the same debounced-save pattern.
//   - Font-size + line-height from settings store so layout doesn't shift
//     when toggling view ↔ edit.
//
// Why local controlled state + debounced store write (and not direct binding):
//   Writing into Zustand on every keystroke is fine performance-wise, but
//   it would re-tokenize the script in the store every time (setTokensFromContent
//   is wired in TeleprompterView's effect). Debouncing the *persist* keeps
//   typing responsive AND defers the expensive `tokenize()` to exit time.
//   We intentionally do NOT call `setTokensFromContent` from within the editor —
//   that happens once on exit via the existing TeleprompterView effect after
//   RunController flips mode back to 'view' (the `script` selector emits
//   the new content and the effect re-runs).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';
import type { Script } from '@/types';

const SAVE_DEBOUNCE_MS = 500;

type Props = {
  script: Script;
  /** Called when the user requests to exit edit mode (Done button or Esc). */
  onExit: () => void;
};

export function InlineScriptEditor({ script, onExit }: Props) {
  const updateScript = useScriptStore((s) => s.updateScript);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);

  // Local mirror of the persisted script content/title. Initialized once
  // from props — re-mount happens whenever scriptId changes upstream, so
  // we never need to re-sync from props mid-life.
  const [content, setContent] = useState(script.content);
  const [title, setTitle] = useState(script.title);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest-values ref — read by the unmount cleanup so we can synchronously
  // flush the pending debounced save with whatever the user last typed. Keeps
  // the cleanup effect from depending on `title`/`content` (which would tear
  // down the document keydown listener on every keystroke and cause Esc to
  // race the latest mutation).
  const latestRef = useRef({ title, content });
  useEffect(() => {
    latestRef.current = { title, content };
  }, [title, content]);

  // Debounced persist. Cancels any pending save and schedules a fresh one.
  // We capture the latest values via closure inside setTimeout — safe
  // because we always restart the timer on each call.
  const schedulePersist = useCallback(
    (patch: Partial<Pick<Script, 'title' | 'content'>>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateScript(script.id, patch);
      }, SAVE_DEBOUNCE_MS);
    },
    [script.id, updateScript]
  );

  // Autofocus + caret at end on mount. Doing this once is enough — the
  // editor is unmounted/remounted by RunController each time the user
  // enters edit mode, so this effect runs fresh per session.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, []);

  // Esc → exit edit mode. Listening at document level so the textarea
  // doesn't need focus to be the source of the keystroke (e.g. user
  // tabbed into title input and pressed Esc). Deps are stable references
  // only — we read fresh values via `latestRef`.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // Flush any pending save synchronously before exiting so the
        // re-tokenize in view mode sees the latest content.
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        updateScript(script.id, { ...latestRef.current });
        onExit();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onExit, script.id, updateScript]);

  // Flush pending debounce on unmount so the final keystroke isn't lost
  // if the user clicks Done within the debounce window. We persist the
  // latest values synchronously via latestRef rather than just clearing
  // the timer — clearing alone would drop the pending mutation.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        updateScript(script.id, { ...latestRef.current });
      }
    };
  }, [script.id, updateScript]);

  const handleContentChange = useCallback(
    (next: string) => {
      setContent(next);
      schedulePersist({ content: next });
    },
    [schedulePersist]
  );

  const handleTitleChange = useCallback(
    (next: string) => {
      setTitle(next);
      schedulePersist({ title: next });
    },
    [schedulePersist]
  );

  // Note: Done button lives in ControlBar and fires `onExit` directly via
  // RunController's `onExitEdit` callback. We still need to flush the
  // pending debounced save when that happens — which is handled by the
  // unmount cleanup effect below (timer cleared, but the latest debounce
  // tick may not have fired yet). For zero-loss we also persist the latest
  // values on the Esc handler above as a belt-and-suspenders measure.

  // Auto-resize the textarea to fit its content so the entire script is
  // visible without an inner scrollbar — mirrors the teleprompter view's
  // page-scroll behavior. We compute height on every render via a layout
  // ref callback rather than reading via JS imperatively, which avoids
  // measure-then-write thrash.
  const handleTextareaResize = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [content, fontSize, lineHeight]);

  return (
    <div className="min-h-screen w-full bg-black px-12 py-32">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* Title input — slim, no heavy border. Subtle underline only when
            focused, matching the luxury minimal tone. */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          aria-label="Script title"
          className="w-full border-b border-zinc-800 bg-transparent pb-2 text-sm tracking-wide text-zinc-400 outline-none transition-colors focus:border-amber-400/50 focus:text-zinc-200"
        />

        {/* Subtle "Edit mode" indicator + Done button row */}
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400/70" />
            Editing — auto-saves
          </span>
          <span className="text-zinc-600">Esc to finish</span>
        </div>

        {/* Textarea — same font-size / line-height as the teleprompter view
            so toggling modes feels like a "skin swap" rather than a page nav.
            Background gets a faint amber tint so the edit affordance is
            visible without resorting to a thick border. */}
        <textarea
          ref={handleTextareaResize}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start writing your script…"
          aria-label="Script content"
          spellCheck={false}
          className="w-full resize-none rounded-md bg-amber-300/[0.02] font-thai font-medium text-zinc-100 outline-none transition-colors placeholder:text-zinc-700"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight,
            // Inset padding mimics the teleprompter view's max-w-5xl content
            // box so left edge of text aligns identically across modes.
            padding: '0.25rem 0',
            minHeight: '40vh',
          }}
        />
      </div>
    </div>
  );
}
