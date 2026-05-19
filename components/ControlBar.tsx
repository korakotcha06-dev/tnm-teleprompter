'use client';

import Link from 'next/link';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';

type Props = {
  /**
   * v0.2: when false, the Start button gracefully degrades — it still works
   * (manual mode) but no Listening indicator appears. Run page passes this
   * derived from Web Speech API support detection.
   */
  voiceEnabled?: boolean;
  /**
   * v0.2 inline edit: current mode of the run page. View = teleprompter
   * renders + voice eligible. Edit = InlineScriptEditor mounted, voice
   * paused. ControlBar swaps Start/Edit for Done in edit mode.
   */
  mode?: 'view' | 'edit';
  /** Fired when the user clicks the Edit pencil. RunController flips mode. */
  onEnterEdit?: () => void;
  /** Fired when the user clicks Done. RunController flips mode + restores mirror. */
  onExitEdit?: () => void;
  /**
   * False if the script is empty (no content to read). Start button is
   * disabled in that case to avoid arming voice over nothing.
   */
  canStartVoice?: boolean;
};

export function ControlBar({
  voiceEnabled = true,
  mode = 'view',
  onEnterEdit,
  onExitEdit,
  canStartVoice = true,
}: Props = {}) {
  const isRunning = useScriptStore((s) => s.isRunning);
  const isListening = useScriptStore((s) => s.isListening);
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

  const isEditing = mode === 'edit';

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

        {isEditing ? (
          /* Edit mode: Done is the primary action. Replaces Start/Pause. */
          <button
            type="button"
            onClick={onExitEdit}
            title="Finish editing and return to teleprompter view (Esc)"
            className="rounded-md bg-amber-400 px-3 py-1.5 font-medium text-black transition hover:bg-amber-300"
          >
            ✓ Done
          </button>
        ) : !isRunning ? (
          <button
            type="button"
            onClick={start}
            disabled={!canStartVoice}
            title={
              !canStartVoice
                ? 'Add some script text first'
                : voiceEnabled
                  ? 'Start voice-driven highlighting'
                  : 'Start in manual mode (voice unsupported)'
            }
            className="rounded-md bg-amber-400 px-3 py-1.5 font-medium text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ▶ Start
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

        {/* v0.2: Edit (pencil) — view-mode only. Discreet outline, matches
            the luxury minimal tone (no heavy CTA). Clicking enters edit mode. */}
        {!isEditing ? (
          <button
            type="button"
            onClick={onEnterEdit}
            title="Edit script text inline"
            className="rounded-md border border-zinc-800 px-3 py-1.5 transition hover:bg-zinc-800"
          >
            ✎ Edit
          </button>
        ) : null}

        {/* v0.2: Mic / listening status indicator. Visible only while running. */}
        {!isEditing && isRunning ? (
          <span
            role="status"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] tracking-wide ${
              isListening
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : voiceEnabled
                  ? 'border-zinc-700 bg-zinc-900 text-zinc-400'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-500'
            }`}
          >
            <span
              aria-hidden
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isListening ? 'animate-pulse bg-emerald-400' : 'bg-zinc-600'
              }`}
            />
            {isListening ? 'Listening…' : voiceEnabled ? 'Mic idle' : 'Manual mode'}
          </span>
        ) : null}

        {!isEditing ? (
          <button
            type="button"
            onClick={() => advanceCursor(1)}
            className="rounded-md border border-zinc-800 px-3 py-1.5 transition hover:bg-zinc-800"
            title="Advance cursor by one token (manual, for v0.1 demo)"
          >
            → +1
          </button>
        ) : null}

        {!isEditing ? (
          <button
            type="button"
            onClick={restart}
            className="rounded-md border border-zinc-800 px-3 py-1.5 transition hover:bg-zinc-800"
          >
            ↺ Restart
          </button>
        ) : null}

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

        {/* Mirror toggle hidden in edit mode — typing into a flipped textarea
            would be unworkable. RunController auto-saves + restores user's
            mirror preference around the edit session. */}
        {!isEditing ? (
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
        ) : null}

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
