'use client';

import { memo } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';

type Props = {
  index: number;
  text: string;
  isWhitespace: boolean;
};

/**
 * Renders a single tokenized unit. Memoized + uses selector subscription
 * so only the spans whose state actually changes re-render — critical when
 * voice integration arrives in v0.2 and highlights advance 3-10 times/sec
 * across hundreds of words.
 */
function WordSpanInner({ index, text, isWhitespace }: Props) {
  const isHighlighted = useScriptStore((s) => s.highlightedIndices.has(index));
  const isSkipped = useScriptStore((s) => s.skippedIndices.has(index));
  const isCurrent = useScriptStore((s) => s.cursor === index);

  // Whitespace tokens still carry `data-word-idx` so the token-index space
  // in the DOM is contiguous (0…N-1, no gaps) — required by v0.1 Acceptance
  // Criteria. They render as bare text (no highlight state) and the matcher
  // skips them by content.
  if (isWhitespace) {
    return <span data-word-idx={index}>{text}</span>;
  }

  // v0.3 highlight grammar — four-state palette:
  //   pending    : zinc-100/30  → dim, "not yet read"
  //   current    : amber-300    → live cursor, subtle bg slab
  //   highlighted: zinc-100     → fully present, "already read"
  //   skipped    : zinc-400     → muted-readable, "speaker jumped past this"
  //                Between pending and consumed. Touch sees the skip without
  //                being confused into thinking those words were spoken.
  //
  // Priority order when multiple flags are set (can happen because the
  // matcher marks-skipped + advances-cursor in the same tick):
  //   current > skipped > highlighted > pending
  const className = isCurrent
    ? 'rounded-sm bg-amber-300/10 px-0.5 text-amber-300 transition-colors duration-150'
    : isSkipped
      ? 'text-zinc-400 italic transition-colors duration-300'
      : isHighlighted
        ? 'text-zinc-100 transition-colors duration-300'
        : 'text-zinc-100/30 transition-colors duration-300';

  return (
    // data-word-idx is the spec-mandated attribute used by:
    //   - useAutoScroll querySelector (v0.3)
    //   - word-matcher (highlight lookup)
    //   - QA acceptance test (verifies tokenization is 0-based + sequential)
    <span data-word-idx={index} className={className}>
      {text}
    </span>
  );
}

export const WordSpan = memo(WordSpanInner);
