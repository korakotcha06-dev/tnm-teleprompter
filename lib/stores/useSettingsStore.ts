'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScriptSettings, Theme, ScrollMode } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

type SettingsState = ScriptSettings & {
  setFontSize: (n: number) => void;
  setLineHeight: (n: number) => void;
  setTheme: (t: Theme) => void;
  toggleMirror: () => void;
  setManualSpeed: (n: number) => void;
  setScrollMode: (m: ScrollMode) => void;
  reset: () => void;
};

// v0.1 Acceptance Criteria ranges (locked) — see 05 - Testing Checklist.md
export const FONT_SIZE_MIN = 24;
export const FONT_SIZE_MAX = 96;
export const LINE_HEIGHT_MIN = 1.2;
export const LINE_HEIGHT_MAX = 2.4;

// v0.3: manual mode slider range (Touch brief)
export const MANUAL_SPEED_MIN = 50;
export const MANUAL_SPEED_MAX = 200;

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
        set({
          manualSpeed: Math.max(
            MANUAL_SPEED_MIN,
            Math.min(MANUAL_SPEED_MAX, Math.round(n))
          ),
        }),
      setScrollMode: (m) => set({ scrollMode: m }),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'teleprompter.settings',
      // Backfill scrollMode for users who persisted v0.2 settings (where
      // the field didn't exist). Without this, hydrate returns
      // scrollMode=undefined and the Manual toggle is dead on first load.
      // We deliberately don't bump schemaVersion — this is an additive
      // optional field, not a breaking change.
      migrate: (persisted: unknown) => {
        if (persisted && typeof persisted === 'object') {
          const p = persisted as Partial<ScriptSettings>;
          return {
            ...DEFAULT_SETTINGS,
            ...p,
            scrollMode: p.scrollMode ?? 'voice',
            manualSpeed:
              typeof p.manualSpeed === 'number'
                ? Math.max(
                    MANUAL_SPEED_MIN,
                    Math.min(MANUAL_SPEED_MAX, p.manualSpeed)
                  )
                : DEFAULT_SETTINGS.manualSpeed,
          };
        }
        return DEFAULT_SETTINGS;
      },
      version: 1,
    }
  )
);
