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
  toggleMirrorV: () => void;
  setManualSpeed: (n: number) => void;
  setScrollMode: (m: ScrollMode) => void;
  setSidePadding: (n: number) => void;
  reset: () => void;
};

// v0.1 Acceptance Criteria ranges (locked) — see 05 - Testing Checklist.md
export const FONT_SIZE_MIN = 24;
export const FONT_SIZE_MAX = 96;
export const LINE_HEIGHT_MIN = 1.2;
export const LINE_HEIGHT_MAX = 2.4;

// v0.3.1: manual mode slider range. Touch feedback "ดูช้าไปมาก / เพิ่มสปีให้
// ไปได้มากกว่านี้" → max raised 200 → 500 for skim/rehearsal. Floor stays 50
// (now genuinely slow after the px/s recalibration in useManualScroll).
export const MANUAL_SPEED_MIN = 50;
export const MANUAL_SPEED_MAX = 500;

// v0.5.1: side gutter, % of viewport width PER SIDE. Touch report "ข้อความชิด
// ขอบซ้าย-ขวาเกินไป" on prod (the design's flex-center of width:90% was lost in
// the real globals.css, so the 10% gutter collapsed and text hugged the edge).
// Padding-based now (0 = full-bleed, 20% = very narrow column). Step ±2%.
export const SIDE_PADDING_MIN = 0;
export const SIDE_PADDING_MAX = 20;
export const SIDE_PADDING_STEP = 2;

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
      toggleMirrorV: () => set((s) => ({ mirrorV: !s.mirrorV })),
      setManualSpeed: (n) =>
        set({
          manualSpeed: Math.max(
            MANUAL_SPEED_MIN,
            Math.min(MANUAL_SPEED_MAX, Math.round(n))
          ),
        }),
      setScrollMode: (m) => set({ scrollMode: m }),
      setSidePadding: (n) =>
        set({
          sidePadding: Math.max(
            SIDE_PADDING_MIN,
            Math.min(SIDE_PADDING_MAX, Math.round(n))
          ),
        }),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'teleprompter.settings',
      // Backfill optional fields added after v0.2 for users who persisted an
      // older settings blob. Without this, hydrate returns those fields as
      // undefined and the related UI is dead on first load. We deliberately
      // DON'T bump schemaVersion — these are additive optional fields, not
      // breaking renames:
      //   - scrollMode (v0.3) → default 'voice'
      //   - manualSpeed (v0.3) → re-clamped to the current 50–500 range
      //   - mirrorV (v0.3.1) → default false (mirrorMode left untouched = H)
      //   - sidePadding (v0.5.1) → default 6%, re-clamped to the 0–20 range
      migrate: (persisted: unknown) => {
        if (persisted && typeof persisted === 'object') {
          const p = persisted as Partial<ScriptSettings>;
          return {
            ...DEFAULT_SETTINGS,
            ...p,
            scrollMode: p.scrollMode ?? 'voice',
            mirrorV: typeof p.mirrorV === 'boolean' ? p.mirrorV : false,
            manualSpeed:
              typeof p.manualSpeed === 'number'
                ? Math.max(
                    MANUAL_SPEED_MIN,
                    Math.min(MANUAL_SPEED_MAX, p.manualSpeed)
                  )
                : DEFAULT_SETTINGS.manualSpeed,
            sidePadding:
              typeof p.sidePadding === 'number'
                ? Math.max(
                    SIDE_PADDING_MIN,
                    Math.min(SIDE_PADDING_MAX, p.sidePadding)
                  )
                : DEFAULT_SETTINGS.sidePadding,
          };
        }
        return DEFAULT_SETTINGS;
      },
      version: 1,
    }
  )
);
