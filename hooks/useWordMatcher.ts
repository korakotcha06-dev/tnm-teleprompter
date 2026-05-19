'use client';

// useWordMatcher — bridges SpeechEngine results → useScriptStore.advanceCursor.
//
// v0.3 strategy (skip-ahead fuzzy match):
//   1. Each speech `onResult` fires with `fullTranscript` (cumulative since
//      start). We tokenize the FULL transcript every time and slice off the
//      portion we've already matched.
//   2. For each NEW heard word, run matchSequence (WINDOW=10, fuzzy=2) against
//      the live cursor. The matcher can jump forward up to 10 word-tokens if
//      the speaker skipped or mispronounced words.
//   3. On match → advanceCursor by (matchedIdx - cursor + 1). The store's
//      built-in highlight semantics fill in any tokens between old and new
//      cursor automatically.
//   4. NEW: if the matcher reports skipped indices (jump > SKIP_THRESHOLD),
//      bulk-mark them as "skipped" so WordSpan can paint them in the muted
//      state — distinct from "consumed". Visual signal to Touch that the
//      engine recognized the skip rather than treating those words as read.
//
// What we DON'T do (intentional scope guard):
//   - No re-tokenization of the script — that's done by the store on
//     `setTokensFromContent`. We read `tokens` straight from the store.
//   - No mode awareness — useVoiceMode is responsible for not arming the
//     matcher in manual scroll mode.

import { useCallback, useRef } from 'react';
import type { Language } from '@/types';
import type { SpeechResult } from '@/lib/speech/recognition';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { tokenize } from '@/lib/matcher/tokenize';
import { matchSequence } from '@/lib/matcher/window-match';

type UseWordMatcherReturn = {
  /** Pass this to useSpeechRecognition's `onResult` option. */
  handleSpeechResult: (result: SpeechResult) => void;
  /** Call when starting fresh playback to reset the "already matched" pointer. */
  reset: () => void;
};

export function useWordMatcher(language: Language): UseWordMatcherReturn {
  // Number of heard-words already consumed from the cumulative transcript.
  // Tracked here (not in the store) because it's a matcher-internal detail —
  // the store only cares about script-side cursor.
  const consumedWordsRef = useRef(0);

  const handleSpeechResult = useCallback(
    (result: SpeechResult) => {
      const state = useScriptStore.getState();
      if (!state.isRunning) return;
      if (state.cursor >= state.tokens.length) return;

      // Tokenize the cumulative transcript. We use the SAME tokenizer as the
      // script so Thai/English/mixed transcripts segment consistently.
      const heardTokens = tokenize(result.fullTranscript, language).filter(
        (t) => !t.isWhitespace
      );

      // Slice off everything we've already matched against.
      const newHeardWords = heardTokens
        .slice(consumedWordsRef.current)
        .map((t) => t.text);

      if (newHeardWords.length === 0) return;

      const { matchedIdx, skippedIndices } = matchSequence(
        newHeardWords,
        state.tokens,
        state.cursor
      );

      if (matchedIdx >= 0) {
        // v0.3: mark skipped words BEFORE advancing the cursor. Order matters
        // because advanceCursor adds every index in [cursor, matchedIdx] to
        // highlightedIndices — if WordSpan saw a token in BOTH sets it would
        // ambiguously render. We resolve that in WordSpan by preferring
        // `skipped` styling when both bits are set, so the mark-first-then-
        // advance order keeps the UI honest even mid-batch.
        if (skippedIndices.length > 0) {
          state.markSkipped(skippedIndices);
        }
        const advanceBy = matchedIdx - state.cursor + 1;
        state.advanceCursor(advanceBy);
        // Mark every heard word in this batch as consumed — even ones that
        // didn't match. They're already in the past from the speaker's POV
        // and we'd rather skip them than re-match later (which could pull
        // the cursor backwards relative to perceived speech).
        consumedWordsRef.current = heardTokens.length;
      } else if (result.isFinal) {
        // No match, but the transcript finalized — flush the unmatched heard
        // words from the buffer so we don't keep retrying them against the
        // same future window forever.
        consumedWordsRef.current = heardTokens.length;
      }
    },
    [language]
  );

  const reset = useCallback(() => {
    consumedWordsRef.current = 0;
  }, []);

  return { handleSpeechResult, reset };
}
