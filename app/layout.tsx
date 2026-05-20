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

export const metadata: Metadata = {
  title: 'Teleprompter · Touchnewmedia',
  description:
    'A free voice-detect teleprompter from Touchnewmedia — real-time word highlighting (Thai + English). No accounts, scripts stay in your browser.',
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
