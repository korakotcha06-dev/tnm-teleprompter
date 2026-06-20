// Reading-pace estimation — language-aware.
//
// WHY THIS EXISTS — Thai has no spaces between words (whitespace appears only
// at phrase/sentence boundaries), so the old `content.split(/\s+/)` "word
// count" treated a whole Thai paragraph as a handful of words and the duration
// estimate was wildly off. Thai is best measured in CHARACTERS, English in
// WORDS. This module centralizes both so the editor + library agree.
//
// RESEARCH BASIS (read-aloud / teleprompter pace, slower than silent reading):
//   - Thai: measured in characters. Thai subtitle guidelines allow ~9–12
//     chars/sec for SILENT reading; reading ALOUD runs ~60–70% of that, so
//     ~6–7 chars/sec ≈ 360–420 chars/min. We default to 400.
//   - English: Brysbaert (2019) puts read-aloud around ~150 wpm; teleprompter
//     presentation pace is commonly 130–150 wpm. We default to 140.
// These are single tunable constants — adjust to taste.

import type { Language } from '@/types';

/** Read-aloud pace for English scripts (words per minute). */
export const EN_WORDS_PER_MIN = 140;
/** Read-aloud pace for Thai scripts (characters per minute). */
export const TH_CHARS_PER_MIN = 400;

/** Total characters (including spaces) — the raw "chars" stat. */
export function countChars(text: string): number {
  return text.length;
}

/** Whitespace-delimited word count. Meaningful for English; for Thai it only
 * counts phrase groups, so the UI shows chars for Thai instead. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Non-space character count — the unit Thai duration is estimated from. */
export function countCharsNoSpace(text: string): number {
  return text.replace(/\s+/g, '').length;
}

/**
 * Estimated read-aloud minutes, language-aware. Thai → chars/min, English →
 * words/min. Always at least 1 minute (matches prior behavior).
 */
export function estimateMinutes(text: string, language: Language): number {
  if (language === 'th') {
    return Math.max(1, Math.ceil(countCharsNoSpace(text) / TH_CHARS_PER_MIN));
  }
  return Math.max(1, Math.ceil(countWords(text) / EN_WORDS_PER_MIN));
}

/** Human-readable pace label for the stat line, e.g. "140 wpm" / "400 ตัว/นาที". */
export function paceLabel(language: Language): string {
  return language === 'th'
    ? `${TH_CHARS_PER_MIN} ตัว/นาที`
    : `${EN_WORDS_PER_MIN} wpm`;
}
