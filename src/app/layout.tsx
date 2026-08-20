import type { Metadata, Viewport } from 'next';

import '@fontsource-variable/public-sans/wght.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './globals.css';

import { Masthead } from '@/components/chrome';

/**
 * ── Direction contract ──────────────────────────────────────────────────────
 *
 * THESIS      Understory is a cable-plant record for software: it shows the
 *             run, not the verdict. It refuses the security-dashboard
 *             arrangement — dark ground, neon severity chips, donut chart,
 *             table of CVEs — because that layout answers "how bad" and this
 *             product answers "how did it get here".
 *
 * OWN-WORLD   A telephone-exchange cable record. Pale drafting stock, ink
 *             hairlines, orthogonal runs, terminal blocks, stencilled condensed
 *             uppercase labels, a title block on every sheet. One saturated
 *             colour — jumper vermilion — reserved entirely for the traced
 *             route. Structure is square; controls take 2px. No shadows:
 *             elevation is rule weight. Dark mode is the negative print.
 *
 * STORY       A visitor lands on the estate sheet, sees which of twelve
 *             applications carry live faults and how deep they sit, opens one
 *             advisory, watches the run drawn from each exposed application
 *             down to the fault, and reads which single change cuts the most
 *             runs.
 *
 * FIRST       A ruled estate ledger under one measured line of type stating
 * VIEWPORT    what the graph holds. Left: twelve applications as ruled rows
 *             with depth measures and fault stencils. Right: the fault
 *             register, ordered by reach. Primary action sits top-right.
 *
 * FORM        Exchange cable-plant record / jumper-run card. Candidate 7 of 7
 *             on the grounded list; assigned by the roll. Seed key 9b9b72d9.
 *
 * FINISH      unreviewed and undocumented is unfinished; this build ends with
 *             the finish review, the verdict, DESIGN.md, and every shipping
 *             raster carrying its provenance.
 * ────────────────────────────────────────────────────────────────────────────
 */
const DIRECTION_CONTRACT = `<!--
  Understory — direction contract (seed 9b9b72d9)
  THESIS: a cable-plant record for software; shows the run, not the verdict.
    Refuses the security-dashboard arrangement (dark ground, neon chips, donut).
  OWN-WORLD: telephone-exchange cable record. Drafting stock, ink hairlines,
    orthogonal runs, terminal blocks, stencilled labels, title block per sheet.
    One saturated colour (jumper vermilion) reserved for the traced route.
    Square structure, 2px controls, no shadows; dark mode is the negative print.
  STORY: see which applications carry live faults and how deep, open one, watch
    the run drawn to the fault, read which single change cuts the most runs.
  FIRST VIEWPORT: ruled estate ledger left, fault register right, one measured
    line of type above, primary action top-right.
  FORM: exchange cable-plant record / jumper-run card. Candidate 7 of 7.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the
    finish review, the verdict, DESIGN.md, and every shipping raster carrying
    its provenance.
-->`;

export const metadata: Metadata = {
  title: {
    default: 'Understory — dependency reach across an estate',
    template: '%s · Understory',
  },
  description:
    'Trace the shortest dependency path from an application you own to code you did not write, and find the one change that cuts it. Backed by a graph database.',
  applicationName: 'Understory',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f2ea' },
    { media: '(prefers-color-scheme: dark)', color: '#15243c' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/**
 * Applied before first paint so the page never flashes the wrong print.
 * Small enough to inline; it reads one stored value and falls back to the
 * operating system preference.
 */
const PRINT_SCRIPT = `(function(){try{var s=localStorage.getItem('understory.print');
if(s!=='stock'&&s!=='negative'){s=window.matchMedia('(prefers-color-scheme: dark)').matches?'negative':'stock';}
document.documentElement.setAttribute('data-theme',s);}catch(e){
document.documentElement.setAttribute('data-theme','stock');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="stock" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRINT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <div hidden aria-hidden="true" dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <a
          href="#sheet"
          className="stencil-strong sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-jumper focus:bg-sheet focus:px-3 focus:py-2 focus:no-underline"
        >
          Skip to content
        </a>
        <Masthead />
        {children}
      </body>
    </html>
  );
}
