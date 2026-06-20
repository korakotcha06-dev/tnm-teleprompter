'use client';

// RunController — top-level voice + UI orchestration for /run/[id].
//
// Owns the lifecycle of:
//   - MicPermissionGate (one-time onboarding modal per browser)
//   - useVoiceMode (SpeechEngine + word matcher driven by store.isRunning)
//   - ControlBar (start/pause/restart, status indicator)
//   - The idle⇄running surface swap (editable text when idle, teleprompter
//     while running)
//
// The page itself stays a thin server component that resolves the route
// param and mounts this controller. All client behavior lives here.
//
// Why this lives in components/ and not in app/run/[id]/:
//   The Next.js convention is for app/.../page.tsx to be a server component
//   when possible, and for client-side glue to live in dedicated components.
//   That keeps SSR boundaries clean and lets us refactor route layout later
//   without touching the controller.
//
// Edit-while-idle (v0.6): there is no explicit "edit mode" to toggle into.
//   - Not running → InlineScriptEditor is mounted: the script body is directly
//     editable and auto-saves (debounced) to localStorage. Just type.
//   - Start → tokenizes the latest text + runs (voice highlight or WPM scroll).
//   - Pause → freezes the teleprompter in place; Start resumes from the same
//     spot (the surface stays mounted, so scroll + cursor survive). v0.6.1.
//   - Restart → resets to the top and drops back to the editable surface.
//   - Mirror (H/V) only flips the RUNNING teleprompter; the editor is always
//     rendered unflipped, so no snapshot/restore of mirror prefs is needed.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';
import { TeleprompterView } from './TeleprompterView';
import { ControlBar } from './ControlBar';
import { MicPermissionGate } from './MicPermissionGate';
import { InlineScriptEditor } from './InlineScriptEditor';
import { useVoiceMode } from '@/hooks/useVoiceMode';
import { useMicPermission } from '@/hooks/useMicPermission';
import { presentSpeechError } from '@/lib/speech/errorMessages';
import type { Language } from '@/types';

type Props = {
  scriptId: string;
};

export function RunController({ scriptId }: Props) {
  const hydrated = useScriptStore((s) => s.hydrated);
  const hydrate = useScriptStore((s) => s.hydrate);
  const script = useScriptStore((s) => s.scripts.find((x) => x.id === scriptId));
  const pause = useScriptStore((s) => s.pause);
  const restart = useScriptStore((s) => s.restart);
  const start = useScriptStore((s) => s.start);

  // v0.6: editing is no longer a separate "mode" you toggle into. Whenever the
  // teleprompter is NOT running, the script body is directly editable (inline
  // textarea, auto-saving). Pressing Start tokenizes the latest text and runs;
  // pausing/restarting drops back to the editable surface. This removes the
  // old view⇄edit toggle ("no bouncing") — you just type, then run.
  const isRunning = useScriptStore((s) => s.isRunning);

  // Mirror preferences only ever apply to the RUNNING teleprompter view — the
  // editable surface is always rendered unflipped (you can't type into mirrored
  // text). So no snapshot/restore dance is needed: toggling H/V just stores the
  // preference, and it takes visible effect once you Start.

  // Track whether the user has resolved the mic permission gate. Until then,
  // voice mode stays disabled so we don't try to start speech recognition
  // without user consent (Chrome would reject it anyway).
  const [permissionResolved, setPermissionResolved] = useState<
    'granted' | 'denied' | 'unsupported' | 'manual' | null
  >(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const language: Language = script?.language ?? 'th';

  // v0.3 scroll mode — selected by the user via ControlBar toggle. Voice
  // mode arms the SpeechEngine; manual mode runs a WPM-driven scroller
  // (handled inside TeleprompterView). They're mutually exclusive.
  const scrollMode = useSettingsStore((s) => s.scrollMode);
  const setScrollMode = useSettingsStore((s) => s.setScrollMode);

  // v0.5.0 run-view skin: the warm-dark run stage flips to a light variant
  // (#F5F1E8 paper) via the existing settings `theme` flag — the Light toggle
  // in the ControlBar drives setTheme. We mirror it onto `.run-stage.light`
  // so the run view re-colors (text + cur slab + bar) without touching logic.
  const theme = useSettingsStore((s) => s.theme);

  // Voice mode only enabled when permission is granted AND the user picked the
  // voice scroll mode. useVoiceMode arms/disarms the SpeechEngine off the
  // store's `isRunning` flag, so the mic only opens after Start — while the
  // editable (not-running) surface is up, isRunning is false and voice stays
  // dormant on its own.
  const voiceEnabled =
    permissionResolved === 'granted' && scrollMode === 'voice';

  const voice = useVoiceMode({ language, enabled: voiceEnabled });

  // v0.4.2 self-heal: live mic-permission state shared with MicPermissionGate.
  // We use it here for two things the gate can't do alone:
  //   1. retryVoice() must RE-REQUEST getUserMedia (the only thing that fires
  //      the native Chrome prompt) before re-arming SpeechEngine — otherwise
  //      "ลองอีกครั้ง" just restarts recognition and instantly re-fails,
  //      which was the v0.4 loop.
  //   2. When the user fixes permission externally while the error banner is
  //      up, `micPermission.state` flips to 'granted' (via Permissions API
  //      onchange) and the effect below auto-clears the banner + re-enables
  //      Start with no reload. On iOS (state 'unknown') this self-heal isn't
  //      available, which matches v0.4 behavior — no regression.
  const micPermission = useMicPermission();

  // If the user denied or is on an unsupported browser, ensure we don't
  // leave isRunning=true silently — that would show "Pause" with no way for
  // the matcher to advance the cursor. Pause is safer; user can still use
  // the manual +1 button which works without voice.
  useEffect(() => {
    if (permissionResolved === 'denied' || permissionResolved === 'unsupported') {
      // No-op unless we're somehow already running — graceful safety net.
      if (useScriptStore.getState().isRunning) pause();
    }
  }, [permissionResolved, pause]);

  // v0.4.2 voice-error recovery — THE LOOP FIX.
  //
  // The v0.4.1 retry only called restart()+start(), which re-armed
  // SpeechRecognition without ever calling getUserMedia. For a 'not-allowed'
  // error that meant: restart → recognition.start() → instant 'not-allowed'
  // again → banner → user taps retry → repeat. No native prompt ever fired.
  //
  // Fix: retry now RE-REQUESTS getUserMedia first (the only API that triggers
  // the browser's permission prompt). This runs inside the button's click
  // handler, so the user gesture is on the stack — Chrome will show the prompt
  // when state is 'prompt'. Only after a successful grant do we re-arm voice.
  //   - granted   → restart() + start() → SpeechEngine listens, error clears.
  //   - still denied → the gate/banner stay up; nothing loops because we don't
  //     blindly restart a recognizer that will instantly re-fail.
  const retryVoice = useCallback(async () => {
    const result = await micPermission.request();
    if (result.ok) {
      restart();
      start();
    }
    // On failure, micPermission.state reflects denied/unknown and the banner
    // remains — no recognizer restart, so no instant-re-fail loop.
  }, [micPermission, restart, start]);

  // Self-heal: if mic permission flips to 'granted' (user unblocked the site
  // / OS) while a voice error banner is showing, silently re-arm voice so the
  // banner clears and Start works again — no manual retry, no reload. Guarded
  // on an active error + voice mode so we don't fire spuriously. On iOS the
  // state stays 'unknown' (no Permissions API), so this never runs there —
  // matching v0.4 behavior exactly (no regression).
  const healArmedRef = useRef(false);
  useEffect(() => {
    if (
      micPermission.state === 'granted' &&
      voice.error &&
      scrollMode === 'voice' &&
      !healArmedRef.current
    ) {
      healArmedRef.current = true;
      restart();
      start();
    }
    // Re-arm the one-shot guard once the error is gone, so a *future* external
    // re-deny → re-grant cycle can heal again.
    if (!voice.error) healArmedRef.current = false;
  }, [micPermission.state, voice.error, scrollMode, restart, start]);

  // switchToManual → stop voice, flip scroll mode. The user then presses Start
  // (now a WPM auto-scroll) from the ControlBar. Reuses the same store action
  // the ControlBar's Manual segment uses — no new logic path.
  const switchToManual = useCallback(() => {
    pause();
    setScrollMode('manual');
  }, [pause, setScrollMode]);

  // An empty script (token count would be 0 after re-tokenize) should not
  // allow voice Start — there's nothing to match against. We derive this
  // from the script's content directly so the gating doesn't depend on the
  // store's tokens array being populated yet.
  const hasContent = (script?.content?.trim().length ?? 0) > 0;

  // Whenever NOT running, the script body is directly editable (no Edit button
  // to press first — just type). Pausing drops to this editable surface; the
  // shared runScrollTop + cursor-preserving tokenize keep the position so it
  // doesn't jump to the top, and pressing Start resumes in place (or restarts
  // from the top if the content was edited).
  const showEditor = !isRunning && !!script;

  return (
    <div className={`run-stage ${theme === 'light' ? 'light' : ''}`}>
      {/* Subtle brand watermark, top-left. Decorative only. */}
      <div className="run-mark">
        <div className="bm">T</div>
        <span className="lab">Touchnewmedia · Teleprompter</span>
      </div>

      {showEditor && script ? (
        <InlineScriptEditor script={script} />
      ) : (
        <TeleprompterView scriptId={scriptId} />
      )}

      <ControlBar voiceEnabled={voiceEnabled} canStartVoice={hasContent} />

      <MicPermissionGate onResolved={setPermissionResolved} />

      {/* v0.4.1: friendly voice-error banner with recovery actions. Benign
          errors (no-speech / aborted) are suppressed upstream in the hook, so
          anything reaching here is worth surfacing. We map the raw code to
          Thai-primary guidance + two recovery buttons. Permission-class errors
          (not-allowed / service-not-allowed) lead with "go fix the browser/OS
          setting" framing, since JS can't clear them — Try again only helps
          after the user has fixed it. Gated on voice scroll mode so that
          choosing "ใช้ Manual mode แทน" (which flips scrollMode→manual)
          immediately dismisses the now-irrelevant voice error. */}
      {voice.error && scrollMode === 'voice' ? (
        (() => {
          const p = presentSpeechError(voice.error.code);
          return (
            <div
              role="alert"
              className="pointer-events-auto fixed bottom-24 left-1/2 z-40 w-[min(560px,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-amber-500/30 bg-zinc-950/95 px-4 py-3.5 text-zinc-200 shadow-lg backdrop-blur"
            >
              <div className="flex gap-3">
                <span aria-hidden className="text-lg leading-none">
                  🎤
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-amber-200">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {p.message}
                  </p>
                  {p.messageEn ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                      {p.messageEn}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {/* Manual mode is the always-works escape hatch, so for
                        permission-class errors it leads. Otherwise Try again
                        leads. */}
                    {p.requiresPermissionFix ? (
                      <>
                        <button
                          type="button"
                          onClick={switchToManual}
                          className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-amber-300"
                        >
                          ใช้ Manual mode แทน
                        </button>
                        <button
                          type="button"
                          onClick={retryVoice}
                          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
                        >
                          ลองอีกครั้ง
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={retryVoice}
                          className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-amber-300"
                        >
                          ลองอีกครั้ง
                        </button>
                        <button
                          type="button"
                          onClick={switchToManual}
                          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
                        >
                          ใช้ Manual mode แทน
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      ) : null}
    </div>
  );
}
