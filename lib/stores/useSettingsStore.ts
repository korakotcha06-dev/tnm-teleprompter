'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScriptSettings, Theme } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

type SettingsState = ScriptSettings & {
  setFontSize: (n: number) => void;
  setLineHeight: (n: number) => void;
  setTheme: (t: Theme) => void;
  toggleMirror: () => void;
  setManualSpeed: (n: number) => void;
  reset: () => void;
};

// v0.1 Acceptance Criteria ranges (locked) — see 05 - Testing Checklist.md
export const FONT_SIZE_MIN = 24;
export const FONT_SIZE_MAX = 96;
export const LINE_HEIGHT_MIN = 1.2;
export const LINE_HEIGHT_MAX = 2.4;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setFontSize: (n) =>
        set({ fontSize: Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(n))) }),
      setLineHeight: (n) =>
        set({
          lineHeight: Math.max(
            LINE_HEIGHT_MIN,
            Math.min(LINE_HEIGHT_MAX, Number(n.toFixed(2)))
          ),
        }),
      setTheme: (t) => set({ theme: t }),
      toggleMirror: () => set((s) => ({ mirrorMode: !s.mirrorMode })),
      setManualSpeed: (n) =>
        set({ manualSpeed: Math.max(30, Math.min(300, Math.round(n))) }),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    { name: 'teleprompter.settings' }
  )
);
