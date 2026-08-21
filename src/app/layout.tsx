import type { Metadata, Viewport } from 'next';

import '@fontsource-variable/public-sans/wght.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './globals.css';

import { Masthead } from '@/components/chrome';

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

/** Applied before first paint so the page never flashes the wrong print. */
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
