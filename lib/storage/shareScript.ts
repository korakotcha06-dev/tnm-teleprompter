// Import / Export scripts as .json files — the share mechanism.
//
// CONCEPT (Touch): scripts stay on the user's own device. No server, no
// accounts, no cloud — sharing is "download a file, send it to a friend, they
// import it". This module does only client-side serialization + a Blob
// download + a parse/validate of an uploaded file. Works on the static export.
//
// File shape is self-describing so import can validate what it's reading and
// reject junk JSON. Two wrapper kinds:
//   single : { type:'teleprompter.script',  schemaVersion, exportedAt, script }
//   library: { type:'teleprompter.library', schemaVersion, exportedAt, scripts }
// parseImportFile also tolerates a bare Script object or a bare Script[] array.

import type { Language, Script } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

export const EXPORT_SCHEMA_VERSION = '1';

const SINGLE_TYPE = 'teleprompter.script';
const LIBRARY_TYPE = 'teleprompter.library';

/** Stable id generator (same strategy as the store's uid()). */
function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Filename-safe slug from a title. Fallback 'script' for empty/symbol titles. */
function slugify(title: string): string {
  const slug = (title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/gi, '-') // keep latin + thai, collapse the rest to '-'
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'script';
}

function nowIso(): string {
  return new Date().toISOString();
}

export function serializeScript(script: Script): string {
  return JSON.stringify(
    {
      type: SINGLE_TYPE,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: nowIso(),
      script,
    },
    null,
    2
  );
}

export function serializeLibrary(scripts: Script[]): string {
  return JSON.stringify(
    {
      type: LIBRARY_TYPE,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: nowIso(),
      scripts,
    },
    null,
    2
  );
}

/** Trigger a browser download of `text` as `filename`. Client-only. */
function downloadJson(filename: string, text: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has consumed the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportScript(script: Script): void {
  downloadJson(`${slugify(script.title)}.teleprompter.json`, serializeScript(script));
}

export function exportLibrary(scripts: Script[]): void {
  downloadJson('teleprompter-library.json', serializeLibrary(scripts));
}

/**
 * Validate + normalize one raw object into a complete Script. Backfills missing
 * settings from DEFAULT_SETTINGS (handles older/foreign export schemas), keeps
 * the original id when present, defaults timestamps + language. Throws if the
 * essentials (title/content) are missing or wrong-typed.
 */
function normalizeScript(raw: unknown): Script {
  if (!raw || typeof raw !== 'object') {
    throw new Error('สคริปต์ในไฟล์ไม่ถูกต้อง');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.title !== 'string' || typeof r.content !== 'string') {
    throw new Error('ไฟล์ไม่มี title/content ของสคริปต์');
  }
  const language: Language = r.language === 'en' ? 'en' : 'th';
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(r.settings && typeof r.settings === 'object' ? r.settings : {}),
  };
  const ts = nowIso();
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uid(),
    title: r.title,
    content: r.content,
    language,
    settings,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : ts,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : ts,
  };
}

/**
 * Parse an uploaded file's text into one or more ready-to-store Scripts.
 * Accepts the single/library wrappers, a bare array, or a bare script object.
 * Throws a user-friendly error on invalid JSON / unrecognized shape.
 */
export function parseImportFile(text: string): Script[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('ไฟล์ไม่ใช่ JSON ที่อ่านได้');
  }

  // Wrapper forms
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (obj.type === LIBRARY_TYPE && Array.isArray(obj.scripts)) {
      return obj.scripts.map(normalizeScript);
    }
    if (obj.type === SINGLE_TYPE && obj.script) {
      return [normalizeScript(obj.script)];
    }
    // Bare single Script object (has title/content)
    if ('title' in obj && 'content' in obj) {
      return [normalizeScript(obj)];
    }
  }

  // Bare array of scripts
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error('ไฟล์ไม่มีสคริปต์');
    return data.map(normalizeScript);
  }

  throw new Error('ไม่ใช่ไฟล์สคริปต์ teleprompter');
}
