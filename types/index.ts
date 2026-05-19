// Shared types for Teleprompter v0.1
// Schema matches the future PHP REST API at /teleprompter-api/ (lands v0.5)
// so localStorage → API migration is a trivial swap of the storage adapter.

export type Theme = 'dark' | 'light';
export type Language = 'th' | 'en';

export type ScriptSettings = {
  fontSize: number; // px
  lineHeight: number;
  theme: Theme;
  mirrorMode: boolean;
  manualSpeed: number; // words per minute (fallback when voice off; full use in v0.2)
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
  manualSpeed: 130,
};
