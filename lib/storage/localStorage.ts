import type { Script } from '@/types';

/**
 * v0.1 storage adapter — localStorage only.
 *
 * The Script[] shape here matches the future PHP REST response shape exactly,
 * so the v0.5 migration is just swapping this module for an `apiClient.ts`
 * that calls /teleprompter-api/scripts. No callers need to change.
 *
 * Key: `teleprompter.scripts` (single JSON array)
 */

const STORAGE_KEY = 'teleprompter.scripts';
const VERSION_KEY = 'teleprompter.schemaVersion';
const SCHEMA_VERSION = '1';

export function loadScripts(): Script[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Script[];
  } catch {
    return [];
  }
}

export function saveScripts(scripts: Script[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    // Stamp schema version on every save — required by v0.1 Acceptance Criteria
    // and used by the v0.5 migration script to detect localStorage shape.
    window.localStorage.setItem(VERSION_KEY, SCHEMA_VERSION);
  } catch (err) {
    // QuotaExceeded etc. — log but don't crash the app
    console.error('teleprompter: failed to save scripts', err);
  }
}

export function loadScript(id: string): Script | undefined {
  return loadScripts().find((s) => s.id === id);
}

export function upsertScript(script: Script): void {
  const scripts = loadScripts();
  const idx = scripts.findIndex((s) => s.id === script.id);
  if (idx >= 0) {
    scripts[idx] = script;
  } else {
    scripts.push(script);
  }
  saveScripts(scripts);
}

export function deleteScript(id: string): void {
  const scripts = loadScripts().filter((s) => s.id !== id);
  saveScripts(scripts);
}
