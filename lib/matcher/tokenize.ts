import type { Token, Language } from '@/types';

/**
 * Tokenize a script for teleprompter display.
 *
 * Uses Intl.Segmenter('th') natively for Thai — Thai script doesn't insert
 * spaces between intra-sentence words, so naive whitespace split breaks.
 *
 * Mixed Thai+English (e.g. "เปิด Photoshop ก่อน") is handled by the same
 * segmenter since it falls back to whitespace boundaries for Latin text.
 *
 * Each token has a stable `index` used by:
 *   - `<WordSpan index={i}>` keyed render
 *   - `highlightedIndices: Set<number>` (which words have been read)
 *   - `cursor` (current word position)
 */
export function tokenize(content: string, language: Language = 'th'): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(language, { granularity: 'word' });
    for (const seg of segmenter.segment(content)) {
      const isWS = !seg.isWordLike && /^\s+$/.test(seg.segment);
      tokens.push({
        index: index++,
        text: seg.segment,
        isWhitespace: isWS,
      });
    }
    return tokens;
  }

  // Fallback for older environments (no Intl.Segmenter)
  const parts = content.split(/(\s+)/);
  for (const p of parts) {
    if (p.length === 0) continue;
    tokens.push({
      index: index++,
      text: p,
      isWhitespace: /^\s+$/.test(p),
    });
  }
  return tokens;
}

/** Returns only non-whitespace tokens. Used by the word-matcher in v0.3. */
export function wordTokens(tokens: Token[]): Token[] {
  return tokens.filter((t) => !t.isWhitespace);
}
