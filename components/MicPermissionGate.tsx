'use client';

// MicPermissionGate — one-time onboarding modal for the /run/[id] route.
//
// Why a separate component:
//   - Web Speech mic permission is gesture-gated in Chrome. The browser will
//     reject `recognition.start()` unless a user gesture is in the call stack.
//     So we present a deliberate "Enable mic" CTA before voice mode arms.
//   - We use `navigator.mediaDevices.getUserMedia({ audio: true })` to trigger
//     the permission prompt BEFORE SpeechRecognition.start(), because the
//     getUserMedia prompt is well-understood and lets us close the audio
//     track immediately (we don't actually want to record — we just want
//     permission to be granted so SpeechRecognition inherits it).
//   - Persists granted-state in localStorage so subsequent visits skip the
//     modal. Permission can still be revoked browser-side; we re-prompt if
//     SpeechEngine reports `not-allowed`.
//
// States (mutually exclusive):
//   - 'unsupported': Web Speech API missing entirely (Firefox) → banner only,
//     does not block content (Manual mode is implicit until v0.4 fallback).
//   - 'prompting': initial — show CTA to enable mic.
//   - 'requesting': awaiting browser permission dialog response.
//   - 'granted': dismiss the gate.
//   - 'denied': show fallback explaining how to re-enable + "Continue in
//     Manual mode" button so the user isn't stuck on a modal.
//
// React 19 nuance: the initial client-side decision (unsupported, cached
// granted, prompting) is computed via useSyncExternalStore rather than
// useState + useEffect+setState, because the latter trips React 19's
// `react-hooks/set-state-in-effect` lint rule. useSyncExternalStore is the
// canonical hook for "read a value from outside React on the client without
// causing hydration mismatches".

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SpeechEngine } from '@/lib/speech/recognition';

type Status = 'checking' | 'unsupported' | 'prompting' | 'requesting' | 'granted' | 'denied';
type ResolvedState = 'granted' | 'denied' | 'unsupported' | 'manual';

const STORAGE_KEY = 'teleprompter.micPermission';

function loadCachedDecision(): 'granted' | 'denied' | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'granted' || raw === 'denied' ? raw : null;
  } catch {
    return null;
  }
}

function saveCachedDecision(value: 'granted' | 'denied'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // QuotaExceeded / disabled storage — silent. Modal will just re-show
    // next visit, which is the safe degradation.
  }
}

/** Client-side snapshot for useSyncExternalStore. Runs once per render but
 *  read from a process-level cache so it's referentially stable across
 *  identical inputs (required by the hook). */
function getClientInitialStatus(): Status {
  if (!SpeechEngine.isSupported()) return 'unsupported';
  const cached = loadCachedDecision();
  if (cached === 'granted') return 'granted';
  return 'prompting';
}

/** Subscribe stub — initial status doesn't change in response to external
 *  events; we just need useSyncExternalStore's hydration safety. */
const subscribe = (): (() => void) => () => undefined;
/** Server snapshot — matches the SSR render so no hydration mismatch. */
const serverSnapshot = (): Status => 'checking';

type Props = {
  /** Called once the gate resolves (or auto-resolves from cache/unsupported). */
  onResolved?: (state: ResolvedState) => void;
};

export function MicPermissionGate({ onResolved }: Props) {
  // Initial status: server says 'checking', client computes via subscribe.
  const initialStatus = useSyncExternalStore<Status>(
    subscribe,
    getClientInitialStatus,
    serverSnapshot
  );

  // After user interaction we own the status; until then we mirror initial.
  const [override, setOverride] = useState<Status | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const status: Status = override ?? initialStatus;

  // onResolved notification — fire exactly once per component lifetime. Once
  // the gate has dispatched a resolution (granted / denied / unsupported /
  // manual) we never override it; this prevents the "user picked manual but
  // status flipped to granted to dismiss the modal" race where the parent
  // would see two fires and end up with voiceEnabled=true.
  const finalizedRef = useRef(false);
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  useEffect(() => {
    if (finalizedRef.current) return;
    let resolved: ResolvedState | null = null;
    if (status === 'granted') resolved = 'granted';
    else if (status === 'denied') resolved = 'denied';
    else if (status === 'unsupported') resolved = 'unsupported';
    if (!resolved) return;
    finalizedRef.current = true;
    onResolvedRef.current?.(resolved);
  }, [status]);

  const requestPermission = useCallback(async () => {
    setOverride('requesting');
    setErrorMsg(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Browser does not expose getUserMedia.');
      saveCachedDecision('denied');
      setOverride('denied');
      return;
    }

    try {
      // Trigger the OS-level permission dialog. We close the audio track
      // immediately — SpeechRecognition.start() will reopen it through its
      // own pipeline once permission is granted.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      saveCachedDecision('granted');
      setOverride('granted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Permission denied.';
      setErrorMsg(message);
      saveCachedDecision('denied');
      setOverride('denied');
    }
  }, []);

  const continueManual = useCallback(() => {
    // Fire the manual notification FIRST and mark the gate finalized so the
    // subsequent setOverride('granted') (which dismisses the modal) doesn't
    // trigger the status-watching effect to also fire 'granted' on top.
    if (!finalizedRef.current) {
      finalizedRef.current = true;
      onResolvedRef.current?.('manual');
    }
    setOverride('granted'); // dismiss the modal UI
  }, []);

  // No render when the gate is satisfied or still figuring itself out.
  if (status === 'checking' || status === 'granted') {
    return null;
  }

  // Unsupported: thin banner pinned to the top, non-blocking.
  if (status === 'unsupported') {
    return (
      <div
        role="status"
        className="pointer-events-auto fixed left-1/2 top-4 z-50 w-[min(640px,calc(100%-2rem))] -translate-x-1/2 rounded-md border border-amber-500/30 bg-zinc-950/95 px-4 py-3 text-xs text-amber-200 shadow-lg backdrop-blur"
      >
        <p className="font-medium">Voice mode unavailable in this browser.</p>
        <p className="mt-1 text-zinc-400">
          Use Chrome or Edge for voice-driven highlighting. Manual mode coming in v0.4.
        </p>
      </div>
    );
  }

  // Modal for prompting / requesting / denied.
  const isRequesting = status === 'requesting';
  const isDenied = status === 'denied';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mic-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="mx-4 w-[min(420px,calc(100%-2rem))] rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
        <h2 id="mic-gate-title" className="text-lg font-medium tracking-tight">
          {isDenied ? 'Microphone blocked' : 'Enable microphone'}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {isDenied
            ? 'Voice mode needs microphone access. Re-enable mic permission in your browser settings, or continue without voice.'
            : 'Teleprompter listens to your voice to highlight words as you read. Mic stays on only while you are running.'}
        </p>

        {errorMsg ? (
          <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {errorMsg}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {!isDenied ? (
            <button
              type="button"
              onClick={requestPermission}
              disabled={isRequesting}
              className="rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRequesting ? 'Requesting…' : 'Allow microphone'}
            </button>
          ) : (
            <button
              type="button"
              onClick={requestPermission}
              className="rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-400/20"
            >
              Try again
            </button>
          )}

          <button
            type="button"
            onClick={continueManual}
            className="rounded-md border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900"
          >
            Continue in manual mode
          </button>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          Your voice is processed locally by your browser. Nothing is uploaded.
        </p>
      </div>
    </div>
  );
}
