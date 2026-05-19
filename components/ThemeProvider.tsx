'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/stores/useSettingsStore';

/**
 * Applies persisted theme to <html> on mount and whenever it changes.
 * Default is `dark` (set in DEFAULT_SETTINGS) — `<html class="dark">` in
 * layout.tsx avoids FOUC on first paint before this provider hydrates.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.dataset.theme = theme;
  }, [theme]);

  return <>{children}</>;
}
