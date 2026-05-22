'use client';

// InlineScriptEditor — the directly-editable surface for /run (v0.6).
//
// This is what the run page shows whenever the teleprompter is NOT running:
// the script body is editable in place, no "Edit" button to press first. The
// user just types; pressing Start (ControlBar) tokenizes the latest text and
// runs the teleprompter. RunController mounts this whenever `isRunning` is
// false, and swaps in TeleprompterView while running.
//
// Behavior contract:
//   - autofocus the textarea on mount and place caret at end of content.
//   - Every keystroke schedules a 500ms-debounced `updateScript()` so
//     localStorage stays in sync (refresh-safe, no manual Save — fixes the
//     "forgot to save" pain point).
//   - Title input mirrors the same debounced-save pattern.
//   - Container geometry (column width, side padding, top offset, font, line
//     height, line-breaking) matches TeleprompterView EXACTLY, so the swap to
//     the running view doesn't visually jump ("no bouncing").
//
// Why local controlled state + debounced store write (and not direct binding):
//   Writing into Zustand on every keystroke is fine performance-wise, but
//   it would re-tokenize the script in the store every time (setTokensFromContent
//   is wired in TeleprompterView's effect). Debouncing the *persist* keeps
//   typing responsive AND defers the expensive `tokenize()` to when the view
//   actually runs — at Start, this editor unmounts and flushes the latest
//   content, then TeleprompterView's effect re-tokenizes from the new content.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';
import type { Script } from '@/types';

const SAVE_DEBOUNCE_MS = 500;

type Props = {
  script: Script;
};

export function InlineScriptEditor({ script }: Props) {
  const updateScript = useScriptStore((s) => s.updateScript);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const sidePadding = useSettingsStore((s) => s.sidePadding); // match run-view gutter

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

  // Flush pending debounce on unmount so the final keystroke isn't lost when
  // the user presses Start within the debounce window (this editor unmounts as
  // soon as isRunning flips true). We persist the latest values synchronously
  // via latestRef rather than just clearing the timer — clearing alone would
  // drop the pending mutation, and TeleprompterView would then tokenize stale
  // content.
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

  // Auto-resize the textarea to fit its content so the whole script is one
  // continuous block (the inner run-text column owns the scrollbar, exactly
  // like the teleprompter view). Computed via a layout ref callback to avoid
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
    <>
      {/* Slim, non-scrolling header: editable title + auto-save indicator.
          Kept OUT of the text column flow so the textarea's first line lands at
          the same 30vh offset as the teleprompter's first line — Start/Pause
          then swaps surfaces with no vertical jump. */}
      <div
        style={{
          position: 'fixed',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3,
          width: 'min(640px, calc(100% - 7rem))',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          aria-label="Script title"
          className="min-w-0 flex-1 border-b border-zinc-800 bg-transparent pb-1 text-sm tracking-wide text-zinc-400 outline-none transition-colors focus:border-amber-400/50 focus:text-zinc-200"
        />
        <span className="inline-flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400/70" />
          Auto-saves
        </span>
      </div>

      {/* Outer / inner structure mirrors TeleprompterView EXACTLY (see that
          file's comments) so the editable surface and the running view share
          identical column width, side padding, top offset, font + line-height,
          and line-breaking. The editor is never mirrored, so no transform. */}
      <div className="run-scroll" style={{ overflow: 'hidden' }}>
        <div
          className="run-text"
          style={{
            height: '100%',
            width: '100%',
            maxWidth: 1500,
            margin: '0 auto',
            boxSizing: 'border-box',
            overflowY: 'auto',
            paddingTop: '30vh',
            paddingBottom: '80vh',
            paddingLeft: `${sidePadding}vw`,
            paddingRight: `${sidePadding}vw`,
            fontSize: `${fontSize}px`,
            lineHeight,
            scrollBehavior: 'auto',
          }}
        >
          <textarea
            ref={handleTextareaResize}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start writing your script…"
            aria-label="Script content"
            spellCheck={false}
            className="w-full resize-none bg-transparent font-thai font-medium outline-none placeholder:text-zinc-700"
            style={{
              display: 'block',
              fontSize: `${fontSize}px`,
              lineHeight,
              color: 'inherit',
              padding: 0,
              margin: 0,
              border: 'none',
              // Match run-text line-breaking exactly (see globals .run-text):
              // keep-all + break-word so the textarea wraps at the same points
              // as the teleprompter view (same width + font already enforced).
              whiteSpace: 'pre-wrap',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
            }}
          />
        </div>
      </div>
    </>
  );
}
