'use client';

import Link from 'next/link';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';

export function ControlBar() {
  const isRunning = useScriptStore((s) => s.isRunning);
  const start = useScriptStore((s) => s.start);
  const pause = useScriptStore((s) => s.pause);
  const restart = useScriptStore((s) => s.restart);
  const advanceCursor = useScriptStore((s) => s.advanceCursor);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const mirrorMode = useSettingsStore((s) => s.mirrorMode);
  const toggleMirror = useSettingsStore((s) => s.toggleMirror);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <div
      className="pointer-events-auto fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur"
      // Keep the bar un-mirrored even when teleprompter is mirrored
      style={{ transform: 'none' }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 text-xs text-zinc-300">
        <Link
          href="/"
          className="rounded-md border border-zinc-800 px-3 py-1.5 transition hover:bg-zinc-800"
        >
          ← Library
        </Link>

        <div className="h-5 w-px bg-zinc-800" />

        {!isRunning ? (
          <button
            type="button"
            onClick={start}
            disabled
            title="Voice playback arrives in v0.2"
            className="cursor-not-allowed rounded-md bg-zinc-800 px-3 py-1.5 text-zinc-500"
          >
            ▶ Start (v0.2)
          </button>
        ) : (
          <button
            type="button"
            onClick={pause}
            className="rounded-md bg-amber-400 px-3 py-1.5 font-medium text-black transition hover:bg-amber-300"
          >
            ⏸ Pause
          </button>
        )}

        <button
          type="button"
          onClick={() => advanceCursor(1)}
          className="rounded-md border border-zinc-800 px-3 py-1.5 transition hover:bg-zinc-800"
          title="Advance cursor by one token (manual, for v0.1 demo)"
        >
          → +1
        </button>

        <button
          type="button"
          onClick={restart}
          className="rounded-md border border-zinc-800 px-3 py-1.5 transition hover:bg-zinc-800"
        >
          ↺ Restart
        </button>

        <div className="h-5 w-px bg-zinc-800" />

        <div className="flex items-center gap-1">
          <span className="text-zinc-500">A</span>
          <button
            type="button"
            onClick={() =>
              setFontSize(useSettingsStore.getState().fontSize - 4)
            }
            className="rounded-md border border-zinc-800 px-2 py-1 transition hover:bg-zinc-800"
          >
            −
          </button>
          <span className="w-8 text-center tabular-nums">{fontSize}</span>
          <button
            type="button"
            onClick={() =>
              setFontSize(useSettingsStore.getState().fontSize + 4)
            }
            className="rounded-md border border-zinc-800 px-2 py-1 transition hover:bg-zinc-800"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-zinc-500">↕</span>
          <button
            type="button"
            onClick={() =>
              setLineHeight(useSettingsStore.getState().lineHeight - 0.1)
            }
            className="rounded-md border border-zinc-800 px-2 py-1 transition hover:bg-zinc-800"
          >
            −
          </button>
          <span className="w-10 text-center tabular-nums">
            {lineHeight.toFixed(1)}
          </span>
          <button
            type="button"
            onClick={() =>
              setLineHeight(useSettingsStore.getState().lineHeight + 0.1)
            }
            className="rounded-md border border-zinc-800 px-2 py-1 transition hover:bg-zinc-800"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={toggleMirror}
          className={`rounded-md border px-3 py-1.5 transition ${
            mirrorMode
              ? 'border-amber-400 bg-amber-400/10 text-amber-300'
              : 'border-zinc-800 hover:bg-zinc-800'
          }`}
        >
          ⇋ Mirror
        </button>

        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-md border border-zinc-800 px-3 py-1.5 transition hover:bg-zinc-800"
        >
          {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
        </button>

        <Link
          href="/settings"
          className="ml-auto rounded-md border border-zinc-800 px-3 py-1.5 transition hover:bg-zinc-800"
        >
          ⚙ Settings
        </Link>
      </div>
    </div>
  );
}
