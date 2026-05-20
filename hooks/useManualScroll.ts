'use client';

// useManualScroll — constant-velocity auto-scroll for the manual mode.
//
// In manual mode there's no voice signal — the script just scrolls upward at
// a user-controlled WPM. We use requestAnimationFrame instead of setInterval
// because:
//   1. rAF is paced to the display refresh, so motion stays buttery on 60Hz
//      and 120Hz screens alike.
//   2. setInterval drifts under load; rAF self-corrects to wall-clock dt.
//   3. Browsers throttle rAF when the tab is backgrounded (free pause).
//
// WPM → pixels/second conversion (v0.3.1 recalibration):
//   pps = (wpm / WORDS_PER_LINE) * pixelsPerLine / 60 * SPEED_MULTIPLIER
//   pixelsPerLine = lineHeight * fontSize   (the real rendered line box)
//
//   WHY THE REWRITE — Touch: "ดูช้าไปมาก".
//   The old model was pps = (wpm/60) * (scrollHeight - clientHeight)/wordCount.
//   That normalizes the WHOLE script to take wordCount/wpm minutes. But it
//   subtracts a full viewport (clientHeight) of words from the travel distance
//   while still dividing by the TOTAL word count — so pixels-per-word shrinks
//   as the script gets longer, and longer scripts crawl. The undercount scales
//   with length, which is exactly the "feels way too slow" symptom.
//
//   The new model is length-independent: it tracks reading pace directly. A
//   reader consumes WORDS_PER_LINE words per rendered line; at `wpm` words/min
//   that's wpm/WORDS_PER_LINE lines/min; each line is `lineHeight*fontSize`px
//   tall. So the viewport should travel that many pixels per minute. This
//   matches the felt pace of reading aloud and doesn't decay with length.
//
//   SPEED_MULTIPLIER + WORDS_PER_LINE are named constants below — this is a
//   feel calibration Touch will iterate on, so they're trivial to nudge.
//
// CRITICAL: scrollTop integer truncation
//   Browsers return `el.scrollTop` as an integer (or near-integer rounded to
//   device pixel ratio). When pps × dt < 1 (slow scroll, tiny dt), each
//   per-frame fractional delta gets truncated on read-back, freezing the
//   scroll at the starting integer. v0.3 fix: maintain `acc` (fractional
//   accumulator) in a closure, only write to scrollTop when acc ≥ 1.

import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';

// ── Feel-calibration constants (v0.3.1) — Touch will iterate on these ───────
// WORDS_PER_LINE: average words a reader consumes per rendered line. Lower =
//   faster scroll for the same WPM (fewer lines hold the same words → travel
//   more pixels). Thai + English read-aloud scripts at the default 48px /
//   max-w-5xl box land around 8–10 words/line; 8 keeps it lively.
export const WORDS_PER_LINE = 8;
// SPEED_MULTIPLIER: global gain on top of the reading-pace model. 1.0 = exact
//   "lines per minute" math. We bias to 1.6 because the pure model still felt
//   conservative in testing and Touch explicitly wants headroom. Bump this
//   single number if "ยังช้า"; lower it if "เร็วไป".
export const SPEED_MULTIPLIER = 1.6;

type Options = {
  /** True = run the rAF loop. False = idle. */
  enabled: boolean;
  /** Words per minute. Clamped by caller (settings store clamps 50–500). */
  wpm: number;
  /** Scroll container ref (the element with overflow-y: auto). */
  containerRef: RefObject<HTMLElement | null>;
};

export function useManualScroll({ enabled, wpm, containerRef }: Options): void {
  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    let rafId = 0;
    let last = performance.now();
    // Fractional pixel accumulator — see "scrollTop integer truncation" above.
    // Initialize from current scrollTop so resuming after pause doesn't snap
    // back to the previous integer boundary.
    let acc = el.scrollTop;

    const tick = (now: number) => {
      const dt = (now - last) / 1000; // seconds
      last = now;

      const totalHeight = el.scrollHeight - el.clientHeight;

      if (totalHeight > 0) {
        // Re-read settings each tick so font-size / line-height changes mid-
        // scroll are honored without restarting the hook. getState is sync.
        // (Word count is no longer part of the velocity — the new model is
        // length-independent reading pace, see header.)
        const { fontSize, lineHeight } = useSettingsStore.getState();
        const pixelsPerLine = lineHeight * fontSize;

        // lines/min = wpm / WORDS_PER_LINE → px/min = lines/min * pixelsPerLine
        // → px/sec = px/min / 60, then global feel gain.
        const pps =
          ((wpm / WORDS_PER_LINE) * pixelsPerLine * SPEED_MULTIPLIER) / 60;

        acc = Math.min(acc + pps * dt, totalHeight);
        // Only commit to scrollTop when the integer part changes — avoids
        // the fractional-truncation deadlock.
        el.scrollTop = acc;

        if (acc >= totalHeight) {
          // Reached the bottom — stop the loop. User can Restart to reset.
          return;
        }
      }
      // Keep ticking even when totalHeight=0 — layout may settle next frame
      // (e.g. first mount under StrictMode double-effect, fonts still loading).

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [enabled, wpm, containerRef]);
}
