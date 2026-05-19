'use client';

// React hook around SpeechEngine.
//
// Responsibilities:
//   - Instantiate SpeechEngine lazily on the client (SSR-safe).
//   - Track listening + error state for the UI.
//   - Forward result callbacks via a ref so callers can pass inline closures
//     without forcing engine re-creation.
//   - Cleanly stop the engine on unmount.
//
// What this hook does NOT do (intentional separation):
//   - Word-matching (lives in useWordMatcher).
//   - Mic permission prompt (lives in MicPermissionGate — gesture-gated).
//
// v0.2 contract: exactly the shape Nexus spec'd → { start, stop, isListening, error }.
//
// React 19 nuance: we read SpeechEngine.isSupported() via useSyncExternalStore
// (instead of useState+useEffect+setState) to satisfy the
// `react-hooks/set-state-in-effect` lint rule. And the onResult ref is kept
// up-to-date inside an effect, not during render, to satisfy
// `react-hooks/refs`.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Language } from '@/types';
import {
  SpeechEngine,
  type SpeechErrorCode,
  type SpeechResult,
} from '@/lib/speech/recognition';

type UseSpeechRecognitionOptions = {
  language: Language;
  onResult?: (result: SpeechResult) => void;
  /**
   * Filter out routine errors that fire during normal use (`no-speech`,
   * `aborted`) so they don't surface to the UI. Defaults to `true`.
   */
  suppressBenignErrors?: boolean;
};

type UseSpeechRecognitionReturn = {
  start: () => Promise<void>;
  stop: () => void;
  isListening: boolean;
  error: { code: SpeechErrorCode; message: string } | null;
  isSupported: boolean;
};

const BENIGN_ERRORS: ReadonlySet<SpeechErrorCode> = new Set(['no-speech', 'aborted']);

// useSyncExternalStore plumbing for isSupported:
//   - subscribe: no-op (the value doesn't change after page load)
//   - getSnapshot (client): query the browser
//   - getServerSnapshot: always false (no SpeechRecognition during SSR)
const supportSubscribe = (): (() => void) => () => undefined;
const getSupportClient = (): boolean => SpeechEngine.isSupported();
const getSupportServer = (): boolean => false;

export function useSpeechRecognition({
  language,
  onResult,
  suppressBenignErrors = true,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<UseSpeechRecognitionReturn['error']>(null);

  const isSupported = useSyncExternalStore(
    supportSubscribe,
    getSupportClient,
    getSupportServer
  );

  const engineRef = useRef<SpeechEngine | null>(null);
  // Latest onResult ref — kept in sync via effect (NOT during render, which
  // would trip react-hooks/refs in React 19).
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  // Track language so a parent flipping th↔en doesn't require a remount.
  useEffect(() => {
    engineRef.current?.setLanguage(language);
  }, [language]);

  // Unmount cleanup — never leave the recognizer hot after the component
  // disappears, otherwise the mic icon stays on in the browser chrome.
  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (!SpeechEngine.isSupported()) {
      setError({ code: 'not-supported', message: 'Web Speech API is not available in this browser.' });
      return;
    }
    setError(null);

    if (!engineRef.current) {
      engineRef.current = new SpeechEngine(language, {
        onResult: (r) => onResultRef.current?.(r),
        onError: (code, message) => {
          if (suppressBenignErrors && BENIGN_ERRORS.has(code)) return;
          setError({ code, message });
          // Permission denial or hardware unavailable → reflect in state.
          if (code === 'not-allowed' || code === 'audio-capture' || code === 'service-not-allowed') {
            setIsListening(false);
          }
        },
        onStart: () => setIsListening(true),
        onEnd: () => setIsListening(false),
      });
    }

    try {
      await engineRef.current.start();
    } catch (err) {
      // Already surfaced via onError callback for the supported-but-broken
      // case; this catch only fires when the engine rejects (not supported).
      const message = err instanceof Error ? err.message : String(err);
      setError({ code: 'not-supported', message });
    }
  }, [language, suppressBenignErrors]);

  const stop = useCallback((): void => {
    engineRef.current?.stop();
    setIsListening(false);
  }, []);

  return { start, stop, isListening, error, isSupported };
}
