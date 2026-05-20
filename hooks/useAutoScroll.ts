'use client';

// useAutoScroll — keep the active word vertically centered in the scroll
// container as the cursor advances.
//
// v0.2 had a simple effect inside TeleprompterView that did the same thing
// but was always-on. v0.3 pulls it into a dedicated hook so:
//   1. Edit mode can disable it (typing into a scrolling pane is awful).
//   2. Manual scroll mode can take over with its own scroll engine without
//      fighting this one.
//   3. We can pass a different "active index" than the raw cursor — for
//      voice mode the active idx is `cursor - 1` (the just-matched word
//      that should be at the focal line), not the look-ahead cursor.
//
// v0.5.2 — rAF-EASED CONTINUOUS SCROLL (replaces native scrollIntoView).
//   WHY THE REWRITE — Touch: "เลื่อนบรรทัดเด้งไปมา ลายตา … smooth ที่สุด".
//   The old hook fired `el.scrollIntoView({ behavior: 'smooth' })` on EVERY
//   activeIdx change (= every matched word). Each call kicks off a fresh
//   native smooth animation toward a new center. When words arrive faster
//   than ~300ms (normal speech) the browser restarts the animation mid-flight
//   — the easing curve resets from a new velocity each time, producing the
//   visible "bounce" / stutter, worst when the active word jumps to a new line.
//
//   The fix is a single long-lived requestAnimationFrame loop that owns a
//   `target` scrollTop and eases the *current* scrollTop toward it every frame
//   (current += (target - current) * EASE). When activeIdx changes we only
//   move the target — the in-flight motion is never restarted, so a burst of
//   words just keeps nudging the same continuous glide. No collision, no
//   bounce, smooth retargeting by construction.
//
//   The target is recomputed from the live `el.offsetTop` each frame, so font
//   size / line-height / side-padding changes (which reflow the column) are
//   honored automatically — no need to key the effect on layout settings.
//
// Coordinate note (mirror): scrollTop is written on the INNER scroller, which
// lives in normal (unflipped) layout space — the scaleX/scaleY mirror lives on
// an outer non-scrolling wrapper. offsetTop is therefore measured in the same
// unflipped space, so the centering math is correct under H/V mirror with no
// inversion. (Same invariant the old scrollIntoView relied on.)
//
// scrollBehavior gotcha (v0.3): globals.css applies `scroll-behavior: smooth`
// to *, and TeleprompterView pins the inner scroller to `scrollBehavior:'auto'`
// inline. That MUST stay — otherwise every per-frame scrollTop write below
// would itself be animated by CSS smooth, fighting our easing and freezing the
// container. We only ever write scrollTop imperatively here.
//
// Behavior:
//   - When `enabled` is false the hook tears down the loop (no-op).
//   - While enabled, the loop centers the element matching the current
//     activeIdx's `data-word-idx`, easing continuously.
//   - Missing target element / empty container → that frame is skipped; the
//     loop keeps polling so it picks up once layout/tokens settle.

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

// ── Feel-calibration constants (v0.5.2) — Touch will iterate on these ───────
// EASE_FACTOR: fraction of the remaining (target - current) distance closed
//   per frame. At 60fps, 0.12 ≈ a ~120ms time-constant glide — smooth and
//   responsive without lagging behind fast speech. Higher = snappier/closer to
//   the old per-word jump; lower = floatier. Tune this single number if Touch
//   wants it tighter or dreamier.
const EASE_FACTOR = 0.07;
// SETTLE_PX: once |target - current| drops below this, snap to target and idle
//   the easing math (we still keep the loop alive while enabled so a new word
//   instantly resumes motion). Sub-pixel residue would otherwise ease forever.
const SETTLE_PX = 0.5;
// DEAD_ZONE_PX: if the active word's center is already within this many pixels
//   of the container's vertical center, leave the target where it is — don't
//   chase micro-offsets. Kills the jittery "re-center on every word even though
//   it barely moved" twitch; the column only glides when a word genuinely
//   drifts off the focal band (e.g. crossing to a new line).
const DEAD_ZONE_PX = 24;

type Options = {
  /**
   * Master gate. False = hook does nothing (e.g. in edit mode, or when
   * manual scroll engine owns scrollTop).
   */
  enabled: boolean;
};

export function useAutoScroll(
  activeIdx: number,
  containerRef: RefObject<HTMLElement | null>,
  { enabled }: Options
): void {
  // Live target index, updated cheaply when the cursor advances — WITHOUT
  // restarting the rAF loop (that's the whole point of the rewrite).
  const targetIdxRef = useRef(activeIdx);

  useEffect(() => {
    targetIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    let rafId = 0;
    // Fractional scroll position we own and ease. Seed from the real scrollTop
    // so enabling mid-scroll (or after a Restart reset to 0) glides from where
    // the container actually is rather than snapping.
    let current = el.scrollTop;

    const tick = () => {
      const idx = targetIdxRef.current;
      if (idx >= 0) {
        const word = el.querySelector(
          `[data-word-idx="${idx}"]`
        ) as HTMLElement | null;

        if (word) {
          // Target scrollTop that lands the active word's center on the
          // container's vertical center. offsetTop is relative to the scroller's
          // padded content box, which is exactly the scrollTop coordinate space.
          const containerCenter = el.clientHeight / 2;
          const wordCenter = word.offsetTop + word.offsetHeight / 2;
          const maxScroll = el.scrollHeight - el.clientHeight;
          let target = wordCenter - containerCenter;
          if (target < 0) target = 0;
          else if (target > maxScroll) target = maxScroll;

          // Dead-zone: only chase the target if the word's center has drifted
          // meaningfully off the focal band. Compare against the live scrollTop
          // (where the user actually sees it), not our eased `current`.
          const offsetFromCenter = wordCenter - (el.scrollTop + containerCenter);
          if (Math.abs(offsetFromCenter) > DEAD_ZONE_PX) {
            const dist = target - current;
            if (Math.abs(dist) < SETTLE_PX) {
              current = target;
            } else {
              current += dist * EASE_FACTOR;
            }
            // Write fractional `current` straight to scrollTop. The browser
            // rounds on read-back, but because we keep the fractional value in
            // `current` (not re-read from scrollTop) there's no truncation
            // deadlock — same anti-truncation pattern as useManualScroll.
            el.scrollTop = current;
          } else {
            // In the dead-zone: resync `current` to the real position so when
            // the word later drifts out we ease from where things actually are.
            current = el.scrollTop;
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
    // Intentionally NOT keyed on activeIdx — the loop reads it live via the ref
    // so a word burst retargets without tearing down / restarting the glide.
  }, [containerRef, enabled]);
}
