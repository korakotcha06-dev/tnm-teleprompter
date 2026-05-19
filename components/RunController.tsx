'use client';

// RunController — top-level voice + UI orchestration for /run/[id].
//
// Owns the lifecycle of:
//   - MicPermissionGate (one-time onboarding modal per browser)
//   - useVoiceMode (SpeechEngine + word matcher driven by store.isRunning)
//   - ControlBar (start/pause/restart, status indicator, edit toggle)
//   - View / Edit mode toggle (v0.2: inline cueprompter-style editing)
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
// Edit mode rules (v0.2):
//   - Entering edit → pause voice + clear listening flag + reset cursor.
//   - Entering edit while mirror is on → mirror auto-disables so the user
//     can actually type (typing into a `scaleX(-1)` element is unworkable);
//     mirror's previous value is remembered and restored on exit.
//   - Voice + edit are mutually exclusive — Start button is hidden / replaced
//     by Done in edit mode (ControlBar handles the swap).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useScriptStore } from '@/lib/stores/useScriptStore';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';
import { TeleprompterView } from './TeleprompterView';
import { ControlBar } from './ControlBar';
import { MicPermissionGate } from './MicPermissionGate';
import { InlineScriptEditor } from './InlineScriptEditor';
import { useVoiceMode } from '@/hooks/useVoiceMode';
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

  // v0.2: mode toggle. 'view' = teleprompter render + voice eligible.
  //                    'edit' = InlineScriptEditor mounted, voice paused.
  // Local state only — never persisted. Each /run/[id] visit starts in 'view'.
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Mirror auto-off during edit. We snapshot the user's mirror preference
  // at edit-entry time and restore it on exit. Stored in a ref so it
  // survives across renders without being a render-trigger.
  const mirrorMode = useSettingsStore((s) => s.mirrorMode);
  const toggleMirror = useSettingsStore((s) => s.toggleMirror);
  const savedMirrorRef = useRef<boolean | null>(null);

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

  // Voice mode only enabled when permission is granted AND we're in view
  // mode AND the user picked the voice scroll mode. useVoiceMode handles
  // the stop side via its isRunning watcher — we just need to ensure
  // isRunning flips to false when entering edit (done in `enterEdit` below)
  // and ensure voice doesn't fire when manual mode owns playback.
  const voiceEnabled =
    permissionResolved === 'granted' && mode === 'view' && scrollMode === 'voice';

  const voice = useVoiceMode({ language, enabled: voiceEnabled });

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

  const enterEdit = useCallback(() => {
    // Mutually exclusive with voice: pause + clear playback state before
    // mounting the editor. restart() doubles as "cursor=0 + clear highlights
    // + isRunning=false + isListening=false" so it's the cleanest reset.
    restart();
    // Snapshot + auto-disable mirror so typing isn't reversed.
    if (mirrorMode) {
      savedMirrorRef.current = true;
      toggleMirror();
    } else {
      savedMirrorRef.current = false;
    }
    setMode('edit');
  }, [restart, mirrorMode, toggleMirror]);

  const exitEdit = useCallback(() => {
    // Restore mirror only if we changed it on entry. (If the user manually
    // toggled mirror during edit — currently the UI hides the toggle, but
    // future-proofing — we don't want to fight their choice.)
    if (savedMirrorRef.current === true) {
      const currentMirror = useSettingsStore.getState().mirrorMode;
      if (!currentMirror) toggleMirror();
    }
    savedMirrorRef.current = null;
    setMode('view');
  }, [toggleMirror]);

  // An empty script (token count would be 0 after re-tokenize) should not
  // allow voice Start — there's nothing to match against. We derive this
  // from the script's content directly so the gating doesn't depend on the
  // store's tokens array being populated yet.
  const hasContent = (script?.content?.trim().length ?? 0) > 0;

  return (
    <div className="h-screen overflow-hidden bg-black text-zinc-100">
      {mode === 'edit' && script ? (
        <InlineScriptEditor script={script} onExit={exitEdit} />
      ) : (
        <TeleprompterView scriptId={scriptId} />
      )}

      <ControlBar
        voiceEnabled={voiceEnabled}
        mode={mode}
        onEnterEdit={enterEdit}
        onExitEdit={exitEdit}
        canStartVoice={hasContent && mode === 'view'}
      />

      {/* v0.3: removed the bottom spacer from v0.2. The teleprompter view
          now owns the viewport (h-screen) so the ControlBar's fixed
          positioning overlays it cleanly. The wrapper's py-32 padding
          inside the scroll area gives the last line enough breathing room
          to scroll above the control bar. */}

      <MicPermissionGate onResolved={setPermissionResolved} />

      {/* Inline error toast for runtime speech errors (e.g. permission revoked
          mid-session). Benign errors are already suppressed in the hook. */}
      {voice.error ? (
        <div
          role="alert"
          className="pointer-events-auto fixed bottom-24 left-1/2 z-40 w-[min(560px,calc(100%-2rem))] -translate-x-1/2 rounded-md border border-red-500/30 bg-zinc-950/95 px-4 py-3 text-xs text-red-300 shadow-lg backdrop-blur"
        >
          <p className="font-medium">Voice error: {voice.error.code}</p>
          <p className="mt-1 text-zinc-400">{voice.error.message}</p>
        </div>
      ) : null}
    </div>
  );
}
