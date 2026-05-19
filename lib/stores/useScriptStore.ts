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
  isRunning: boolean;
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

  // Playback actions
  setTokensFromContent: (content: string, language: Language) => void;
  start: () => void;
  pause: () => void;
  restart: () => void;
  advanceCursor: (n?: number) => void;
  markHighlighted: (index: number) => void;
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
  isRunning: false,
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

  setTokensFromContent: (content, language) => {
    const tokens = tokenize(content, language);
    set({
      tokens,
      cursor: 0,
      highlightedIndices: new Set<number>(),
      isRunning: false,
      isListening: false,
    });
  },

  start: () => set({ isRunning: true }),
  pause: () => set({ isRunning: false, isListening: false }),
  restart: () =>
    set({
      cursor: 0,
      highlightedIndices: new Set<number>(),
      isRunning: false,
      isListening: false,
    }),

  advanceCursor: (n = 1) =>
    set((s) => {
      const next = Math.min(s.cursor + n, s.tokens.length);
      const newSet = new Set(s.highlightedIndices);
      for (let i = s.cursor; i < next; i++) newSet.add(i);
      return { cursor: next, highlightedIndices: newSet };
    }),

  markHighlighted: (index) =>
    set((s) => {
      const newSet = new Set(s.highlightedIndices);
      newSet.add(index);
      return { highlightedIndices: newSet };
    }),

  setIsListening: (value) => set({ isListening: value }),
}));
