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
  const restartNonce = useScriptStore((s) => s.restartNonce);
  const isRunning = useScriptStore((s) => s.isRunning);
  const cursor = useScriptStore((s) => s.cursor);
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
  // the visually-active word is one back. cursor=0 → activeIdx=-1 → no-op.
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
  // fire once on mount and miss subsequent restarts.
  useEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.scrollTop = 0;
    }
  }, [restartNonce]);

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
          style={{
            height: '100%',
            width: '90%',
            maxWidth: 1500,
            overflowY: 'auto',
            padding: '30vh 0 80vh',
            fontSize: `${fontSize}px`,
            lineHeight,
            scrollBehavior: 'auto',
          }}
        >
          {tokens.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              Start writing your script…{' '}
              <span style={{ color: 'var(--text-ghost)' }}>(click ✎ Edit)</span>
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

      {/* v0.3 Manual mode reading guide — faint horizontal line at the vertical
          center. Lives OUTSIDE the mirrored container so the guide isn't
          flipped. Pointer-events:none so it never intercepts word clicks. */}
      {scrollMode === 'manual' ? (
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
            style={{
              margin: '0 auto',
              height: 1,
              maxWidth: 1500,
              width: '90%',
              background: 'var(--tnm-amber-line)',
            }}
          />
        </div>
      ) : null}
    </>
  );
}
