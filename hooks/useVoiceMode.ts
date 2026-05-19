'use client';

// useVoiceMode — top-level voice integration for the /run/[id] route.
//
// Glue layer: subscribes to `useScriptStore.isRunning` and drives the
// SpeechEngine + word matcher in lockstep. Mounting one of these in the run
// page is all that's needed — ControlBar's Start/Pause buttons just toggle
// `isRunning` and this hook does the rest.
//
// Lifecycle contract:
//   - isRunning becomes true → useSpeechRecognition.start() → matcher armed
//   - isRunning becomes false → useSpeechRecognition.stop() → matcher idle
//   - mic permission denied / unsupported → matcher stays idle, isRunning
//     remains true so manual mode still works (cursor +1 button etc.)
//
// Returns the speech `error` and `isSupported` so the run page can show
// status banners without re-implementing the wiring.

import { useEffect } from 'react';
import type { Language } from '@/types';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useWordMatcher } from './useWordMatcher';

export type VoiceModeStatus = ReturnType<typeof useSpeechRecognition>;

type Options = {
  language: Language;
  /** If false, voice mode stays dormant even when isRunning flips. */
  enabled?: boolean;
};

export function useVoiceMode({ language, enabled = true }: Options): VoiceModeStatus {
  const isRunning = useScriptStore((s) => s.isRunning);
  const setIsListening = useScriptStore((s) => s.setIsListening);
  const pause = useScriptStore((s) => s.pause);

  const { handleSpeechResult, reset: resetMatcher } = useWordMatcher(language);

  const speech = useSpeechRecognition({
    language,
    onResult: handleSpeechResult,
  });

  // Mirror engine state into the store so the ControlBar can show
  // "Listening…" / "Mic idle" without subscribing to speech directly.
  useEffect(() => {
    setIsListening(speech.isListening);
  }, [speech.isListening, setIsListening]);

  // Drive speech start/stop from the master `isRunning` flag.
  useEffect(() => {
    if (!enabled) return;

    if (isRunning) {
      // Fresh run → wipe the matcher's "already heard" pointer so a new
      // playback session doesn't inherit stale consumed words from before.
      resetMatcher();
      void speech.start();
      return () => {
        speech.stop();
      };
    }

    // Not running → make sure we're not still listening.
    speech.stop();
    return undefined;
    // We deliberately exclude speech.start/stop from deps — they're stable
    // useCallback identities from useSpeechRecognition, re-included only on
    // language change which also re-creates the closure. Including them
    // would re-trigger this effect mid-run and abort speech needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, enabled, language]);

  // Hard-permission failures → take the user out of "running" so the Start
  // button comes back and they can re-engage via MicPermissionGate.
  useEffect(() => {
    if (!speech.error) return;
    if (
      speech.error.code === 'not-allowed' ||
      speech.error.code === 'service-not-allowed' ||
      speech.error.code === 'audio-capture'
    ) {
      pause();
    }
  }, [speech.error, pause]);

  return speech;
}
