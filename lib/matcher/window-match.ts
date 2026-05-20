// v0.3.1 word matcher — Levenshtein fuzzy match + skip-ahead window.
//
// Why this exists (compared to v0.2's exactMatch):
//   v0.2's exact-match-only matcher with WINDOW=3 traps the cursor behind a
//   speaker who skipped, mispronounced, or reordered a word. Touch's brief:
//   "พอเป็นขีดแบ่งแบบนี้ น่าจะต้องข้ามไปตรงที่อ่านได้เลย" — when the speaker
//   skips words, the cursor must jump forward to where they actually are,
//   not patiently re-attempt the skipped word.
//
// v0.3.1 tuning (Touch: "แอบข้ามเร็วไป มั่วไปนิด ต้อง fine tune อีกที"):
//   The v0.3 matcher was too AGGRESSIVE — it jumped far ahead on weak evidence
//   and false-matched short words. Four conservative changes:
//
//   1. NARROW WINDOW 10 → 6. A 10-token lookahead lets a heard word fuzzy-bind
//      to something 7-10 words downstream → cursor lurches forward. 6 still
//      tolerates a realistic skip but stops the long-range mis-binds.
//
//   2. PREFER NEAREST, not best-distance. v0.3 took the lowest edit distance
//      and only broke ties leftward — so a far word at dist 0 beat a near word
//      at dist 1, yanking the cursor ahead. v0.3.1 walks the window in order
//      and takes the FIRST candidate that passes threshold (nearest to cursor).
//      Among equidistant candidates (same index can't happen, but ties on the
//      "first qualifying" rule are resolved by index), distance is only a
//      secondary signal. The speaker almost always hit the near word.
//
//   3. LENGTH-SCALED max distance. distance=2 on a 3-4 char word matches half
//      the language → false positives ("ไป" ≈ "ก็", "the" ≈ "that"). Scale the
//      tolerance to word length so short words demand exact/near-exact:
//         len <= 3  → maxDist 0 (exact only)
//         len 4-6   → maxDist 1
//         len >= 7  → maxDist 2
//
//   4. CONFIRMATION GATING on big jumps. A single heard word matching far ahead
//      is weak evidence of a real skip — it's often a coincidental fuzzy hit.
//      If a match would jump the cursor by more than JUMP_CONFIRM_THRESHOLD
//      word-tokens, we REQUIRE the next heard word to confirm by matching the
//      token right after the target (consecutive confirmation). Without that
//      confirmation we stay put. Small jumps (<= threshold) commit immediately
//      so normal reading and minor skips stay responsive.
//
// Trade-off Touch should know: big legitimate skips now take TWO consecutive
// recognized words to register instead of one, so a giant skip catches up a
// beat slower — in exchange for not lurching/mis-binding on weak evidence.
//
// Returned shape:
//   - `matchedIdx` — absolute token index that was matched (or -1).
//   - `skippedIndices` — set of token indices BETWEEN the floor cursor and
//     the match that were jumped over (word tokens only, no whitespace).

import type { Token } from '@/types';
import { levenshtein } from './levenshtein';

// ─── Tunable constants (adjust these between Touch's test passes) ───────────

/**
 * Word-like lookahead distance. v0.3 used 10 → too wide, caused long-range
 * false binds. v0.3.1 = 6. If Touch still reports "มั่ว", drop to 5.
 */
export const WINDOW = 6;

/** Hard ceiling on edit distance (only reached by len >= 7 words). */
export const MAX_DISTANCE = 2;

/**
 * If a match jumps over more than this many word-like tokens, the skipped
 * words get marked so the UI can render them muted. v0.3 used 5, but with the
 * narrowed WINDOW=6 the max possible gap is 5 — `> 5` could never fire and
 * skip-marking would be dead. Lowered to 3 so a confirmed 4–5 word skip still
 * paints the muted "we recognized you jumped" state. Aligned with
 * JUMP_CONFIRM_THRESHOLD: any skip big enough to need confirmation also gets
 * visually flagged.
 */
export const SKIP_THRESHOLD = 3;

/**
 * Jumps larger than this many word-tokens are treated as "big" and require a
 * second consecutive heard word to confirm before the cursor commits. Small
 * jumps (<= this) commit immediately to stay responsive. v0.3.1 = 3.
 */
export const JUMP_CONFIRM_THRESHOLD = 3;

/**
 * Length-scaled max edit distance. Short words demand exact/near-exact match
 * because fuzzy tolerance on tiny words false-matches half the language.
 * Keyed by normalized char length. Tune the bands here.
 */
export function maxDistForLength(len: number): number {
  if (len <= 3) return 0; // exact only — kills "ไป"/"the" false matches
  if (len <= 6) return 1;
  return 2;
}

// ─────────────────────────────────────────────────────────────────────────

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
 * Single-word match against tokens[from..], respecting length-scaled distance.
 * Returns the NEAREST qualifying token index (smallest index that passes the
 * length-scaled threshold) — NOT the lowest-distance one. Distance is only a
 * tiebreaker if two candidates sit at the same index, which can't happen, so
 * in practice "nearest wins" is absolute. This is the core of the v0.3.1
 * anti-aggression fix.
 *
 * `limitWindow` caps how many word-tokens to scan from `from` (defaults to
 * WINDOW). Pass 1 to test "does the very next word match" (used by the
 * confirmation gate).
 */
function nearestMatch(
  heard: string,
  tokens: Token[],
  from: number,
  limitWindow: number = WINDOW
): { idx: number; dist: number } {
  if (heard.length === 0) return { idx: -1, dist: Infinity };
  const maxDist = maxDistForLength(heard.length);

  let wordsSeen = 0;
  for (let i = from; i < tokens.length && wordsSeen < limitWindow; i++) {
    const tok = tokens[i];
    if (tok.isWhitespace) continue;
    wordsSeen += 1;

    const candidate = normalizeWord(tok.text);
    if (candidate.length === 0) continue;

    const d =
      maxDist === 0
        ? candidate === heard
          ? 0
          : maxDist + 1
        : levenshtein(candidate, heard, maxDist);

    // NEAREST wins: take the first candidate (lowest index) that qualifies.
    if (d <= maxDist) return { idx: i, dist: d };
  }

  return { idx: -1, dist: Infinity };
}

/** Count word-like tokens in [from, to). */
function wordGap(tokens: Token[], from: number, to: number): number {
  let n = 0;
  for (let i = from; i < to; i++) {
    if (!tokens[i].isWhitespace) n += 1;
  }
  return n;
}

/**
 * Try to match a single heard word against the next WINDOW word-like tokens
 * starting at `cursor`. Nearest-qualifying wins. Length-scaled distance.
 *
 * NOTE: this entry point does NOT apply confirmation gating — that lives in
 * matchSequence where the next heard word is available to confirm. matchWord
 * stays a pure single-word probe (also keeps the existing unit contract).
 */
export function matchWord(
  heardWord: string,
  tokens: Token[],
  cursor: number
): MatchResult {
  const heard = normalizeWord(heardWord);
  if (heard.length === 0) return NO_MATCH;
  if (cursor >= tokens.length) return NO_MATCH;

  const { idx } = nearestMatch(heard, tokens, cursor);
  if (idx < 0) return NO_MATCH;

  return buildResult(tokens, cursor, idx);
}

/** Assemble a MatchResult, populating skippedIndices when the jump is big. */
function buildResult(
  tokens: Token[],
  cursor: number,
  matchedIdx: number
): MatchResult {
  const skippedWordIndices: number[] = [];
  const skipCount = wordGap(tokens, cursor, matchedIdx);
  if (skipCount > SKIP_THRESHOLD) {
    for (let i = cursor; i < matchedIdx; i++) {
      if (!tokens[i].isWhitespace) skippedWordIndices.push(i);
    }
  }
  return { matchedIdx, skippedIndices: skippedWordIndices };
}

/**
 * Match a sequence of heard words. Greedy left-to-right with a monotonic floor
 * so we don't double-count the same script word against repeated Web Speech
 * interim fragments.
 *
 * v0.3.1 confirmation gating: when a candidate match would jump the floor by
 * more than JUMP_CONFIRM_THRESHOLD word-tokens, we don't commit on that single
 * word. We require the NEXT heard word to match the token immediately after
 * the candidate (consecutive confirmation). If it does, both commit and the
 * floor advances past the confirmed pair. If it doesn't, we discard the
 * candidate and keep probing from the original floor — the cursor stays put,
 * which is exactly what "กันมั่ว" needs.
 */
export function matchSequence(
  heardWords: string[],
  tokens: Token[],
  cursor: number
): MatchResult {
  let floor = cursor;
  let lastMatched = -1;
  const allSkipped: number[] = [];

  for (let h = 0; h < heardWords.length; h++) {
    const heard = normalizeWord(heardWords[h]);
    if (heard.length === 0) continue;
    if (floor >= tokens.length) break;

    const { idx } = nearestMatch(heard, tokens, floor);
    if (idx < 0) continue;

    const jump = wordGap(tokens, floor, idx);

    if (jump > JUMP_CONFIRM_THRESHOLD) {
      // Big jump → demand consecutive confirmation from the NEXT heard word.
      const next = h + 1 < heardWords.length ? normalizeWord(heardWords[h + 1]) : '';
      if (next.length === 0) {
        // No next word to confirm with — don't commit a weak big jump.
        continue;
      }
      // The confirmer must match the very next word-token after idx.
      const confirm = nearestMatch(next, tokens, idx + 1, 1);
      if (confirm.idx < 0) {
        // Confirmation failed → discard candidate, stay put, keep probing.
        continue;
      }
      // Confirmed: commit both. Mark skips relative to the original floor.
      const res = buildResult(tokens, floor, idx);
      if (res.skippedIndices.length > 0) allSkipped.push(...res.skippedIndices);
      lastMatched = confirm.idx;
      floor = confirm.idx + 1;
      h += 1; // consumed the confirmer word too
      continue;
    }

    // Small jump → commit immediately (responsive path, unchanged behavior).
    const res = buildResult(tokens, floor, idx);
    if (res.skippedIndices.length > 0) allSkipped.push(...res.skippedIndices);
    lastMatched = idx;
    floor = idx + 1;
  }

  return { matchedIdx: lastMatched, skippedIndices: allSkipped };
}
