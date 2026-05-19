// Ambient declarations for the Web Speech API.
//
// The Web Speech API is browser-native (Chrome/Edge prefix-free, Safari via
// `webkitSpeechRecognition`) but is NOT part of the TypeScript `dom` lib as of
// TS 5.x — see https://github.com/microsoft/TypeScript/issues/39061. Because
// the API only lives at runtime we declare a minimal surface here, scoped to
// the methods/events the v0.2 SpeechEngine uses. Anything beyond this scope
// (grammars, soundstart/audiostart events, etc.) is intentionally omitted —
// add when actually used.
//
// IMPORTANT: This file MUST NOT live in `types/index.ts` (which holds the
// project's domain shapes); keeping ambient browser declarations isolated
// makes them easy to delete the day lib.dom.d.ts ships them upstream.
//
// File is a module (it ends with `export {}`) so the Window augmentation is
// picked up by TypeScript; the actual API surface is declared inside
// `declare global { ... }` so it's visible everywhere without imports.

declare global {
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  type SpeechRecognitionErrorCode =
    | 'no-speech'
    | 'aborted'
    | 'audio-capture'
    | 'network'
    | 'not-allowed'
    | 'service-not-allowed'
    | 'bad-grammar'
    | 'language-not-supported';

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: SpeechRecognitionErrorCode;
    readonly message: string;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;

    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null;
    onend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;

    start(): void;
    stop(): void;
    abort(): void;
  }

  interface SpeechRecognitionConstructor {
    new (): SpeechRecognition;
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export {};
