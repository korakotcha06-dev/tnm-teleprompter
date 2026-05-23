'use client';

import Link from 'next/link';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import {
  MANUAL_SPEED_MAX,
  MANUAL_SPEED_MIN,
  SIDE_PADDING_STEP,
  useSettingsStore,
} from '@/lib/stores/useSettingsStore';

type Props = {
  /**
   * When false, the Start button gracefully degrades — it still works (manual
   * mode) but no Listening indicator appears. Run page passes this derived
   * from Web Speech API support detection.
   */
  voiceEnabled?: boolean;
  /**
   * False if the script is empty (no content to read). Start button is
   * disabled in that case to avoid arming voice over nothing.
   */
  canStartVoice?: boolean;
};

export function ControlBar({
  voiceEnabled = true,
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
  const sidePadding = useSettingsStore((s) => s.sidePadding); // v0.5.1
  const setSidePadding = useSettingsStore((s) => s.setSidePadding);

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
    <div className="run-bar">
      <Link href="/" className="rb-btn">
        ← Library
      </Link>

      {!isRunning ? (
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
          className="rb-btn primary"
        >
          ▶ Start
        </button>
      ) : (
        <button type="button" onClick={pause} className="rb-btn primary">
          ⏸ Pause
        </button>
      )}

      {/* Scroll-mode toggle. Segmented control. */}
      <div role="group" aria-label="Scroll mode" className="rb-seg">
        <button
          type="button"
          onClick={() => handleSetMode('voice')}
          aria-pressed={!isManual}
          title="Voice-driven highlight (Web Speech)"
          className={`rb-btn ${!isManual ? 'active' : ''}`}
        >
          🎙 Voice
        </button>
        <button
          type="button"
          onClick={() => handleSetMode('manual')}
          aria-pressed={isManual}
          title="Constant-speed auto-scroll (no microphone)"
          className={`rb-btn ${isManual ? 'active' : ''}`}
        >
          ⇅ Manual
        </button>
      </div>

      {/* Voice mode status indicator. Visible only while running + voice mode. */}
      {isRunning && !isManual ? (
        <span role="status" className={`rb-status ${isListening ? 'live' : ''}`}>
          <span aria-hidden className="sdot" />
          {isListening ? 'Listening…' : voiceEnabled ? 'Mic idle' : 'Manual mode'}
        </span>
      ) : null}

      {/* Manual mode speed control — slider + numeric WPM readout. Hidden in
          voice mode. Live updates: dragging while running adjusts pps on the
          next rAF tick (useManualScroll deps on wpm). */}
      {isManual ? (
        <div className="rb-speed">
          <label htmlFor="manual-speed">Speed</label>
          <input
            id="manual-speed"
            type="range"
            min={MANUAL_SPEED_MIN}
            max={MANUAL_SPEED_MAX}
            step={5}
            value={manualSpeed}
            onChange={(e) => setManualSpeed(Number(e.target.value))}
            aria-label="Scroll speed in words per minute"
          />
          <span className="val tabular-nums">{manualSpeed} wpm</span>
        </div>
      ) : null}

      {/* Manual +1 word — nudges the cursor when the matcher missed something.
          Hidden in manual mode (no cursor to advance). */}
      {!isManual ? (
        <button
          type="button"
          onClick={() => advanceCursor(1)}
          className="rb-btn"
          title="Advance cursor by one token (manual nudge)"
        >
          → +1
        </button>
      ) : null}

      <button type="button" onClick={restart} className="rb-btn">
        ↺ Restart
      </button>

      <div className="rb-spacer" />

      {/* Font-size stepper */}
      <div className="rb-stepper">
        <span className="lbl">A</span>
        <button
          type="button"
          onClick={() => setFontSize(useSettingsStore.getState().fontSize - 4)}
        >
          −
        </button>
        <span className="val">{fontSize}</span>
        <button
          type="button"
          onClick={() => setFontSize(useSettingsStore.getState().fontSize + 4)}
        >
          +
        </button>
      </div>

      {/* Line-height stepper */}
      <div className="rb-stepper">
        <span className="lbl">↕</span>
        <button
          type="button"
          onClick={() =>
            setLineHeight(useSettingsStore.getState().lineHeight - 0.1)
          }
        >
          −
        </button>
        <span className="val">{lineHeight.toFixed(1)}</span>
        <button
          type="button"
          onClick={() =>
            setLineHeight(useSettingsStore.getState().lineHeight + 0.1)
          }
        >
          +
        </button>
      </div>

      {/* v0.5.1 side-padding stepper — left/right gutter as % of viewport.
          Fixes "ข้อความชิดขอบ" on prod. Live-state read (getState) mirrors the
          font/line steppers so rapid clicks never act on a stale closure. */}
      <div className="rb-stepper">
        <span className="lbl" title="Side padding (left/right gutter)">
          ⇿
        </span>
        <button
          type="button"
          onClick={() =>
            setSidePadding(
              useSettingsStore.getState().sidePadding - SIDE_PADDING_STEP
            )
          }
          title="Less side padding (text wider)"
        >
          −
        </button>
        <span className="val tabular-nums">{sidePadding}%</span>
        <button
          type="button"
          onClick={() =>
            setSidePadding(
              useSettingsStore.getState().sidePadding + SIDE_PADDING_STEP
            )
          }
          title="More side padding (text narrower)"
        >
          +
        </button>
      </div>

      {/* Mirror toggles set a preference that only flips the RUNNING
          teleprompter — the editable surface is always rendered unflipped, so
          these are safe to leave visible while idle/typing. H and V are
          independent so the user can match whatever beam-splitter rig they're
          shooting on. */}
      <div role="group" aria-label="Mirror" className="rb-seg">
        <button
          type="button"
          onClick={toggleMirror}
          aria-pressed={mirrorMode}
          title="Mirror horizontally (left ↔ right)"
          className={`rb-btn ${mirrorMode ? 'mirror-on' : ''}`}
        >
          ⇆ H
        </button>
        <button
          type="button"
          onClick={toggleMirrorV}
          aria-pressed={mirrorV}
          title="Mirror vertically (top ↔ bottom)"
          className={`rb-btn ${mirrorV ? 'mirror-on' : ''}`}
        >
          ⇅ V
        </button>
      </div>

      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={`rb-btn ${theme === 'light' ? 'active' : ''}`}
      >
        {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
      </button>

      <Link href="/settings" className="rb-btn">
        ⚙ Settings
      </Link>
    </div>
  );
}
