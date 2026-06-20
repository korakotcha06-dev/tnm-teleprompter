# Teleprompter ฟรี ตรวจจับเสียงภาษาไทย — พูดแล้วหน้าจอเลื่อนตาม

**Free voice-detect teleprompter. Thai-first. No account. No install. Works in the browser.**

อ่านบทออกเสียง แล้วหน้าจอจะไฮไลต์คำที่กำลังพูดและเลื่อนตามให้อัตโนมัติ — ไม่ต้องตั้งความเร็วเอง รองรับภาษาไทยเป็นหลัก สลับเป็นอังกฤษได้ ใช้งานในเบราว์เซอร์ ไม่ต้องสมัครสมาชิก ไม่ต้องติดตั้งโปรแกรม

[![Live — thetnm.com/teleprompter](https://img.shields.io/badge/Live-thetnm.com%2Fteleprompter-FFB400?style=flat-square)](https://thetnm.com/teleprompter)
&nbsp;Built by **[Touchnewmedia Co., Ltd.](https://thetnm.com)** — Chiang Mai

---

## Features / ฟีเจอร์

- **ตรวจจับเสียงภาษาไทย (`th-TH`) + อังกฤษ (`en-US`)** — Voice detection via the browser-native Web Speech API. Thai word segmentation uses `Intl.Segmenter`, not a whitespace split.
- **ไม่มีบัญชี ไม่มี backend ข้อมูลไม่ออกจากเครื่อง** — No account, no server. Scripts live entirely in your browser's `localStorage`; nothing is uploaded.
- **นำเข้า/ส่งออกบทเป็น JSON** — Import / export scripts as `.json` to back up or share between machines. Fully client-side.
- **โหมดกระจก (แนวนอน/แนวตั้ง)** — Mirror mode, horizontal (`scaleX(-1)`) and vertical (`scaleY(-1)`) toggled independently, for beam-splitter teleprompter rigs.
- **เลื่อนแบบ WPM เอง (สำรอง)** — Manual constant-velocity WPM scroll (50–500) as a fallback when you don't want voice tracking.
- **ฟรีตลอด** — Free forever. No paywall, no trial, no telemetry.

---

## Why we built this / ทำไมเราถึงทำ

We're a Chiang Mai studio that shoots e-learning and course video, and our on-camera talent needed a prompter that follows *spoken Thai* — not a fixed-speed scroll you fight against. We couldn't find a free, Thai-first voice teleprompter that ran in the browser without an account, so we built one and gave it away.

เราทำเครื่องมือนี้ขึ้นมาใช้เองในงานถ่ายวิดีโอ e-learning ของสตูดิโอที่เชียงใหม่ เพราะหา teleprompter ภาษาไทยที่ตรวจจับเสียงได้ ฟรี และใช้ในเบราว์เซอร์โดยไม่ต้องสมัครสมาชิกไม่เจอ — เลยทำเองแล้วเปิดให้ใช้ฟรี

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16.2.6 (App Router, static export) |
| UI | React 19.2.4 + TypeScript 5 + Tailwind v4 |
| State | Zustand v5 (`persist` → localStorage) |
| Voice | Web Speech API (browser-native, `continuous` + `interimResults`) |
| Tokenizer | `Intl.Segmenter('th', { granularity: 'word' })` + EN whitespace split |
| Fonts | IBM Plex Sans / Thai / Mono / Serif + Montserrat (wordmark) — self-hosted via `next/font` |
| Backend | none yet — planned same-origin PHP REST (v0.5+) |

---

## Dev setup

```bash
# Dev — note: basePath ⇒ app lives at localhost:3010/teleprompter, root 404s
npm run dev            # next dev -p 3010

# Production build
npm run build          # next build → emits out/ (deploy/.htaccess copied into out/)

# Matcher unit tests
npm run test:matcher
```

---

## Deploy

Static export to a WordPress / PHP shared host (Plesk) under `httpdocs/teleprompter/`. Upload the **contents of `out/`** into the host's `/teleprompter/` folder — not the `out/` folder itself, because every asset URL is `/teleprompter/_next/...`. The committed `deploy/.htaccess` ships inside `out/` to override WordPress's root catch-all so it doesn't swallow the sub-path.

Full deploy steps + `curl` verification → [SPEC.md §6](./SPEC.md).

---

## Roadmap

- **Speech-driven backward re-sync** — re-reading is currently handled by scroll-anywhere-resume (drag back and voice re-seeks the cursor); auto-detecting a re-read from speech alone is still future work.
- **v0.5+ backend** — same-origin PHP REST at `/teleprompter-api/` (no CORS), localStorage→cloud bulk import, server-side bearer token, MySQL `scripts` + `user_settings`.
- **v1.0** — mobile responsive polish, Lighthouse > 90, Playwright E2E, cross-browser sign-off.

---

## Built by

**Touchnewmedia Co., Ltd.** — Photography · Video · Web · AI · Chiang Mai / Bangkok

- Site: https://thetnm.com
- Contact: korakot.cha@thetnm.com

## Docs

- [SPEC.md](./SPEC.md) — architecture, features, deploy, roadmap, version table
- Obsidian TNM Vault → `Teleprompter/` — Client Guide, Developer Guide, Changelog, API & Component Reference, Testing Checklist
