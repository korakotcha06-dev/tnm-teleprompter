// v0.3 word matcher — Levenshtein fuzzy match + skip-ahead window.
//
// Why this exists (compared to v0.2's exactMatch):
//   v0.2's exact-match-only matcher with WINDOW=3 traps the cursor behind a
//   speaker who skipped, mispronounced, or reordered a word. Touch's brief:
//   "พอเป็นขีดแบ่งแบบนี้ น่าจะต้องข้ามไปตรงที่อ่านได้เลย" — when the speaker
//   skips words, the cursor must jump forward to where they actually are,
//   not patiently re-attempt the skipped word.
//
// What changed:
//   - WINDOW expanded 3 → 10 word-like tokens. Tolerates skips up to ~10 words.
//   - Levenshtein with MAX_DISTANCE=2 admits near-misses ("อาจาน" ≈ "อาจารย์").
//   - SKIP_THRESHOLD=5: when a single match jumps the cursor by more than 5
//     word-tokens, the intermediate words are flagged "skipped" so the UI
//     can render them in a muted-but-readable state (between pending and
//     consumed). Touch sees instantly that the engine recognized the skip.
//   - Short words (≤ 2 chars) fall back to exact match. Fuzzy on tiny words
//     causes catastrophic false matches ("ที่" ≈ "ก็" at distance 2 if you
//     compare bytes naively).
//
// Returned shape is richer than v0.2's `number`:
//   - `matchedIdx` — absolute token index that was matched (or -1).
//   - `skippedIndices` — set of token indices BETWEEN the floor cursor and
//     the match that were jumped over (word tokens only, no whitespace).
//   This lets the matcher hook update both cursor AND skipped state in one
//   pass without re-walking the token array.

import type { Token } from '@/types';
import { levenshtein } from './levenshtein';

/** Word-like lookahead distance — increased from v0.2's MATCH_WINDOW=3. */
export const WINDOW = 10;

/** Max edit distance considered a match. */
export const MAX_DISTANCE = 2;

/**
 * If a single match jumps over more than this many word-like tokens, the
 * skipped words get marked so the UI can show them in a muted state.
 */
export const SKIP_THRESHOLD = 5;

/**
 * Minimum word length (in chars) to allow fuzzy matching. Shorter words
 * fall back to exact match — distance=2 on a 2-char word is basically a
 * random match.
 */
const MIN_FUZZY_LENGTH = 3;

/**
 * Normalize a token for comparison. Same rules as v0.2's exactMatch.normalizeWord
 * — trim, lowercase Latin, strip a small punctuation set. Thai vowels/tone
 * marks are preserved (`toLowerCase` is a no-op on Thai code points).
 */
export function normalizeWord(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'()[\]{}—–-]/g, '');
}

export type MatchResult = {
  /** Absolute token index that matched. -1 = no match within window. */
  matchedIdx: number;
  /**
   * Word-like token indices the matcher jumped OVER to reach matchedIdx.
   * Empty if no skip (or matchedIdx === -1). Only populated when the jump
   * count exceeds SKIP_THRESHOLD — small skips are treated as "near-tracking"
   * and stay in the consumed/highlighted bucket like v0.2.
   */
  skippedIndices: number[];
};

const NO_MATCH: MatchResult = { matchedIdx: -1, skippedIndices: [] };

/**
 * Try to match a single heard word against the next WINDOW word-like tokens
 * starting at `cursor`. Returns the best (lowest-distance) match within the
 * window, biased to leftmost on ties — bias matters because if both "อาจารย์"
 * at idx=5 and idx=12 are tied dist=0, the speaker almost certainly just hit
 * the first one, not skipped 7 words.
 */
export function matchWord(
  heardWord: string,
  tokens: Token[],
  cursor: number
): MatchResult {
  const heard = normalizeWord(heardWord);
  if (heard.length === 0) return NO_MATCH;
  if (cursor >= tokens.length) return NO_MATCH;

  // Short words must match exactly — fuzzy distance=2 on a 2-char word
  // accepts ~50% of the alphabet which is useless.
  const useFuzzy = heard.length >= MIN_FUZZY_LENGTH;
  const maxDist = useFuzzy ? MAX_DISTANCE : 0;

  let bestIdx = -1;
  let bestDist = maxDist + 1;
  const skippedWordIndices: number[] = [];

  let wordsSeen = 0;
  for (let i = cursor; i < tokens.length && wordsSeen < WINDOW; i++) {
    const tok = tokens[i];
    if (tok.isWhitespace) continue;
    wordsSeen += 1;

    const candidate = normalizeWord(tok.text);
    if (candidate.length === 0) continue;

    const d = useFuzzy ? levenshtein(candidate, heard, maxDist) : (candidate === heard ? 0 : 1);

    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
      // Found exact match — stop looking. Speaker is on this word.
      if (d === 0) break;
    }
  }

  if (bestIdx < 0 || bestDist > maxDist) return NO_MATCH;

  // Walk the gap between cursor and bestIdx, collecting word-token indices
  // that were skipped. Only populate skippedIndices if the jump is "big" —
  // small one-or-two-word skips stay in the consumed bucket like v0.2.
  let wordSkipCount = 0;
  for (let i = cursor; i < bestIdx; i++) {
    const tok = tokens[i];
    if (tok.isWhitespace) continue;
    wordSkipCount += 1;
  }

  if (wordSkipCount > SKIP_THRESHOLD) {
    for (let i = cursor; i < bestIdx; i++) {
      const tok = tokens[i];
      if (tok.isWhitespace) continue;
      skippedWordIndices.push(i);
    }
  }

  return { matchedIdx: bestIdx, skippedIndices: skippedWordIndices };
}

/**
 * Match a sequence of heard words. Returns the cumulative furthest match and
 * the union of all skipped indices across the sequence.
 *
 * Greedy left-to-right with a monotonic floor — each successful match pushes
 * the search floor forward so we don't double-count the same script word
 * against repeated Web Speech interim fragments.
 */
export function matchSequence(
  heardWords: string[],
  tokens: Token[],
  cursor: number
): MatchResult {
  let floor = cursor;
  let lastMatched = -1;
  const allSkipped: number[] = [];

  for (const w of heardWords) {
    const r = matchWord(w, tokens, floor);
    if (r.matchedIdx >= 0) {
      lastMatched = r.matchedIdx;
      floor = r.matchedIdx + 1;
      if (r.skippedIndices.length > 0) allSkipped.push(...r.skippedIndices);
    }
  }

  return { matchedIdx: lastMatched, skippedIndices: allSkipped };
}
