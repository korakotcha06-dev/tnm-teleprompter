# Teleprompter

A free, voice-detect teleprompter by **Touchnewmedia Co., Ltd.** — read your script aloud and the page highlights + auto-scrolls to follow your voice. Thai-first, English supported. No accounts, no backend — scripts live in your browser.

**Live:** https://thetnm.com/teleprompter

## Stack

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind v4 · Zustand v5 · Web Speech API · IBM Plex + Montserrat fonts. localStorage only (no backend yet).

## Develop

```bash
npm run dev          # next dev -p 3010
```

> Note: `basePath` is `/teleprompter`, so in dev the app lives at **http://localhost:3010/teleprompter** (the root `/` 404s).

```bash
npm run build        # next build → static out/ (deploy/.htaccess copied into out/)
npm run test:matcher # matcher unit tests
```

## Deploy

Static export to a WordPress/PHP shared host (Plesk) under `httpdocs/teleprompter/`. Upload the **contents of `out/`** into the host's `/teleprompter/` folder (not the `out/` folder itself — every asset URL is `/teleprompter/_next/...`). The committed `deploy/.htaccess` ships inside `out/` to override WordPress's root catch-all. See [SPEC.md](./SPEC.md) §6 for full deploy + curl-verify steps.

## Docs

- [SPEC.md](./SPEC.md) — architecture, features, deploy, roadmap, version table
- Obsidian TNM Vault → `Teleprompter/` — Client Guide, Developer Guide, Changelog, API & Component Reference, Testing Checklist
