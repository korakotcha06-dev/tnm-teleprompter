// v0.2 word matcher — EXACT match only. Levenshtein/fuzzy lands in v0.3.
//
// Design contract:
//   - Input: a heard word (raw transcript fragment) + the full token array
//     (which includes whitespace tokens — they must be skipped) + the current
//     cursor (absolute index into the token array).
//   - Output: the absolute token index of the matched word OR -1.
//
// Returning an ABSOLUTE index keeps the store's `advanceCursor(n)` happy:
//   `advanceCursor(matchedIdx - cursor + 1)` advances past the matched word
//   AND highlights every whitespace/word token between the old cursor and the
//   match — that's the existing v0.1 semantics, unchanged.
//
// Window = 3 word-like tokens (NOT 3 array slots). Lets the matcher tolerate
// whitespace between words without burning lookahead distance.
//
// v0.3 will rename this file to window-match.ts and add Levenshtein; the
// signature here is shaped to make that refactor a drop-in.

import type { Token } from '@/types';

/** Number of word-like tokens to look ahead from the current cursor. */
export const MATCH_WINDOW = 3;

/**
 * Normalize a token's text for exact comparison.
 *
 * - Trim whitespace.
 * - Lowercase Latin characters (Thai is unaffected by `toLowerCase`).
 * - Strip a small punctuation set that the Web Speech transcript commonly
 *   adds OR that script content commonly contains. We don't strip every
 *   non-letter glyph because Thai vowels/tone marks would be killed.
 */
export function normalizeWord(input: string): string {
  return input
    .trim()
    .toLowerCase()
    // Common punctuation around English speech transcripts + script text.
    // Thai punctuation (ฯ ๆ) is intentionally preserved as it can be part of a word.
    .replace(/[.,!?;:"'()[\]{}—–-]/g, '');
}

/**
 * Try to match a heard word against the next MATCH_WINDOW word-like tokens
 * starting at `cursor`. Returns the absolute token index of the match, or -1.
 *
 * Whitespace tokens are skipped (they don't count toward the window) but
 * remain in the token array so the absolute index returned is still a valid
 * direct address into `tokens`.
 */
export function matchWordExact(
  heardWord: string,
  tokens: Token[],
  cursor: number
): number {
  const heard = normalizeWord(heardWord);
  if (heard.length === 0) return -1;
  if (cursor >= tokens.length) return -1;

  let wordsSeen = 0;
  for (let i = cursor; i < tokens.length && wordsSeen < MATCH_WINDOW; i++) {
    const tok = tokens[i];
    if (tok.isWhitespace) continue;
    wordsSeen += 1;
    if (normalizeWord(tok.text) === heard) {
      return i;
    }
  }
  return -1;
}

/**
 * Match a sequence of heard words (e.g. interim transcript split into words).
 * Returns the furthest absolute index advanced to, or -1 if nothing matched.
 *
 * Strategy: greedy left-to-right. Each successful match advances the search
 * floor so we don't double-count the same script word for repeated heard
 * fragments (Web Speech streams interims like "hello", "hello world",
 * "hello world how" — naive matching would highlight "hello" three times).
 */
export function matchSequenceExact(
  heardWords: string[],
  tokens: Token[],
  cursor: number
): number {
  let floor = cursor;
  let lastMatched = -1;
  for (const w of heardWords) {
    const idx = matchWordExact(w, tokens, floor);
    if (idx >= 0) {
      lastMatched = idx;
      floor = idx + 1;
    }
  }
  return lastMatched;
}
