'use client';

// MicPermissionGate — onboarding + self-healing mic-permission UI for /run.
//
// v0.4.2 rewrite — the loop fix:
//   The old gate trusted a localStorage flag and, once it cached 'denied',
//   never re-checked the real permission. Unblocking the site in Chrome did
//   nothing; "Try again" only re-ran SpeechRecognition (instant re-fail). This
//   version delegates ALL permission truth to `useMicPermission`, which reads
//   the live Permissions API state and self-heals via onchange. localStorage
//   is now only a first-paint hint to avoid a modal flash when already granted.
//
// State → UI mapping (driven entirely by the live hook):
//   - 'granted'  → dismiss gate, resolve 'granted'. (External grant while the
//                  modal is open self-heals here: state flips → gate vanishes.)
//   - 'prompt'   → show CTA "Allow microphone" → request() fires native prompt.
//   - 'denied'   → show guidance + "Try again" (which re-requests for real) +
//                  Manual escape hatch. onchange self-heals if user unblocks.
//   - 'unknown'  → Permissions API unavailable (iOS/Safari). We DON'T block:
//                  show the same Allow CTA; request() does a direct getUserMedia
//                  (legacy iPad path). This is the no-regression guarantee.
//   - 'checking' → render nothing (brief async query; avoids modal flicker).
//
// SpeechRecognition unsupported (Firefox) is orthogonal to permission and is
// still surfaced as a thin non-blocking banner.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SpeechEngine } from '@/lib/speech/recognition';
import { useMicPermission } from '@/hooks/useMicPermission';

type ResolvedState = 'granted' | 'denied' | 'unsupported' | 'manual';

// useSyncExternalStore plumbing for the (immutable) SpeechRecognition support
// check — keeps SSR/CSR in sync without a setState-in-effect lint trip.
const supportSubscribe = (): (() => void) => () => undefined;
const getSupportClient = (): boolean => SpeechEngine.isSupported();
const getSupportServer = (): boolean => false;

type Props = {
  /** Fired once when the gate reaches a terminal decision for the parent. */
  onResolved?: (state: ResolvedState) => void;
};

export function MicPermissionGate({ onResolved }: Props) {
  const speechSupported = useSyncExternalStore(
    supportSubscribe,
    getSupportClient,
    getSupportServer
  );

  const { state, request } = useMicPermission();

  const [requesting, setRequesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Set when the user explicitly chooses Manual — locks the gate dismissed so
  // a later self-heal to 'granted' doesn't yank them back into voice mode.
  const [manualChosen, setManualChosen] = useState(false);

  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  // Resolution dispatch. Unlike v0.4 this is NOT one-shot-locked on
  // granted/denied: permission can self-heal both directions while the page is
  // open (deny → grant after the user fixes settings, or vice-versa), and the
  // parent must always reflect the *current* truth. The only sticky terminal
  // states are 'unsupported' (immutable) and user-chosen 'manual'.
  const finalizedRef = useRef(false);
  useEffect(() => {
    if (finalizedRef.current) return; // manual / unsupported already locked

    if (!speechSupported) {
      finalizedRef.current = true;
      onResolvedRef.current?.('unsupported');
      return;
    }
    // 'granted' → self-heal (the gate also renders null, so any stale errorMsg
    // is moot). 'denied' propagates so the parent can pause. 'prompt' /
    // 'unknown' / 'checking' are non-terminal — we wait for a user gesture
    // (request) before telling the parent anything.
    if (state === 'granted') {
      onResolvedRef.current?.('granted');
    } else if (state === 'denied') {
      onResolvedRef.current?.('denied');
    }
  }, [state, speechSupported]);

  const handleRequest = useCallback(async () => {
    setRequesting(true);
    setErrorMsg(null);
    const result = await request();
    setRequesting(false);
    if (!result.ok) {
      // Surface the failure inline. State (denied/unknown) drives the rest of
      // the UI; this just gives a human-readable reason.
      setErrorMsg(
        result.reason === 'no-device'
          ? 'ไม่พบไมโครโฟน — เช็คว่าต่ออุปกรณ์เสียงไว้'
          : result.reason === 'no-api'
            ? 'เบราว์เซอร์นี้ไม่รองรับการขอไมโครโฟน'
            : 'การเข้าถึงไมโครโฟนถูกปฏิเสธ'
      );
    }
    // On success, state flips to 'granted' (via hook setState + onchange) and
    // the resolution effect dismisses the gate — no extra work here.
  }, [request]);

  const continueManual = useCallback(() => {
    finalizedRef.current = true;
    setManualChosen(true);
    onResolvedRef.current?.('manual');
  }, []);

  // ── Render decisions ──────────────────────────────────────────────────

  // SpeechRecognition entirely missing (Firefox) → non-blocking banner.
  if (!speechSupported) {
    return (
      <div
        role="status"
        className="pointer-events-auto fixed left-1/2 top-4 z-50 w-[min(640px,calc(100%-2rem))] -translate-x-1/2 rounded-md border border-amber-500/30 bg-zinc-950/95 px-4 py-3 text-xs text-amber-200 shadow-lg backdrop-blur"
      >
        <p className="font-medium">Voice mode unavailable in this browser.</p>
        <p className="mt-1 text-zinc-400">
          Use Chrome or Edge for voice-driven highlighting. Manual mode still works.
        </p>
      </div>
    );
  }

  // Gate satisfied / dormant → render nothing:
  //   - 'granted'  : permission is live-granted, dismiss.
  //   - 'checking' : initial async query, avoid flicker.
  //   - manualChosen: user opted out of voice; don't re-show even if it heals.
  if (state === 'granted' || state === 'checking' || manualChosen) {
    return null;
  }

  const isDenied = state === 'denied';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mic-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="mx-4 w-[min(420px,calc(100%-2rem))] rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
        <h2 id="mic-gate-title" className="text-lg font-medium tracking-tight">
          {isDenied ? 'ไมโครโฟนถูกบล็อก' : 'เปิดไมโครโฟน'}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {isDenied
            ? 'โหมดเสียงต้องใช้ไมโครโฟน — ปลดบล็อกไมค์ในตั้งค่าเบราว์เซอร์ (คลิกไอคอน 🔒/🎤 ที่แถบที่อยู่ → Allow) แล้วหน้านี้จะปลดล็อกให้เองอัตโนมัติ หรือกด “ลองอีกครั้ง” หลังปลดบล็อก'
            : 'Teleprompter ฟังเสียงคุณเพื่อไฮไลต์คำขณะอ่าน ไมค์จะเปิดเฉพาะตอนที่กำลังรันเท่านั้น'}
        </p>

        {errorMsg ? (
          <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {errorMsg}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRequest}
            disabled={requesting}
            className={
              isDenied
                ? 'rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60'
                : 'rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60'
            }
          >
            {requesting ? 'กำลังขอสิทธิ์…' : isDenied ? 'ลองอีกครั้ง' : 'อนุญาตไมโครโฟน'}
          </button>

          <button
            type="button"
            onClick={continueManual}
            className="rounded-md border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900"
          >
            ใช้ Manual mode แทน
          </button>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          เสียงของคุณถูกประมวลผลในเบราว์เซอร์ ไม่มีการอัปโหลดออกไป
        </p>
      </div>
    </div>
  );
}
