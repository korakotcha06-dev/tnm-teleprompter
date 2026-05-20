'use client';

import { useEffect, useRef } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useManualScroll } from '@/hooks/useManualScroll';
import { WordSpan } from './WordSpan';

type Props = {
  scriptId: string;
};

export function TeleprompterView({ scriptId }: Props) {
  const hydrated = useScriptStore((s) => s.hydrated);
  const hydrate = useScriptStore((s) => s.hydrate);
  const script = useScriptStore((s) =>
    s.scripts.find((x) => x.id === scriptId)
  );
  const tokens = useScriptStore((s) => s.tokens);
  const cursor = useScriptStore((s) => s.cursor);
  const isRunning = useScriptStore((s) => s.isRunning);
  const restartNonce = useScriptStore((s) => s.restartNonce);
  const setTokensFromContent = useScriptStore((s) => s.setTokensFromContent);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const mirrorMode = useSettingsStore((s) => s.mirrorMode); // horizontal
  const mirrorV = useSettingsStore((s) => s.mirrorV); // vertical (v0.3.1)
  const scrollMode = useSettingsStore((s) => s.scrollMode);
  const manualSpeed = useSettingsStore((s) => s.manualSpeed);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Hydrate the script store on first mount
  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  // Re-tokenize whenever the script changes (covers initial load + post-edit
  // exit, where InlineScriptEditor flushed the latest content to the store).
  useEffect(() => {
    if (script) setTokensFromContent(script.content, script.language);
  }, [script, setTokensFromContent]);

  // Voice mode auto-scroll: keep the most-recently-matched word centered.
  // We pass `cursor - 1` because cursor points AT the next-to-read word —
  // the visually-active word (just consumed / current accent) is one back.
  // For an empty/just-restarted state cursor=0 → activeIdx=-1 → useAutoScroll
  // becomes a no-op which is the correct behavior.
  const voiceAutoScrollEnabled = scrollMode === 'voice' && isRunning;
  useAutoScroll(Math.max(cursor - 1, 0), wrapperRef, {
    enabled: voiceAutoScrollEnabled,
  });

  // Manual mode auto-scroll: constant velocity, WPM-driven.
  const manualScrollEnabled = scrollMode === 'manual' && isRunning;
  useManualScroll({
    enabled: manualScrollEnabled,
    wpm: manualSpeed,
    containerRef: wrapperRef,
  });

  // Reset scrollTop to 0 on every Restart. We key on `restartNonce` (bumped
  // by the store's restart action) rather than `cursor === 0` because in
  // manual mode the cursor never leaves 0 — a cursor-based effect would only
  // fire once on mount and miss subsequent restarts. The nonce changes on
  // every restart, guaranteeing the reset fires for both voice and manual.
  useEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.scrollTop = 0;
    }
  }, [restartNonce]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!script) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-red-400">
        Script not found.
      </div>
    );
  }

  // v0.3.1 mirror — H and V are independent (beam-splitter rigs vary by mount).
  // CRITICAL ARCHITECTURE: the mirror transform lives on an OUTER, NON-SCROLLING
  // wrapper, while the inner element keeps `ref={wrapperRef}` and owns scrollTop.
  //   - If scaleY(-1) were applied to the scroll container itself, the rendered
  //     image would flip but scrollTop still advances in normal layout space →
  //     the user perceives the text scrolling the WRONG way (sticking point of
  //     this task). Both useManualScroll (scrollTop writes) and useAutoScroll
  //     (scrollIntoView centering) compute in unflipped coordinates.
  //   - By flipping the OUTER wrapper (a fixed-size, non-scrolling box that
  //     simply contains the scroller), the optical mirror is applied to the
  //     final composited frame — exactly what physical beam-splitter glass does
  //     — and scroll math stays untouched. No delta inversion, no hacks.
  // scaleX(-1) horizontal, scaleY(-1) vertical, composable simultaneously.
  const mirrorTransform =
    mirrorMode || mirrorV
      ? `scaleX(${mirrorMode ? -1 : 1}) scaleY(${mirrorV ? -1 : 1})`
      : 'none';

  return (
    <div className="relative">
      {/* Outer mirror wrapper — applies the optical flip(s) to the whole
          viewport image. Non-scrolling: h-screen + overflow-hidden so it's a
          fixed frame. The scroll container nested inside owns scrollTop in
          normal (unflipped) coordinates — see ARCHITECTURE note above. */}
      <div
        className="h-screen w-full overflow-hidden bg-black"
        style={{ transform: mirrorTransform }}
      >
        <div
          ref={wrapperRef}
          // v0.3: switched from `min-h-screen` → `h-screen` so the wrapper is
          // a fixed-height scroll viewport. useManualScroll writes scrollTop
          // here, which silently no-ops if the WINDOW is the actual scroller
          // (which was the v0.2 case — min-h-screen + content grew the box
          // and let document.documentElement.scrollTop own scrolling).
          //
          // scrollBehavior: 'auto' is critical — globals.css applies `smooth`
          // to *, which would otherwise animate every rAF-frame scrollTop write
          // and effectively cancel each previous interpolation, freezing the
          // container at scrollTop=0. useAutoScroll passes behavior: 'smooth'
          // explicitly via scrollIntoView, which overrides the inline auto.
          className="h-full w-full overflow-y-auto px-12 py-32"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight,
            scrollBehavior: 'auto',
          }}
        >
          <div className="mx-auto max-w-5xl font-thai font-medium">
            {tokens.length === 0 ? (
              <p className="text-center text-2xl text-zinc-600">
                Start writing your script… <span className="text-zinc-700">(click ✎ Edit)</span>
              </p>
            ) : (
              tokens.map((t) => (
                <WordSpan
                  key={t.index}
                  index={t.index}
                  text={t.text}
                  isWhitespace={t.isWhitespace}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* v0.3 Manual mode reading guide — a faint horizontal line at the
          vertical center of the viewport. Tells the reader exactly where
          to focus their eye as the text scrolls under. Only visible in
          manual mode (voice mode has the amber cursor highlight instead).
          Pointer-events:none so it never intercepts clicks on words below.
          Lives OUTSIDE the mirrored container so the guide isn't flipped. */}
      {scrollMode === 'manual' ? (
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 right-0 top-1/2 z-30"
        >
          <div className="mx-auto h-px max-w-5xl bg-amber-300/25" />
        </div>
      ) : null}
    </div>
  );
}
