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
// Behavior:
//   - When `enabled` is false the hook is a no-op.
//   - When `activeIdx` changes AND a token-marked element exists with the
//     matching `data-word-idx`, it scrollIntoView({ block: 'center',
//     behavior: 'smooth' }).
//   - Empty containerRef / missing target → silent no-op.

import { useEffect } from 'react';
import type { RefObject } from 'react';

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
  useEffect(() => {
    if (!enabled) return;
    if (activeIdx < 0) return;
    const container = containerRef.current;
    if (!container) return;

    const el = container.querySelector(
      `[data-word-idx="${activeIdx}"]`
    ) as HTMLElement | null;
    if (!el) return;

    // `scrollIntoView` honors the smooth behavior on Chrome/Safari/Firefox
    // 2020+. Block: 'center' keeps the active word at the focal line, which
    // is the cueprompter convention Touch is used to.
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIdx, containerRef, enabled]);
}
