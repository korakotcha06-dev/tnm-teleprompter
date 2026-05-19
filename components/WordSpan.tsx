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

  const className = isCurrent
    ? 'text-amber-400 transition-colors duration-150'
    : isHighlighted
      ? 'text-zinc-500 transition-colors duration-300'
      : 'text-zinc-100';

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
