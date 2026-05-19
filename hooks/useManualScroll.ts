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
// WPM → pixels/second conversion:
//   pps = (wpm / 60) * pixelsPerWord
//   pixelsPerWord = (scrollHeight - clientHeight) / wordCount
//     We use the SCROLLABLE distance (not full scrollHeight) so wpm maps to
//     "time to scroll from top to bottom". A 100-word script at 100wpm takes
//     1 minute end-to-end, regardless of font size.
//
// CRITICAL: scrollTop integer truncation
//   Browsers return `el.scrollTop` as an integer (or near-integer rounded to
//   device pixel ratio). When pps × dt < 1 (slow scroll, tiny dt), each
//   per-frame fractional delta gets truncated on read-back, freezing the
//   scroll at the starting integer. v0.3 fix: maintain `acc` (fractional
//   accumulator) in a closure, only write to scrollTop when acc ≥ 1.

import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';

type Options = {
  /** True = run the rAF loop. False = idle. */
  enabled: boolean;
  /** Words per minute. Clamped by caller (settings store clamps 50–200). */
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
        // Re-read store each tick so script edits / font-size changes mid-
        // scroll are honored without restarting the hook. getState is sync.
        const wordCount =
          useScriptStore.getState().tokens.filter((t) => !t.isWhitespace).length ||
          1;

        // pixelsPerWord based on the SCROLLABLE distance, not full scrollHeight.
        const pixelsPerWord = totalHeight / wordCount;
        const pps = (wpm / 60) * pixelsPerWord;

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
