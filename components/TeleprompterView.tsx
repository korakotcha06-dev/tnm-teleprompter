'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
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
  const isRunning = useScriptStore((s) => s.isRunning);
  const cursor = useScriptStore((s) => s.cursor);
  const setCursor = useScriptStore((s) => s.setCursor);
  const setTokensFromContent = useScriptStore((s) => s.setTokensFromContent);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const mirrorMode = useSettingsStore((s) => s.mirrorMode); // horizontal
  const mirrorV = useSettingsStore((s) => s.mirrorV); // vertical (v0.3.1)
  const scrollMode = useSettingsStore((s) => s.scrollMode);
  const manualSpeed = useSettingsStore((s) => s.manualSpeed);
  const sidePadding = useSettingsStore((s) => s.sidePadding); // % per side (v0.5.1)

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

  // Voice mode auto-scroll: keep the word the reader is ABOUT TO read on the
  // focal line. We pass `cursor` (the next-to-read word, which is also the one
  // WordSpan paints as `.cur`) — NOT cursor-1 — so the reading guide line sits
  // on the word being read now, not on text already spoken.
  const voiceAutoScrollEnabled = scrollMode === 'voice' && isRunning;
  useAutoScroll(cursor, wrapperRef, {
    enabled: voiceAutoScrollEnabled,
    // cueprompter-style: drag/wheel the script to re-read, and voice playback
    // continues from the word you land on.
    onSeek: setCursor,
  });

  // Manual mode auto-scroll: constant velocity, WPM-driven.
  const manualScrollEnabled = scrollMode === 'manual' && isRunning;
  useManualScroll({
    enabled: manualScrollEnabled,
    wpm: manualSpeed,
    containerRef: wrapperRef,
  });

  // Resume-in-place: restore the shared scroll position on mount and save it
  // back on unmount. Pausing swaps to the editor and back; carrying scrollTop
  // through the store keeps the reading position (no jump to top). On Restart
  // the store sets runScrollTop=0, so a fresh mount lands at the top. Runs as a
  // layout effect (before paint) so it's set before the scroll hooks' effects
  // seed their position from scrollTop.
  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (el) el.scrollTop = useScriptStore.getState().runScrollTop;
    return () => {
      if (el) useScriptStore.getState().setRunScrollTop(el.scrollTop);
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="run-scroll" style={{ alignItems: 'center' }}>
        <span className="dim mono">Loading…</span>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="run-scroll" style={{ alignItems: 'center' }}>
        <span className="mono" style={{ color: '#C97A55' }}>
          Script not found.
        </span>
      </div>
    );
  }

  // v0.3.1 mirror — H and V are independent (beam-splitter rigs vary by mount).
  // CRITICAL ARCHITECTURE: the mirror transform lives on an OUTER, NON-SCROLLING
  // wrapper, while the inner element keeps `ref={wrapperRef}` and owns scrollTop.
  //   - If scaleY(-1) were applied to the scroll container itself, the rendered
  //     image would flip but scrollTop still advances in normal layout space →
  //     the user perceives the text scrolling the WRONG way. Both useManualScroll
  //     (scrollTop writes) and useAutoScroll (scrollIntoView centering) compute
  //     in unflipped coordinates.
  //   - By flipping the OUTER wrapper (a fixed-size, non-scrolling box that simply
  //     contains the scroller), the optical mirror is applied to the final
  //     composited frame — exactly what physical beam-splitter glass does — and
  //     scroll math stays untouched. No delta inversion, no hacks.
  const mirrorTransform =
    mirrorMode || mirrorV
      ? `scaleX(${mirrorMode ? -1 : 1}) scaleY(${mirrorV ? -1 : 1})`
      : 'none';

  return (
    <>
      {/* Outer mirror wrapper — applies the optical flip(s) to the whole
          viewport image. Non-scrolling fixed frame; the nested scroll
          container owns scrollTop in normal (unflipped) coordinates. */}
      <div
        className="run-scroll"
        style={{ overflow: 'hidden', transform: mirrorTransform }}
      >
        <div
          ref={wrapperRef}
          // scrollBehavior: 'auto' is critical — globals.css applies `smooth`
          // to *, which would otherwise animate every rAF-frame scrollTop write
          // and freeze the container at scrollTop=0. useAutoScroll passes
          // behavior: 'smooth' explicitly via scrollIntoView, overriding this.
          className="run-text"
          // v0.5.1 side padding: the design centered a width:90% column via
          // .run-scroll flex, but that flex rule never made it into the real
          // globals.css — so text hugged the left edge on prod. We now drive
          // the gutter explicitly with left/right padding (% of viewport) on
          // this inner scroller, keeping width:100% + border-box. maxWidth caps
          // the line length on wide monitors; margin:auto re-centers the capped
          // column. Padding lives here (inner, scrolling) — NOT on the outer
          // mirror wrapper — so scaleX/scaleY and scrollTop math are untouched.
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
          {tokens.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              Start writing your script…{' '}
              <span style={{ color: 'var(--text-ghost)' }}>(restart to edit)</span>
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

      {/* Reading guide — faint horizontal "leading line" at the vertical center
          (the focal point auto-scroll keeps the active word on). Shown in BOTH
          voice + manual modes (v0.5.2) to help the reader track the focal line.
          Lives OUTSIDE the mirrored container so it isn't flipped;
          pointer-events:none so it never intercepts word clicks. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: '50%',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <div
          // Match the text gutter (v0.5.1): span the viewport minus the same
          // sidePadding% on each side, capped to the text column maxWidth.
          style={{
            margin: '0 auto',
            height: 1,
            maxWidth: 1500,
            width: `calc(100% - ${sidePadding * 2}vw)`,
            background: 'rgba(255, 180, 0, 0.18)',
          }}
        />
      </div>
    </>
  );
}
