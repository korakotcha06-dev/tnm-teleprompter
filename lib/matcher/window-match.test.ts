// v0.3.1 matcher unit tests — run with:
//   node --test --experimental-strip-types lib/matcher/window-match.test.ts
//
// Covers the v0.3.1 anti-aggression tuning plus the v0.3 behaviors we must not
// regress (sequential reading, monotonic floor, skip marking).
//
// NOTE: we import via RELATIVE paths (not the `@/` alias) so Node can resolve
// modules without a bundler. The only `@/` import in window-match.ts is the
// type-only `Token`, which type-stripping erases at runtime.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchWord,
  matchSequence,
  maxDistForLength,
  WINDOW,
  JUMP_CONFIRM_THRESHOLD,
} from './window-match.ts';

type Tok = { index: number; text: string; isWhitespace: boolean };

/** Build a token array from a plain space-separated script. */
function toks(script: string): Tok[] {
  const parts = script.split(/(\s+)/).filter((p) => p.length > 0);
  return parts.map((text, index) => ({
    index,
    text,
    isWhitespace: /^\s+$/.test(text),
  }));
}

/** Index of the Nth word-like token (0-based word count). */
function wordIdx(t: Tok[], nthWord: number): number {
  let seen = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i].isWhitespace) continue;
    if (seen === nthWord) return i;
    seen += 1;
  }
  return -1;
}

// ─── length-scaled distance ────────────────────────────────────────────────

test('maxDistForLength: short words exact-only, long words tolerant', () => {
  assert.equal(maxDistForLength(1), 0);
  assert.equal(maxDistForLength(3), 0);
  assert.equal(maxDistForLength(4), 1);
  assert.equal(maxDistForLength(6), 1);
  assert.equal(maxDistForLength(7), 2);
  assert.equal(maxDistForLength(12), 2);
});

// ─── short word false-match guard ──────────────────────────────────────────

test('short EN word "the" does not fuzzy-match "that"', () => {
  const t = toks('that thing the end');
  // heard "the" (len 3 → maxDist 0). Must hit the real "the" at word 2, not
  // false-match "that" at word 0.
  const r = matchWord('the', t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 2));
});

test('short Thai word "ไป" does not fuzzy-match "ก็"', () => {
  const t = toks('ก็ จะ ไป แล้ว');
  // "ไป" len 2 → exact only. Must not bind to "ก็" at word 0.
  const r = matchWord('ไป', t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 2));
});

test('short word with no exact match returns NO_MATCH', () => {
  const t = toks('cat dog fish');
  const r = matchWord('cab', t, 0); // len 3, exact-only, no exact → no match
  assert.equal(r.matchedIdx, -1);
});

// ─── nearest preference ──────────────────────────────────────────────────

test('nearest preference: duplicate word near + far → picks NEAR', () => {
  const t = toks('alpha beta project gamma delta project epsilon');
  // "project" appears at word 2 and word 5. From cursor 0, must pick word 2.
  const r = matchWord('project', t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 2));
});

test('nearest preference: near dist-1 beats far dist-0', () => {
  // heard "projekt" (len 7 → maxDist 2). "project" (dist 1) near at word 1,
  // exact "projekt" (dist 0) far at word 4. v0.3.1 must take the NEAR one.
  const t = toks('intro project body filler projekt outro');
  const r = matchWord('projekt', t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 1));
});

// ─── window narrowing ──────────────────────────────────────────────────────

test('WINDOW is widened to 12', () => {
  assert.equal(WINDOW, 12);
});

test('match beyond WINDOW is not found', () => {
  // 13 filler words then the target — target sits at word 13, outside window 12.
  const t = toks('a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 a12 a13 elephant');
  const r = matchWord('elephant', t, 0);
  assert.equal(r.matchedIdx, -1);
});

test('match within WINDOW is found', () => {
  // target at word 11 — inside the widened window of 12.
  const t = toks('a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 elephant');
  const r = matchWord('elephant', t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 11));
});

// ─── confirmation gating on big jumps ──────────────────────────────────────

test('big jump (>3 words) WITHOUT confirmation does not commit', () => {
  // "target" sits at word 5 (jump of 5 > threshold 3). A single heard word
  // matching it must NOT move the cursor without a confirmer.
  const t = toks('w0 w1 w2 w3 w4 target tail0 tail1');
  const r = matchSequence(['target'], t, 0);
  assert.equal(r.matchedIdx, -1);
});

test('big jump WITH consecutive confirmation commits to confirmer', () => {
  const t = toks('w0 w1 w2 w3 w4 target follower tail');
  // "target" (word5) + "follower" (word6) consecutive → confirmed.
  const r = matchSequence(['target', 'follower'], t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 6)); // floor lands on the confirmer
});

test('big jump with WRONG confirmer does not commit', () => {
  const t = toks('w0 w1 w2 w3 w4 target follower tail');
  // second heard word doesn't match the token after target → discard.
  const r = matchSequence(['target', 'banana'], t, 0);
  assert.equal(r.matchedIdx, -1);
});

test('JUMP_CONFIRM_THRESHOLD is 3', () => {
  assert.equal(JUMP_CONFIRM_THRESHOLD, 3);
});

test('small jump (<=3 words) commits immediately, no confirmation needed', () => {
  // target at word 3 → jump of 3 == threshold → small path, commit on one word.
  const t = toks('w0 w1 w2 target tail');
  const r = matchSequence(['target'], t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 3));
});

// ─── sequential reading must stay smooth (no regression) ────────────────────

test('normal sequential reading advances word by word', () => {
  const t = toks('the quick brown fox jumps over');
  const r = matchSequence(['the', 'quick', 'brown', 'fox'], t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 3));
});

test('monotonic floor: repeated interim words do not pull cursor back', () => {
  const t = toks('alpha beta gamma delta');
  // "alpha beta" then re-heard "alpha" (Web Speech interim repeat) — floor must
  // not regress; the stray "alpha" finds nothing ahead and is ignored.
  const r = matchSequence(['alpha', 'beta', 'alpha', 'gamma'], t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 2)); // gamma
});

test('small skip stays consumed (not flagged skipped under SKIP_THRESHOLD)', () => {
  const t = toks('one two three four five six');
  // jump from 0 to word 3 (skip of 3 words) — under SKIP_THRESHOLD=5 → no marks.
  const r = matchSequence(['four'], t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 3));
  assert.deepEqual(r.skippedIndices, []);
});

test('confirmed big skip flags intermediate words as skipped', () => {
  const t = toks('w0 w1 w2 w3 target follower z');
  // floor 0 → target at word 4 (skip of 4 > SKIP_THRESHOLD 3, within WINDOW 6),
  // confirmed by "follower" at word 5. Intermediate word tokens 0..3 flagged.
  const r = matchSequence(['target', 'follower'], t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 5));
  assert.ok(r.skippedIndices.length > 0, 'expected skipped indices populated');
  // all flagged indices must be word tokens before the target
  for (const i of r.skippedIndices) {
    assert.ok(!t[i].isWhitespace);
    assert.ok(i < wordIdx(t, 4));
  }
});

test('empty / whitespace heard words are ignored', () => {
  const t = toks('hello world there');
  const r = matchSequence(['', '   ', 'world'], t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 1));
});

test('long word fuzzy still works within tolerance', () => {
  const t = toks('start photoshop finish');
  // heard "fotoshop" (len 8, maxDist 2) vs "photoshop" → dist 2, near, commits.
  const r = matchSequence(['fotoshop'], t, 0);
  assert.equal(r.matchedIdx, wordIdx(t, 1));
});
