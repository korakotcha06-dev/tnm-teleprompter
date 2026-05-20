'use client';

// useMicPermission — live microphone permission state with self-heal (v0.4.2).
//
// THE BUG THIS FIXES:
//   v0.4 trusted a localStorage flag ('granted' | 'denied') as the source of
//   truth for mic permission. When the user changed the browser/OS setting
//   externally (e.g. unblocked the site in Chrome → state flips to "ask"), the
//   app never noticed — the stale 'denied' cache kept the gate/banner up and
//   the "Try again" button only restarted SpeechRecognition (which re-failed
//   instantly), producing the infinite loop CEO Touch hit.
//
// THE FIX — permission is now READ LIVE, never trusted from cache:
//   1. On mount, query `navigator.permissions.query({ name: 'microphone' })`
//      for the *real* current state ('granted' | 'denied' | 'prompt').
//   2. Subscribe to `permissionStatus.onchange` so an external change (user
//      unblocks the site, grants in OS settings) self-heals the UI without a
//      reload — the consumer re-evaluates and clears errors automatically.
//   3. `request()` calls getUserMedia (the ONLY thing that triggers the native
//      prompt — Permissions API can only *read* state, never change it). On
//      success the audio track is stopped immediately (we only wanted the
//      grant; SpeechRecognition opens its own pipeline later) — no mic leak.
//
//   localStorage is now a HINT ONLY (an optimization to skip the modal flash
//   when we already know it's granted). It NEVER blocks a re-request.
//
// iOS / Safari FALLBACK (must not regress — iPad is the primary device):
//   Safari historically does NOT support `permissions.query({name:'microphone'})`
//   — the call throws (TypeError) or resolves with an unknown name. When the
//   Permissions API is missing OR rejects, we degrade to `state: 'unknown'`:
//   the consumer then falls back to the original flow (just try getUserMedia
//   directly on a user gesture, let the OS handle the prompt). No onchange
//   self-heal is available there, but that's exactly v0.4's behavior on iPad,
//   which already works — so this path is a no-regression guarantee, not new
//   risk.

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Live permission state.
 *   - 'granted'  : mic allowed — skip the gate, start immediately.
 *   - 'prompt'   : not yet decided — show CTA that calls request() (→ native prompt).
 *   - 'denied'   : blocked — show guidance; onchange will self-heal if user fixes it.
 *   - 'unknown'  : Permissions API unavailable/unsupported (iOS/Safari) — caller
 *                  must fall back to trying getUserMedia directly on a gesture.
 *   - 'checking' : initial async query in flight (also the SSR snapshot).
 */
export type MicPermissionState = 'checking' | 'granted' | 'prompt' | 'denied' | 'unknown';

/** Result of a request() attempt — what the caller acts on. */
export type MicRequestResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'no-device' | 'no-api' | 'error'; message: string };

const STORAGE_KEY = 'teleprompter.micPermission';

// localStorage helpers — UNCHANGED schema (per locked constraint: cache key
// stays the same, only the *interpretation* changes). Values: 'granted'|'denied'.
function readHint(): 'granted' | 'denied' | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'granted' || raw === 'denied' ? raw : null;
  } catch {
    return null;
  }
}

function writeHint(value: 'granted' | 'denied'): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // QuotaExceeded / disabled storage — silent; the only cost is a modal
    // flash next visit, which is safe degradation.
  }
}

/** The failure half of MicRequestResult — what a rejection maps to. */
type MicRequestFailure = Extract<MicRequestResult, { ok: false }>;

/** Map a getUserMedia rejection to a stable reason for the caller. */
function classifyGumError(err: unknown): MicRequestFailure {
  const name = err instanceof DOMException ? err.name : '';
  const message = err instanceof Error ? err.message : 'Microphone request failed.';
  // NotAllowedError / SecurityError → user (or policy) denied.
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { ok: false, reason: 'denied', message };
  }
  // NotFoundError / OverconstrainedError → no usable input device.
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') {
    return { ok: false, reason: 'no-device', message };
  }
  return { ok: false, reason: 'error', message };
}

export type UseMicPermissionReturn = {
  /** Live state. See MicPermissionState. */
  state: MicPermissionState;
  /**
   * Trigger the native permission prompt by calling getUserMedia. Stops the
   * track immediately on success (no mic leak). MUST be called from a user
   * gesture or Chrome rejects it. Returns a structured result; also updates
   * `state` + the localStorage hint as a side effect.
   */
  request: () => Promise<MicRequestResult>;
};

export function useMicPermission(): UseMicPermissionReturn {
  // Start in 'checking'; the initial query effect resolves it on the client.
  // (No SSR concern — this hook is only mounted inside 'use client' trees.)
  const [state, setState] = useState<MicPermissionState>('checking');

  // Hold the live PermissionStatus so we can detach the listener on unmount.
  const statusRef = useRef<PermissionStatus | null>(null);

  // Initial query + onchange subscription. Self-heal lives here: any external
  // permission change fires onchange → we push the new state, and the consumer
  // (RunController) reacts by clearing the error banner / re-enabling Start.
  useEffect(() => {
    let cancelled = false;

    async function init(): Promise<void> {
      // No Permissions API at all (older Safari, some embedded webviews) →
      // 'unknown' so the caller takes the legacy direct-getUserMedia path.
      if (
        typeof navigator === 'undefined' ||
        !navigator.permissions ||
        typeof navigator.permissions.query !== 'function'
      ) {
        if (!cancelled) setState('unknown');
        return;
      }

      try {
        // `name: 'microphone'` is not in TS's PermissionName union in some lib
        // versions, and Safari rejects the name at runtime — both are handled:
        // the cast satisfies TS, the try/catch handles the runtime rejection.
        const status = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        });
        if (cancelled) return;

        statusRef.current = status;
        setState(status.state as MicPermissionState);

        // Self-heal: external permission flips push straight into state.
        status.onchange = () => {
          setState(status.state as MicPermissionState);
        };
      } catch {
        // Safari throws "TypeError: 'microphone' ... not a valid value" — this
        // is the iOS fallback path. Degrade to 'unknown'; iPad keeps working
        // exactly as it did in v0.4 (direct getUserMedia on gesture).
        if (!cancelled) setState('unknown');
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (statusRef.current) {
        statusRef.current.onchange = null;
        statusRef.current = null;
      }
    };
  }, []);

  const request = useCallback(async (): Promise<MicRequestResult> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      writeHint('denied');
      return { ok: false, reason: 'no-api', message: 'Browser does not expose getUserMedia.' };
    }

    try {
      // The ONLY call that triggers the native prompt. Permission state may be
      // 'prompt' (shows dialog) or 'granted' (resolves silently) — both fine.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // No leak: we only wanted the grant. SpeechRecognition opens its own mic.
      stream.getTracks().forEach((t) => t.stop());
      writeHint('granted');
      // If the Permissions API isn't backing us (iOS), nudge state to granted
      // ourselves so the consumer can proceed; on Chrome onchange also fires.
      setState('granted');
      return { ok: true };
    } catch (err) {
      const result = classifyGumError(err);
      if (result.reason === 'denied') {
        writeHint('denied');
        setState('denied');
      }
      return result;
    }
  }, []);

  return { state, request };
}

/** Read the cached hint without mounting the hook (used for first-paint skip). */
export function readMicPermissionHint(): 'granted' | 'denied' | null {
  return readHint();
}
