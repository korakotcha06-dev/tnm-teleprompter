'use client';

import {
  useSettingsStore,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  MANUAL_SPEED_MIN,
  MANUAL_SPEED_MAX,
} from '@/lib/stores/useSettingsStore';
import type { Theme } from '@/types';

export function SettingsPanel() {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const mirrorMode = useSettingsStore((s) => s.mirrorMode);
  const toggleMirror = useSettingsStore((s) => s.toggleMirror);
  const mirrorV = useSettingsStore((s) => s.mirrorV);
  const toggleMirrorV = useSettingsStore((s) => s.toggleMirrorV);
  const manualSpeed = useSettingsStore((s) => s.manualSpeed);
  const setManualSpeed = useSettingsStore((s) => s.setManualSpeed);
  const reset = useSettingsStore((s) => s.reset);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <header className="flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-medium">Settings</h1>
        <button
          type="button"
          onClick={() => {
            if (confirm('Reset all settings to defaults?')) reset();
          }}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Reset
        </button>
      </header>

      <Section label="Font size" hint={`${fontSize}px`}>
        <input
          type="range"
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={2}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full accent-amber-400"
        />
      </Section>

      <Section label="Line height" hint={lineHeight.toFixed(2)}>
        <input
          type="range"
          min={LINE_HEIGHT_MIN}
          max={LINE_HEIGHT_MAX}
          step={0.05}
          value={lineHeight}
          onChange={(e) => setLineHeight(Number(e.target.value))}
          className="w-full accent-amber-400"
        />
      </Section>

      <Section label="Theme" hint={theme}>
        <div className="flex gap-2">
          {(['dark', 'light'] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                theme === t
                  ? 'border-amber-400 bg-amber-400/10 text-amber-500'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {t === 'dark' ? '🌙 Dark' : '☀ Light'}
            </button>
          ))}
        </div>
      </Section>

      <Section
        label="Mirror"
        hint={
          mirrorMode && mirrorV
            ? 'H + V'
            : mirrorMode
              ? 'horizontal'
              : mirrorV
                ? 'vertical'
                : 'off'
        }
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleMirror}
            title="Flip left ↔ right"
            className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
              mirrorMode
                ? 'border-amber-400 bg-amber-400/10 text-amber-500'
                : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            ⇆ Horizontal
          </button>
          <button
            type="button"
            onClick={toggleMirrorV}
            title="Flip top ↔ bottom"
            className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
              mirrorV
                ? 'border-amber-400 bg-amber-400/10 text-amber-500'
                : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            ⇅ Vertical
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Match your beam-splitter rig — some mounts reflect horizontally, some
          vertically, some both.
        </p>
      </Section>

      <Section
        label="Manual scroll speed"
        hint={`${manualSpeed} wpm`}
      >
        <input
          type="range"
          min={MANUAL_SPEED_MIN}
          max={MANUAL_SPEED_MAX}
          step={5}
          value={manualSpeed}
          onChange={(e) => setManualSpeed(Number(e.target.value))}
          className="w-full accent-amber-400"
        />
        <p className="text-xs text-zinc-500">
          Auto-scroll speed for Manual mode (50–500 wpm).
        </p>
      </Section>

      <p className="rounded-md border border-zinc-200 bg-white p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
        Voice-detect highlighting, fuzzy matching, and auto-scroll arrive in v0.2 + v0.3.
        Settings persist to localStorage.
      </p>
    </div>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
          {label}
        </h2>
        {hint && (
          <span className="text-xs tabular-nums text-zinc-500">{hint}</span>
        )}
      </div>
      {children}
    </section>
  );
}
