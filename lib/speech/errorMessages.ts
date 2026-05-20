// Friendly, user-facing copy for SpeechRecognition error codes.
//
// Why this exists (v0.4.1):
//   The Web Speech API surfaces terse machine codes (`not-allowed`,
//   `audio-capture`, …). Rendering those raw — as the v0.4 banner did
//   ("Voice error: not-allowed") — left users stranded with no idea what to
//   do. This module maps each code to:
//     - a short title,
//     - actionable guidance (Thai-primary, English secondary),
//     - whether a plain "Try again" can plausibly recover, or whether the
//       user must fix a browser/OS permission first.
//
// This is presentation only. It does NOT change voice logic, matcher, or the
// hook's error state — it just decides how that state is shown.

import type { SpeechErrorCode } from './recognition';

export type SpeechErrorPresentation = {
  /** Short heading for the banner. */
  title: string;
  /** Primary guidance line (Thai). */
  message: string;
  /** Secondary guidance line (English) — optional, shown smaller. */
  messageEn?: string;
  /**
   * When true, the failure is a hard permission/service block that JS cannot
   * clear. The user must change a browser/OS setting before retrying — so the
   * banner should lead with "fix permission" framing rather than implying a
   * one-click retry will work. "Try again" is still offered (after they fix
   * it) but de-emphasized.
   */
  requiresPermissionFix: boolean;
};

// Mapping is intentionally exhaustive over the codes the engine can emit
// (see SpeechErrorCode). `aborted` / `no-speech` are filtered upstream as
// benign (useSpeechRecognition.BENIGN_ERRORS) so they normally never reach
// here — but we keep entries for completeness in case suppression is off.
const PRESENTATIONS: Record<SpeechErrorCode, SpeechErrorPresentation> = {
  'not-allowed': {
    title: 'ไมโครโฟนถูกบล็อก',
    message:
      'คลิกไอคอนไมค์ 🎤 ที่แถบที่อยู่ (URL) แล้วเลือก Allow จากนั้นรีโหลดหน้า — ถ้ายังไม่ได้ ให้เช็ค System Settings → Privacy → Microphone ว่าเปิดให้ Chrome แล้ว',
    messageEn:
      'Click the mic icon in the address bar, choose Allow, then reload. On macOS also check System Settings → Privacy → Microphone for Chrome.',
    requiresPermissionFix: true,
  },
  'service-not-allowed': {
    title: 'ระบบบล็อกไมโครโฟน',
    message:
      'เบราว์เซอร์หรือระบบบล็อกไมโครโฟน — ตรวจ System Settings → Privacy → Microphone ว่าเปิดให้ Chrome แล้ว แล้วรีโหลดหน้า',
    messageEn:
      'The browser or OS blocked the microphone. Check System Settings → Privacy → Microphone for Chrome, then reload.',
    requiresPermissionFix: true,
  },
  'no-speech': {
    title: 'ไม่ได้ยินเสียงพูด',
    message: 'ลองพูดดังขึ้น หรือเช็คว่าไมค์ตัวที่ถูกเลือกใช้งานได้',
    messageEn: 'No speech detected — speak up or check the selected mic.',
    requiresPermissionFix: false,
  },
  'audio-capture': {
    title: 'ไม่พบไมโครโฟน',
    message: 'เช็คว่าต่อไมค์หรืออุปกรณ์เสียงไว้ แล้วลองอีกครั้ง',
    messageEn: 'No microphone found — check that an input device is connected.',
    requiresPermissionFix: false,
  },
  network: {
    title: 'การเชื่อมต่อมีปัญหา',
    message: 'การรู้จำเสียงต้องใช้อินเทอร์เน็ต — ลองใหม่อีกครั้ง',
    messageEn: 'Network error during speech recognition — try again.',
    requiresPermissionFix: false,
  },
  aborted: {
    title: 'หยุดการฟังแล้ว',
    message: 'การฟังถูกหยุดกลางคัน — กด “ลองอีกครั้ง” เพื่อเริ่มฟังใหม่',
    messageEn: 'Listening was interrupted — try again to resume.',
    requiresPermissionFix: false,
  },
  'bad-grammar': {
    title: 'เกิดข้อผิดพลาดกับไมโครโฟน',
    message: 'ลองใหม่อีกครั้ง หรือสลับไปใช้ Manual mode',
    messageEn: 'Speech recognition error — try again or switch to Manual mode.',
    requiresPermissionFix: false,
  },
  'language-not-supported': {
    title: 'ภาษานี้ยังไม่รองรับ',
    message: 'เบราว์เซอร์ไม่รองรับการรู้จำเสียงภาษานี้ — ลองใช้ Manual mode',
    messageEn:
      "This browser can't recognize the script's language — use Manual mode.",
    requiresPermissionFix: false,
  },
  'not-supported': {
    title: 'เบราว์เซอร์ไม่รองรับเสียง',
    message: 'ใช้ Chrome หรือ Edge สำหรับโหมดเสียง หรือสลับไปใช้ Manual mode',
    messageEn: 'Use Chrome or Edge for voice mode, or switch to Manual mode.',
    requiresPermissionFix: false,
  },
  unknown: {
    title: 'เกิดข้อผิดพลาดกับไมโครโฟน',
    message: 'ลองใหม่อีกครั้ง หรือสลับไปใช้ Manual mode',
    messageEn: 'Something went wrong with the mic — try again or use Manual mode.',
    requiresPermissionFix: false,
  },
};

const FALLBACK = PRESENTATIONS.unknown;

/** Resolve a SpeechRecognition error code to user-facing presentation copy. */
export function presentSpeechError(code: SpeechErrorCode): SpeechErrorPresentation {
  return PRESENTATIONS[code] ?? FALLBACK;
}
