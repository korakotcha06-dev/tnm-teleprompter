'use client';

import { create } from 'zustand';
import type { Script, Token, Language } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { tokenize } from '@/lib/matcher/tokenize';
import {
  loadScripts,
  upsertScript as persistScript,
  deleteScript as removeScript,
} from '@/lib/storage/localStorage';

type ScriptStoreState = {
  // Library state
  scripts: Script[];
  hydrated: boolean;
  activeScriptId: string | null;

  // Playback state (used in /run/[id])
  tokens: Token[];
  cursor: number;
  highlightedIndices: Set<number>;
  /**
   * v0.3: word-like token indices that the matcher JUMPED over when the
   * speaker skipped a chunk of script (jump > SKIP_THRESHOLD). Rendered in
   * a muted-but-readable state — distinct from "consumed" (highlightedIndices)
   * and "pending" (neither). Lets Touch see at a glance that the engine
   * recognized the skip and didn't get stuck.
   */
  skippedIndices: Set<number>;
  isRunning: boolean;
  /**
   * v0.6.1: true once Start has been pressed, and stays true across Pause —
   * cleared only by restart(). RunController uses it to keep the teleprompter
   * mounted while paused (so scroll position + cursor survive) instead of
   * swapping back to the editor. Pause = freeze/resume; Restart = back to top.
   */
  /**
   * v0.5.5: shared scroll position across the run⇄edit surface swap. Both
   * TeleprompterView and InlineScriptEditor save their scrollTop here on
   * unmount and restore it on mount, so pausing to edit (and resuming) keeps
   * the exact reading position — no jump to the top. Reset to 0 only when the
   * content changes or on restart.
   */
  runScrollTop: number;
  /**
   * v0.5.5: the content string the current `tokens` were built from. Lets
   * setTokensFromContent skip re-tokenizing (and resetting the cursor) when the
   * content is unchanged — the key to resuming playback in place after a pause.
   */
  tokensSource: string;
  /**
   * v0.3: monotonically increments every time `restart()` runs. The
   * teleprompter view subscribes to it to reset its scroll container to the
   * top — necessary because in manual mode `cursor` stays 0 throughout, so
   * a cursor-based scroll-reset effect would never fire on a restart.
   */
  restartNonce: number;
  /**
   * v0.2: true when the Web Speech engine is actively listening. Written by
   * the `useVoiceMode` hook (run page) and read by ControlBar for the status
   * indicator. Distinct from `isRunning` — a denied/unsupported mic still has
   * isRunning=true (manual mode) but isListening stays false.
   */
  isListening: boolean;

  // Library actions
  hydrate: () => void;
  createScript: (
    title: string,
    content: string,
    language?: Language
  ) => Script;
  updateScript: (
    id: string,
    patch: Partial<Pick<Script, 'title' | 'content' | 'language'>>
  ) => void;
  deleteScript: (id: string) => void;
  setActive: (id: string | null) => void;
  /**
   * Insert-or-replace a complete Script (used by import). If a script with the
   * same id exists it's overwritten; otherwise appended. Persists immediately.
   */
  putScript: (script: Script) => void;

  // Playback actions
  setTokensFromContent: (content: string, language: Language) => void;
  start: () => void;
  pause: () => void;
  restart: () => void;
  /** Persist the live run/edit scroll position so the surface swap is seamless. */
  setRunScrollTop: (top: number) => void;
  advanceCursor: (n?: number) => void;
  /**
   * Jump the cursor to an absolute token index (voice mode "scroll-to-seek":
   * the user drags/wheels the script and playback continues from there).
   * Rebuilds highlightedIndices to everything before the new cursor and drops
   * skipped marks at/after it, so re-read words return to the pending state.
   */
  setCursor: (index: number) => void;
  markHighlighted: (index: number) => void;
  /** v0.3: bulk-mark word indices as "skipped". Idempotent / additive. */
  markSkipped: (indices: number[]) => void;
  setIsListening: (value: boolean) => void;
};

/**
 * Generate a stable UUID for new scripts.
 * Spec mandates `crypto.randomUUID()` — the v0.5 PHP backend stores `id` as
 * CHAR(36) UUID, and matching here keeps migration trivial. Falls back to a
 * timestamp+random combo only if the runtime predates crypto.randomUUID
 * (vanishingly rare on Chrome/Edge/Safari ≥ 2022, but kept for SSR safety).
 */
function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useScriptStore = create<ScriptStoreState>((set, get) => ({
  scripts: [],
  hydrated: false,
  activeScriptId: null,

  tokens: [],
  cursor: 0,
  highlightedIndices: new Set<number>(),
  skippedIndices: new Set<number>(),
  isRunning: false,
  runScrollTop: 0,
  tokensSource: '',
  restartNonce: 0,
  isListening: false,

  hydrate: () => {
    if (get().hydrated) return;
    const scripts = loadScripts();
    set({ scripts, hydrated: true });
  },

  createScript: (title, content, language = 'th') => {
    const now = new Date().toISOString();
    const script: Script = {
      id: uid(),
      title: title.trim() || 'Untitled',
      content,
      language,
      settings: { ...DEFAULT_SETTINGS },
      createdAt: now,
      updatedAt: now,
    };
    persistScript(script);
    set((s) => ({ scripts: [...s.scripts, script] }));
    return script;
  },

  updateScript: (id, patch) => {
    const scripts = get().scripts.map((s) =>
      s.id === id
        ? { ...s, ...patch, updatedAt: new Date().toISOString() }
        : s
    );
    const updated = scripts.find((s) => s.id === id);
    if (updated) persistScript(updated);
    set({ scripts });
  },

  deleteScript: (id) => {
    removeScript(id);
    set((s) => ({
      scripts: s.scripts.filter((x) => x.id !== id),
      activeScriptId: s.activeScriptId === id ? null : s.activeScriptId,
    }));
  },

  setActive: (id) => set({ activeScriptId: id }),

  putScript: (script) => {
    persistScript(script);
    set((s) => {
      const idx = s.scripts.findIndex((x) => x.id === script.id);
      if (idx >= 0) {
        const next = [...s.scripts];
        next[idx] = script;
        return { scripts: next };
      }
      return { scripts: [...s.scripts, script] };
    });
  },

  setTokensFromContent: (content, language) => {
    // v0.5.5 resume-in-place: TeleprompterView re-runs this on every mount,
    // including when resuming after a pause/edit where the content DIDN'T
    // change. Re-tokenizing identical content and resetting cursor to 0 would
    // throw away the reading position — the "ไม่ต่อที่จุดเดิม" bug. So if the
    // source content is unchanged, no-op (keep cursor / highlights / scroll).
    if (content === get().tokensSource) return;

    const tokens = tokenize(content, language);
    // Content genuinely changed (edited / different script) → fresh token array
    // with no meaningful cursor history. Reset position + scroll to the top.
    // Playback flags (isRunning/isListening) are owned by ControlBar/restart/
    // pause — we leave them alone (v0.6 regression guard).
    set({
      tokens,
      tokensSource: content,
      cursor: 0,
      runScrollTop: 0,
      highlightedIndices: new Set<number>(),
      skippedIndices: new Set<number>(),
    });
  },

  // start() marks the session as "started" — a flag that PERSISTS across a
  // pause so RunController keeps the teleprompter surface mounted (frozen at
  // its current scroll/cursor) instead of swapping back to the editor. Only
  // restart() clears it, returning to the editable top. This is what makes
  // Pause a true freeze-and-resume rather than a jump back to the top.
  start: () => set({ isRunning: true }),
  pause: () => set({ isRunning: false, isListening: false }),
  setRunScrollTop: (top) => set({ runScrollTop: top }),
  restart: () =>
    set((s) => ({
      cursor: 0,
      runScrollTop: 0,
      highlightedIndices: new Set<number>(),
      skippedIndices: new Set<number>(),
      isRunning: false,
      isListening: false,
      restartNonce: s.restartNonce + 1,
    })),

  advanceCursor: (n = 1) =>
    set((s) => {
      const next = Math.min(s.cursor + n, s.tokens.length);
      const newSet = new Set(s.highlightedIndices);
      for (let i = s.cursor; i < next; i++) newSet.add(i);
      return { cursor: next, highlightedIndices: newSet };
    }),

  setCursor: (index) =>
    set((s) => {
      const clamped = Math.max(0, Math.min(index, s.tokens.length));
      const high = new Set<number>();
      for (let i = 0; i < clamped; i++) high.add(i);
      const skip = new Set<number>();
      s.skippedIndices.forEach((i) => {
        if (i < clamped) skip.add(i);
      });
      return { cursor: clamped, highlightedIndices: high, skippedIndices: skip };
    }),

  markHighlighted: (index) =>
    set((s) => {
      const newSet = new Set(s.highlightedIndices);
      newSet.add(index);
      return { highlightedIndices: newSet };
    }),

  markSkipped: (indices) =>
    set((s) => {
      if (indices.length === 0) return s;
      const newSet = new Set(s.skippedIndices);
      for (const i of indices) newSet.add(i);
      return { skippedIndices: newSet };
    }),

  setIsListening: (value) => set({ isListening: value }),
}));
