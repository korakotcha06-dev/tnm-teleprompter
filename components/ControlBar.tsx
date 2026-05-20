'use client';

import Link from 'next/link';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import {
  MANUAL_SPEED_MAX,
  MANUAL_SPEED_MIN,
  useSettingsStore,
} from '@/lib/stores/useSettingsStore';

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
  const mirrorMode = useSettingsStore((s) => s.mirrorMode); // horizontal
  const toggleMirror = useSettingsStore((s) => s.toggleMirror);
  const mirrorV = useSettingsStore((s) => s.mirrorV); // vertical (v0.3.1)
  const toggleMirrorV = useSettingsStore((s) => s.toggleMirrorV);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const scrollMode = useSettingsStore((s) => s.scrollMode);
  const setScrollMode = useSettingsStore((s) => s.setScrollMode);
  const manualSpeed = useSettingsStore((s) => s.manualSpeed);
  const setManualSpeed = useSettingsStore((s) => s.setManualSpeed);

  const isEditing = mode === 'edit';
  const isManual = scrollMode === 'manual';

  // Switching mode while running would orphan an rAF loop (manual) or a
  // SpeechEngine session (voice). Pause first so the relevant useEffect
  // cleanups fire deterministically, then swap.
  const handleSetMode = (next: 'voice' | 'manual') => {
    if (next === scrollMode) return;
    if (isRunning) pause();
    setScrollMode(next);
  };

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
                : isManual
                  ? 'Start auto-scroll at the chosen speed'
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

        {/* v0.3: Scroll-mode toggle. Hidden during edit. Segmented control
            so both options are visible at once — luxury minimal: a thin
            outer border, amber fill on the active segment. */}
        {!isEditing ? (
          <div
            role="group"
            aria-label="Scroll mode"
            className="inline-flex overflow-hidden rounded-md border border-zinc-800 text-[11px]"
          >
            <button
              type="button"
              onClick={() => handleSetMode('voice')}
              aria-pressed={!isManual}
              title="Voice-driven highlight (Web Speech)"
              className={`px-2.5 py-1.5 transition ${
                !isManual
                  ? 'bg-amber-400 font-medium text-black'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              🎙 Voice
            </button>
            <button
              type="button"
              onClick={() => handleSetMode('manual')}
              aria-pressed={isManual}
              title="Constant-speed auto-scroll (no microphone)"
              className={`border-l border-zinc-800 px-2.5 py-1.5 transition ${
                isManual
                  ? 'bg-amber-400 font-medium text-black'
                  : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              ⇅ Manual
            </button>
          </div>
        ) : null}

        {/* Voice mode status indicator. Visible only while running + voice mode. */}
        {!isEditing && isRunning && !isManual ? (
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

        {/* v0.3 Manual mode speed control — slider + numeric WPM readout.
            Hidden in voice mode. Live updates: dragging while running
            adjusts pps on the next rAF tick (useManualScroll deps on wpm). */}
        {!isEditing && isManual ? (
          <div className="inline-flex items-center gap-2">
            <label
              htmlFor="manual-speed"
              className="text-[11px] uppercase tracking-[0.14em] text-zinc-500"
            >
              Speed
            </label>
            <input
              id="manual-speed"
              type="range"
              min={MANUAL_SPEED_MIN}
              max={MANUAL_SPEED_MAX}
              step={5}
              value={manualSpeed}
              onChange={(e) => setManualSpeed(Number(e.target.value))}
              className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-amber-400"
              aria-label="Scroll speed in words per minute"
            />
            <span className="w-14 text-center tabular-nums text-zinc-400">
              {manualSpeed} wpm
            </span>
          </div>
        ) : null}

        {/* Manual +1 word — useful in voice mode for nudging the cursor
            when the matcher missed something. Hidden in manual mode (no
            cursor to advance) and edit mode. */}
        {!isEditing && !isManual ? (
          <button
            type="button"
            onClick={() => advanceCursor(1)}
            className="rounded-md border border-zinc-800 px-3 py-1.5 transition hover:bg-zinc-800"
            title="Advance cursor by one token (manual nudge)"
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

        {/* Mirror toggles hidden in edit mode — typing into a flipped textarea
            would be unworkable. RunController auto-saves + restores BOTH the
            user's H and V mirror preferences around the edit session.
            v0.3.1: H (left↔right) and V (top↔bottom) are independent so the
            user can match whatever beam-splitter rig they're shooting on. */}
        {!isEditing ? (
          <div
            role="group"
            aria-label="Mirror"
            className="inline-flex items-center overflow-hidden rounded-md border border-zinc-800"
          >
            <button
              type="button"
              onClick={toggleMirror}
              aria-pressed={mirrorMode}
              title="Mirror horizontally (left ↔ right)"
              className={`px-3 py-1.5 transition ${
                mirrorMode
                  ? 'bg-amber-400/10 font-medium text-amber-300'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              ⇆ H
            </button>
            <button
              type="button"
              onClick={toggleMirrorV}
              aria-pressed={mirrorV}
              title="Mirror vertically (top ↔ bottom)"
              className={`border-l border-zinc-800 px-3 py-1.5 transition ${
                mirrorV
                  ? 'bg-amber-400/10 font-medium text-amber-300'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              ⇅ V
            </button>
          </div>
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
