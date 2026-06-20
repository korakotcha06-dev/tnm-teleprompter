'use client';

import { memo } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';

type Props = {
  index: number;
  text: string;
  isWhitespace: boolean;
};

/**
 * Renders a single tokenized unit. Memoized + uses selector subscription
 * so only the spans whose state actually changes re-render — critical when
 * voice highlights advance several times/sec across hundreds of words.
 */
function WordSpanInner({ index, text, isWhitespace }: Props) {
  const isHighlighted = useScriptStore((s) => s.highlightedIndices.has(index));
  const isSkipped = useScriptStore((s) => s.skippedIndices.has(index));
  // Single-word highlight: the cursor word gets the amber slab. Gated to voice
  // mode + running so manual scroll never paints an amber word.
  const isOnCursor = useScriptStore((s) => s.isRunning && s.cursor === index);
  const voiceMode = useSettingsStore((s) => s.scrollMode === 'voice');
  const isCurrent = isOnCursor && voiceMode;

  // Whitespace tokens still carry `data-word-idx` so the token-index space
  // in the DOM is contiguous (0…N-1, no gaps) — required by the v0.1
  // Acceptance Criteria. They render as bare text (no highlight state).
  if (isWhitespace) {
    return <span data-word-idx={index}>{text}</span>;
  }

  // v0.5.0: highlight grammar mapped onto the brand `.w` classes (styled in
  // globals.css, dark + .run-stage.light variants). Four-state palette:
  //   pending    : dim "not yet read"
  //   current    : amber slab (.cur) — warm-dark bg / amber text (light: amber bg / black)
  //   read        : full-strength "already read"
  //   skipped    : muted-readable "speaker jumped past this"
  // Priority order when multiple flags are set (matcher may mark-skipped +
  // advance-cursor in the same tick): current > skipped > read > pending.
  const state = isCurrent
    ? 'cur'
    : isSkipped
      ? 'skipped'
      : isHighlighted
        ? 'read'
        : 'pending';

  // data-word-idx is the spec-mandated attribute used by useAutoScroll's
  // querySelector, the word-matcher highlight lookup, and the QA tokenization
  // acceptance test.
  return (
    <span data-word-idx={index} className={`w ${state}`}>
      {text}
    </span>
  );
}

export const WordSpan = memo(WordSpanInner);
