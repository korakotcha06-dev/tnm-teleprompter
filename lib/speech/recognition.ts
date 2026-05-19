// SpeechEngine — thin lifecycle wrapper around the Web Speech API.
//
// v0.2 goal: deliver interim + final transcripts to a callback so the React
// layer can drive word-matching. The browser API is event-based and has a
// few sharp edges we smooth over here:
//
//   - Auto-restart on `onend` because Chrome stops after ~5s of silence. We
//     guard against user-initiated stop (which would otherwise infinite-loop).
//   - Webkit prefix fallback for Safari (still relevant in 2026 — Apple ships
//     it under `webkitSpeechRecognition`).
//   - `isSupported()` is static + SSR-safe so client code can check feature
//     availability without instantiating.
//
// Anything that requires React state (isListening, errors) lives in the
// `useSpeechRecognition` hook, not here. This file stays framework-free.

import type { Language } from '@/types';

export type SpeechResult = {
  /** Concatenated transcript of all results since the latest start(). */
  fullTranscript: string;
  /** Just the most-recent result chunk (interim or final). */
  latestTranscript: string;
  /** True when the engine has finalized the latest chunk. */
  isFinal: boolean;
};

export type SpeechErrorCode =
  | 'not-supported'
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'unknown';

export type SpeechEngineCallbacks = {
  onResult?: (result: SpeechResult) => void;
  onError?: (code: SpeechErrorCode, message: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
};

/** Map app `Language` (short code) to BCP-47 tag expected by the browser API. */
export function toBcp47(lang: Language): string {
  if (lang === 'th') return 'th-TH';
  return 'en-US';
}

function getCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export class SpeechEngine {
  private rec: SpeechRecognition | null = null;
  private lang: Language;
  private cbs: SpeechEngineCallbacks;
  /** Set by stop(); prevents the auto-restart in `onend`. */
  private userStopped = false;

  constructor(lang: Language, callbacks: SpeechEngineCallbacks = {}) {
    this.lang = lang;
    this.cbs = callbacks;
  }

  /** SSR-safe — call from anywhere (returns `false` on the server). */
  static isSupported(): boolean {
    return getCtor() !== null;
  }

  setCallbacks(cbs: SpeechEngineCallbacks): void {
    this.cbs = cbs;
  }

  setLanguage(lang: Language): void {
    this.lang = lang;
    if (this.rec) {
      // Web Speech doesn't allow changing lang on a live instance — restart.
      this.stop();
      void this.start();
    }
  }

  /**
   * Start recognition. Resolves once `.start()` has been called on the
   * underlying SpeechRecognition object — the actual mic permission prompt
   * is handled separately by MicPermissionGate (gesture-gated getUserMedia).
   *
   * Rejects only if the browser doesn't support the API at all. Permission
   * denials surface via the `onerror` callback as `'not-allowed'`.
   */
  start(): Promise<void> {
    const Ctor = getCtor();
    if (!Ctor) {
      this.cbs.onError?.('not-supported', 'Web Speech API is not available in this browser.');
      return Promise.reject(new Error('SpeechRecognition not supported'));
    }
    // If we're already running, treat start() as a no-op so React StrictMode
    // double-effects don't trip the browser's "already started" InvalidStateError.
    if (this.rec) return Promise.resolve();

    const rec = new Ctor();
    rec.lang = toBcp47(this.lang);
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    this.userStopped = false;

    rec.onstart = () => {
      this.cbs.onStart?.();
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      // Concatenate every result across the session, then surface the most
      // recent chunk separately so the matcher can react incrementally.
      let full = '';
      let latest = '';
      let latestFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = result[0]?.transcript ?? '';
        full += chunk;
        if (i === event.results.length - 1) {
          latest = chunk;
          latestFinal = result.isFinal;
        }
      }
      this.cbs.onResult?.({
        fullTranscript: full.trim(),
        latestTranscript: latest.trim(),
        isFinal: latestFinal,
      });
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // `no-speech` and `aborted` fire frequently during normal use — pass
      // them through but the consumer can choose to suppress UI noise.
      this.cbs.onError?.(event.error, event.message || event.error);
    };

    rec.onend = () => {
      // Auto-restart only if the user didn't stop us and we still hold the
      // recognizer reference. Without this guard Chrome auto-stops after ~5s
      // of silence and voice mode dies silently.
      if (!this.userStopped && this.rec === rec) {
        try {
          rec.start();
          return;
        } catch {
          // Fall through to onEnd notification if restart fails (rare —
          // typically only happens if the page is unloading).
        }
      }
      this.cbs.onEnd?.();
    };

    this.rec = rec;
    try {
      rec.start();
    } catch (err) {
      // `start()` can throw `InvalidStateError` if called twice in quick
      // succession (StrictMode in dev). Swallow it — the existing instance
      // is already running.
      this.cbs.onError?.('unknown', err instanceof Error ? err.message : String(err));
    }
    return Promise.resolve();
  }

  stop(): void {
    if (!this.rec) return;
    this.userStopped = true;
    try {
      this.rec.stop();
    } catch {
      // Stop on a non-started recognizer throws — ignore.
    }
    this.rec = null;
  }

  isListening(): boolean {
    return this.rec !== null;
  }
}
