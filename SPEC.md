# Teleprompter — Technical Spec

**Owner:** Touchnewmedia Co., Ltd. · **Lead:** BYTE (Web PM & Architect)
**Status:** LIVE (production) · **Version:** v0.5.2
**Live:** https://thetnm.com/teleprompter
**Repo:** `/Users/korakotchangpan/Sites/teleprompter` (branch `main`)
**Full docs:** Obsidian TNM Vault → `Teleprompter/` (Index, Client Guide, Developer Guide, Changelog, API & Component Reference, Testing Checklist)

---

## 1. Overview

A free, voice-detect teleprompter built by Touchnewmedia — a Chiang Mai production studio that shoots e-learning / course video. We built the tool for our own on-camera talent and gave it away.

- **Voice-detect highlight:** read aloud; Web Speech API matches your words and the page auto-scrolls to keep the word you're reading on a center focal line. No manual speed dial needed.
- **Thai-first** (`th-TH`), English switchable (`en-US`). Thai word segmentation via `Intl.Segmenter`.
- **Free, no accounts, no backend (yet).** Scripts live in the browser (`localStorage`) — nothing leaves the tab.
- **Manual fallback:** constant-velocity WPM scroll mode for when voice isn't wanted.

---

## 2. Hosting & Deploy Model

- **Static export** (`output: 'export'`) — produces a plain `out/` folder of HTML/JS/CSS, no Node runtime.
- Served under a **sub-path** at `https://thetnm.com/teleprompter` via `basePath: '/teleprompter'` (Next inlines this into every link + asset URL; `assetPrefix` is auto-derived — not set manually).
- `trailingSlash: true` → every route is a real `folder/index.html` on disk; Apache serves them with zero rewrite rules.
- Host is a **WordPress / PHP shared host on Plesk** — files land in `httpdocs/teleprompter/`.
- **WP `.htaccess` gotcha:** WordPress's root catch-all (`RewriteRule . /index.php`) would steal `/teleprompter/...` and hand it to WP. Fix = a self-contained `.htaccess` placed **inside** `/teleprompter/` (committed at `deploy/.htaccess`, copied into `out/` after every build). It serves real files directly and long-caches hashed assets while forcing HTML revalidation.

---

## 3. Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16.2.6 (App Router, static export) |
| UI | React 19.2.4 + TypeScript 5 + Tailwind v4 (`@tailwindcss/postcss`) |
| State | Zustand v5 (`persist` middleware → localStorage) |
| Voice | Web Speech API (browser-native, `continuous`+`interimResults`) |
| Tokenizer | `Intl.Segmenter('th', { granularity: 'word' })` + EN whitespace split |
| Fonts | IBM Plex Sans / Sans Thai / Mono / Serif (body+UI) + Montserrat (brand wordmark) — via `next/font`, self-hosted, static-export safe |
| Backend | none yet — planned PHP REST at same-origin `/teleprompter-api/` (v0.5+) |

### Key architecture

- **Static export + basePath:** `/run/[id]` was refactored to a static `/run?id=<uuid>` route (a dynamic segment can't be pre-generated for runtime localStorage UUIDs). `RunPage` reads `useSearchParams().get('id')` inside a `<Suspense>` boundary (required or the prod build fails with "Missing Suspense boundary with useSearchParams").
- **Zustand stores:** `useScriptStore` (library CRUD + playback: tokens, cursor, highlighted/skipped index sets, isRunning, restartNonce, isListening) and `useSettingsStore` (font, line-height, theme, mirrorMode/mirrorV, scrollMode, manualSpeed, sidePadding — persisted with an additive `migrate()` that backfills fields added after v0.2, no schemaVersion bump).
- **Voice loop:** `SpeechEngine` (auto-restart guarded by `userStopped`) → `useSpeechRecognition` → `useWordMatcher` (slices already-consumed words, runs the fuzzy matcher, calls `markSkipped` then `advanceCursor`) → `useVoiceMode` glue watches `isRunning`.
- **Fuzzy matcher** (`lib/matcher/window-match.ts`): scans the next N word-like tokens, picks lowest Levenshtein distance, leftmost-on-tie. Conservative tune (v0.4): `WINDOW=6`, `MAX_DISTANCE=2`, length-scaled distance, nearest-priority, 2-word jump confirm to avoid spurious big jumps. Words ≤2 chars use exact-only. `lib/matcher/levenshtein.ts` is a two-row DP with length-gap + per-row early-exit at `max+1`.
- **Scroll engines (rAF):**
  - `useAutoScroll` (voice) — a single long-lived `requestAnimationFrame` loop owns a `target` scrollTop and eases `current += (target - current) * EASE_FACTOR` (0.07) every frame. Retargeting only moves `target` (no animation restart → no bounce). `DEAD_ZONE_PX = 24`, `SETTLE_PX = 0.5`. Centers the word at `cursor` (the word being read).
  - `useManualScroll` (manual) — constant velocity, length-independent reading-pace model: `px/s = (wpm / WORDS_PER_LINE) * (lineHeight*fontSize) * SPEED_MULTIPLIER / 60` (`WORDS_PER_LINE=8`, `SPEED_MULTIPLIER=1.6`). Fractional accumulator defeats integer-`scrollTop` truncation at slow speeds.
  - Both rely on the inner scroller having inline `scrollBehavior: 'auto'` (globals.css sets `* { scroll-behavior: smooth }`, which would otherwise fight per-frame writes).
- **Mirror (two-layer wrapper):** H (`scaleX(-1)`) and V (`scaleY(-1)`) are independent. The transform lives on an **outer, non-scrolling** wrapper; the inner scroller owns `scrollTop` in normal (unflipped) coordinates, so scroll math is never inverted.

---

## 4. Features (current — v0.5.2)

**Editor + library**
- Create / edit / delete scripts, run, all via UI. `crypto.randomUUID()` ids, ISO timestamps.
- localStorage CRUD (`teleprompter.scripts`, `teleprompter.settings`, `teleprompter.schemaVersion="1"`).
- Inline edit on the run page (cueprompter-style): toggle to a textarea, debounced auto-save (500ms), Esc/Done flush + re-tokenize.

**Run view**
- Voice highlight + cursor-driven smooth autoscroll (rAF-eased).
- Mic-permission self-heal (`useMicPermission`): reads live state via Permissions API + `onchange`; never trusts a stale cache; iOS/Safari falls back to direct `getUserMedia`. Friendly Thai voice-error banner mapping SpeechRecognition error codes → guidance + "Try again" / switch to Manual.
- Fuzzy skip-ahead matcher (conservative tune above).
- Manual WPM scroll mode (50–500, default 150).
- Mirror H / V independent toggles.
- Side-padding control (⇿ stepper, 0–20% per side, default 6%) — fixes text hugging the edge.
- **Reading system (v0.5.2):** single-color white text (`#F5F1E8`) + faint amber highlight on the current word (`rgba(255,180,0,0.16)`, padding/negative-margin so no reflow). Faint amber center **leading line** (voice + manual). Edit↔run wrap parity: `maxWidth 1500` + `sidePadding` + `white-space:pre-wrap` + `word-break:keep-all` so the textarea and the prompter break lines identically.

**Brand chrome (v0.5.0 reskin)**
- `SiteNav` (T. logo + TOUCHNEWMEDIA wordmark + status pill + Settings), `SiteHero` (headline + studio blurb + build/storage/library-count meta), `SitePromo` (4 service cards — E-learning production / Course design & scripting / Motion graphics & post / LMS-ready delivery + "Now booking" CTA), `SiteFooter`.
- `app/icon.svg` favicon (T. mark; boilerplate `favicon.ico` removed).

---

## 5. Design System (brand tokens — globals.css)

- **Warm-dark base:** `--bg #0A0907`, `--bg-2 #110E0A`; text scale `#F5F1E8 → --text-2 #C9C2B3 → --text-dim #8B8273 → --text-muted #5C554A → --text-ghost #3E3930`.
- **Amber accent:** `--tnm-amber #FFB400` (+ `-soft #FFB40022`, `-line #FFB40055`, `-deep #C68500`).
- **Light run-stage variant:** `#F5F1E8` bg / `#2A2722` text, amber highlight at 0.3.
- **Fonts:** `--font-sans/thai/mono/serif` (IBM Plex) + `--font-brand` (Montserrat, wordmark only).

---

## 6. Build / Deploy

```bash
# Dev (note: basePath ⇒ app lives at localhost:3010/teleprompter, root 404s)
npm run dev            # next dev -p 3010

# Production build
npm run build          # next build → emits out/ (NOT out/teleprompter/)
# deploy/.htaccess is copied into out/ as part of the build pipeline

# Matcher unit tests
npm run test:matcher
```

**Deploy (Plesk WP host, manual SFTP):**
1. `npm run build` → confirm `out/` fresh + `out/.htaccess` present.
2. Upload the **contents of `out/`** INTO `httpdocs/teleprompter/` (not the `out/` folder itself — every asset URL is `/teleprompter/_next/...`).
3. Static export ships no `node_modules/`, no `src/`, no `package.json` in `out/` — upload everything in `out/`.

**Verify (curl):**
```bash
curl -sL https://thetnm.com/teleprompter/ | grep -o '/teleprompter/_next' | head -1   # expect non-empty
curl -s -o /dev/null -w "%{http_code}\n" https://thetnm.com/teleprompter/              # 200, not WP 404
curl -s -o /dev/null -w "%{http_code}\n" https://thetnm.com/teleprompter/run/          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://thetnm.com/teleprompter/settings/     # 200
# then grab a /teleprompter/_next/static/chunks/*.js URL from the HTML and curl it → 200
```

---

## 7. Roadmap (remaining)

- **v0.6 — Backward re-sync (deferred per Touch):** read-direction recovery when the speaker jumps backward (re-reads a line). Needs a **bidirectional** match window + a 2–3 word confirm before moving the cursor back, so a single misheard word never yanks the prompter backward. Pairs with the existing forward skip-ahead.
- **v0.5+ backend:** PHP REST at same-origin `/teleprompter-api/` (no CORS — same host as the static app). localStorage→cloud bulk-import. Bearer token (server-side; a static export can't safely embed a build-time secret). MySQL `scripts` + `user_settings` tables.
- **v1.0:** mobile responsive polish, Lighthouse > 90, Playwright E2E, cross-browser sign-off.

---

## 8. Version Table

| Ver | Commit | Summary |
|-----|--------|---------|
| v0.1 | `7393efc` | localStorage editor + teleprompter view (static render) |
| v0.2 | `f144de4` | Voice highlight (Web Speech, exact match) + inline edit (cueprompter-style, on /run) |
| v0.3 | `6357733` | Skip-ahead fuzzy match (Levenshtein, window-match) + auto-scroll center + manual WPM scroll + mirror |
| v0.4 | `9d76c58` | Static-export deploy at thetnm.com/teleprompter (basePath, `/run/[id]`→`/run?id=`, .htaccess WP gotcha) + v0.3.1 fine-tune (speed recalibration ~6.5×, WPM 50–500, mirror H/V independent, matcher conservative tune: window 10→6, nearest-priority, length-scaled Levenshtein, 2-word jump confirm) |
| v0.4.1 | (in `e23c5ea`) | Friendly voice-error banner (SpeechRecognition error codes → Thai guidance + Try again / switch to Manual) |
| v0.4.2 | `e23c5ea` | Mic-permission self-heal — live Permissions API + onchange, retry re-requests getUserMedia, iOS fallback |
| v0.5.0 | `55a6b4e` | Touchnewmedia brand reskin — warm-dark + amber + IBM Plex + Montserrat wordmark; SiteNav/Hero/Promo/Footer; `lib/brand.ts`; `app/icon.svg` favicon; Library/Editor/run-view reskin |
| v0.5.1 | (in `84bbf2b`) | Side-padding control (⇿ stepper, 0–20%, default 6%) — fix text hugging edge |
| v0.5.2 | `84bbf2b` | Run-view reading polish: single-color white text + faint amber highlight (no reflow), rAF-eased smooth voice autoscroll (EASE_FACTOR 0.07, dead-zone 24px), faint center leading line (voice+manual) on the read word, edit↔run wrap parity (maxWidth 1500 + sidePadding + pre-wrap + keep-all) |
| v0.5.3 | `d3ca2c0` | Auto-save library editor (debounce 600ms) + edit-in-place on run page (Edit/Done removed) + scroll-anchor fix (typing no-jump) + Start→scroll regression fix + thetnm.com external link in nav |

---

## 9. Contact (lib/brand.ts)

Touchnewmedia Co., Ltd. · korakot.cha@thetnm.com · IG [@touchnewmedia](https://instagram.com/touchnewmedia) · Chiang Mai · Bangkok
"Get a quote" → LINE https://line.me/ti/p/~tib7057v · "View showreel" → Vimeo https://vimeo.com/thetnm
