import type { Metadata } from 'next';
import {
  IBM_Plex_Sans,
  IBM_Plex_Sans_Thai,
  IBM_Plex_Mono,
  IBM_Plex_Serif,
  Montserrat,
} from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

// v0.5.0 brand reskin — IBM Plex family, self-hosted via next/font (no Google
// CDN at runtime; static-export safe). Inter removed entirely.
//
//   --font-sans : UI + display headings (Latin). Variable font.
//   --font-thai : Thai script body — IBM Plex Sans Thai has NO italic face,
//                 so we never apply `italic` to Thai-language elements.
//   --font-mono : eyebrows / pills / meta labels (mono, uppercase + tracking).
//   --font-serif: promo `.em` accent — italic display only (Latin copy).
const ibmSans = IBM_Plex_Sans({
  variable: '--font-sans',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const ibmThai = IBM_Plex_Sans_Thai({
  variable: '--font-thai',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const ibmMono = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

const ibmSerif = IBM_Plex_Serif({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['400'],
  style: ['italic'],
  display: 'swap',
});

// Brand wordmark — "TOUCHNEWMEDIA" lockup only (Montserrat, per Touch).
const montserrat = Montserrat({
  variable: '--font-brand',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

// Deployed at https://thetnm.com/teleprompter/ (Next basePath '/teleprompter').
// Trailing slash matches the served URL (trailingSlash: true) so canonical,
// hreflang, OG url + sitemap loc + JSON-LD url all agree on ONE URL.
const SITE_URL = 'https://thetnm.com/teleprompter/';

export const metadata: Metadata = {
  metadataBase: new URL('https://thetnm.com'),
  title: {
    default: 'เทเลพรอมเตอร์ออนไลน์ฟรี ภาษาไทย — Teleprompter | Touchnewmedia',
    template: '%s · Teleprompter Touchnewmedia',
  },
  description:
    'เทเลพรอมเตอร์ (บอกบท) ออนไลน์ฟรี ใช้ได้ทั้งภาษาไทยและอังกฤษ — เลื่อนบทอัตโนมัติหรือสั่งงานด้วยเสียง ไฮไลต์คำตามที่พูดแบบเรียลไทม์ ไม่ต้องสมัครสมาชิก บทเก็บในเครื่องคุณเอง ปลอดภัย. A free voice-controlled teleprompter (Thai + English) by Touchnewmedia.',
  keywords: [
    'เทเลพรอมเตอร์',
    'เทเลพรอมเตอร์ออนไลน์',
    'เทเลพรอมเตอร์ฟรี',
    'เทเลพรอมเตอร์ภาษาไทย',
    'บอกบท',
    'โปรแกรมบอกบท',
    'อ่านบท',
    'เลื่อนบทอัตโนมัติ',
    'teleprompter',
    'teleprompter online',
    'free teleprompter',
    'teleprompter thai',
    'voice teleprompter',
    'Touchnewmedia',
    // v0.5.6 SEO target set — AI Overview / search intent for free Thai prompter
    'teleprompter ภาษาไทย',
    'teleprompter ฟรี',
    'โปรแกรม teleprompter',
    'teleprompter ออนไลน์',
    'teleprompter ไม่ต้องติดตั้ง',
    'voice teleprompter thai',
    'เครื่องอ่านบทพูด',
    'อ่านบทพูดหน้ากล้อง',
  ],
  applicationName: 'Touchnewmedia Teleprompter',
  authors: [{ name: 'Touchnewmedia Co., Ltd.', url: 'https://thetnm.com' }],
  creator: 'Touchnewmedia Co., Ltd.',
  publisher: 'Touchnewmedia Co., Ltd.',
  category: 'productivity',
  alternates: {
    canonical: SITE_URL,
    languages: {
      'th-TH': SITE_URL,
      'en-US': SITE_URL,
    },
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Touchnewmedia Teleprompter',
    title: 'เทเลพรอมเตอร์ออนไลน์ฟรี ภาษาไทย — Teleprompter',
    description:
      'Teleprompter ภาษาไทย ฟรี — ตรวจจับเสียงพูดแล้วเลื่อนบทตามอัตโนมัติ รองรับอังกฤษ ไม่ต้องสมัคร ไม่ต้องติดตั้ง บทเก็บในเครื่องคุณ.',
    locale: 'th_TH',
    alternateLocale: ['en_US'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'เทเลพรอมเตอร์ออนไลน์ฟรี ภาษาไทย — Teleprompter',
    description:
      'Teleprompter ภาษาไทย ฟรี — ตรวจจับเสียงพูดแล้วเลื่อนบทตามอัตโนมัติ ไม่ต้องสมัคร ไม่ต้องติดตั้ง บทเก็บในเครื่องคุณ.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="th"
      className={`${ibmSans.variable} ${ibmThai.variable} ${ibmMono.variable} ${ibmSerif.variable} ${montserrat.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
