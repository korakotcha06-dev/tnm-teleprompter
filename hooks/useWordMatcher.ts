'use client';

// useWordMatcher — bridges SpeechEngine results → useScriptStore.advanceCursor.
//
// v0.2 strategy (exact-match only):
//   1. Each speech `onResult` fires with `fullTranscript` (cumulative since
//      start). We tokenize the FULL transcript every time and slice off the
//      portion we've already matched — this avoids the "stream of interims
//      double-fires the same word" trap.
//   2. For each NEW heard word, try matchSequenceExact against the next 3
//      word-like tokens in the script starting from the live cursor.
//   3. On match → advanceCursor by (matchedIdx - cursor + 1). The store's
//      built-in highlight semantics fill in any tokens between old and new
//      cursor automatically.
//
// What we DON'T do (intentional v0.2 scope guard):
//   - No fuzzy match / Levenshtein (v0.3).
//   - No auto-scroll wiring beyond what TeleprompterView already has.
//   - No re-tokenization of the script — that's already done by the store on
//     `setTokensFromContent`. We read `tokens` straight from the store.

import { useCallback, useRef } from 'react';
import type { Language } from '@/types';
import type { SpeechResult } from '@/lib/speech/recognition';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { tokenize } from '@/lib/matcher/tokenize';
import { matchSequenceExact } from '@/lib/matcher/exactMatch';

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

      const matchedIdx = matchSequenceExact(newHeardWords, state.tokens, state.cursor);

      if (matchedIdx >= 0) {
        // Advance past the matched token. The store highlights every index
        // from old cursor through matchedIdx (whitespace included), which
        // visually feels right: skipped filler words don't stay dimmed
        // forever once you've spoken past them.
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
