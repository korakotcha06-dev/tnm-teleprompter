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
  const isCurrent = useScriptStore((s) => s.cursor === index);

  // Whitespace tokens still carry `data-word-idx` so the token-index space
  // in the DOM is contiguous (0…N-1, no gaps) — required by v0.1 Acceptance
  // Criteria. They render as bare text (no highlight state) and the matcher
  // skips them by content.
  if (isWhitespace) {
    return <span data-word-idx={index}>{text}</span>;
  }

  // v0.2 highlight grammar — luxury minimal palette:
  //   pending    : zinc-100/30  → dim, "not yet read"
  //   current    : amber-300    → bright single-tone accent on the live word,
  //                with a subtle background slab so the eye locks on without
  //                the page feeling busy. No box-shadow, no border — keeps
  //                the typography front-and-center.
  //   highlighted: zinc-100     → fully present but neutral, "already read"
  //
  // Note this inverts v0.1's pending/highlighted intensity. v0.1 had no voice
  // signal so every word was bright; v0.2 introduces the active reading flow
  // where dim = upcoming and full = consumed. Documented in 03 Changelog.
  const className = isCurrent
    ? 'rounded-sm bg-amber-300/10 px-0.5 text-amber-300 transition-colors duration-150'
    : isHighlighted
      ? 'text-zinc-100 transition-colors duration-300'
      : 'text-zinc-100/30 transition-colors duration-300';

  return (
    // data-word-idx is the spec-mandated attribute used by:
    //   - TeleprompterView auto-scroll querySelector
    //   - v0.3 word-matcher (highlight lookup)
    //   - QA acceptance test (verifies tokenization is 0-based + sequential)
    <span data-word-idx={index} className={className}>
      {text}
    </span>
  );
}

export const WordSpan = memo(WordSpanInner);
