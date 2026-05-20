// Shared types for Teleprompter v0.1
// Schema matches the future PHP REST API at /teleprompter-api/ (lands v0.5)
// so localStorage → API migration is a trivial swap of the storage adapter.

export type Theme = 'dark' | 'light';
export type Language = 'th' | 'en';

/**
 * v0.3: scroll mode toggle. 'voice' = highlight + auto-scroll driven by Web
 * Speech matcher. 'manual' = constant-velocity scroll at `manualSpeed` WPM,
 * no highlighting (visual reading guide replaces it). Persisted in
 * UserSettings (window-level), not per-script — Touch picks one default
 * style for the device.
 */
export type ScrollMode = 'voice' | 'manual';

export type ScriptSettings = {
  fontSize: number; // px
  lineHeight: number;
  theme: Theme;
  /**
   * Horizontal mirror (scaleX(-1)) — flips left↔right. Kept under the
   * original `mirrorMode` name (NOT renamed to mirrorH) so v0.2/v0.3
   * persisted settings hydrate without a breaking migration.
   */
  mirrorMode: boolean;
  /**
   * v0.3.1: Vertical mirror (scaleY(-1)) — flips top↔bottom, independent of
   * mirrorMode. Some beam-splitter rigs reflect the vertical axis instead of
   * (or in addition to) horizontal. Additive optional field — backfilled to
   * false in the store migrate step; schemaVersion stays 1.
   */
  mirrorV: boolean;
  manualSpeed: number; // words per minute (used by v0.3 manual scroll mode)
  /** v0.3: 'voice' or 'manual'. Defaults to 'voice'. */
  scrollMode: ScrollMode;
};

export type Script = {
  id: string;
  title: string;
  content: string;
  language: Language;
  settings: ScriptSettings;
  createdAt: string; // ISO 8601
  updatedAt: string;
};

export type Token = {
  index: number;
  text: string;
  isWhitespace: boolean;
};

export const DEFAULT_SETTINGS: ScriptSettings = {
  fontSize: 48,
  lineHeight: 1.6,
  theme: 'dark',
  mirrorMode: false,
  mirrorV: false,
  manualSpeed: 150, // v0.3.1 brief: range 50–500 wpm, default 150 (comfortable read-aloud pace)
  scrollMode: 'voice',
};
