/**
 * Captures the interface for review and for the README.
 *
 *   npm run shots            capture into .review/
 *
 * Runs against a server the caller has already started in fixture mode, so the
 * output is deterministic: the same graph, the same ordering, the same figures
 * every time.
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';

import { style } from './style';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:3100';
const OUT = process.env.SHOT_DIR ?? '.review';

type Shot = {
  name: string;
  path: string;
  /** Wait for this selector before capturing. */
  ready?: string;
  full?: boolean;
};

const SHOTS: Shot[] = [
  { name: 'estate', path: '/', full: true },
  { name: 'register', path: '/advisories', full: true },
  { name: 'fault', path: '/advisories/USY-2026-0102', full: true },
  { name: 'application', path: '/applications/ledger-api', full: true },
  { name: 'package', path: '/packages/npm/lodash', full: true },
  { name: 'chokepoints', path: '/maintainers', full: true },
  { name: 'trace', path: '/trace?app=ledger-api&pkg=npm%3Alodash', full: true },
];

const VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
];

async function settle(page: Page): Promise<void> {
  // Entrance motion is disabled for capture: an element mid-animation reads as
  // a missing element and gets "fixed" into a regression.
  await page.addStyleTag({
    content: `*, *::before, *::after { animation: none !important; transition: none !important; }`,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(220);
}

async function capture(browser: Browser, shot: Shot, theme: 'stock' | 'negative'): Promise<void> {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      colorScheme: theme === 'negative' ? 'dark' : 'light',
    });
    await context.addInitScript(
      (value) => window.localStorage.setItem('understory.print', value),
      theme,
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    const response = await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle', timeout: 45_000 });
    if (shot.ready) await page.waitForSelector(shot.ready, { timeout: 15_000 });
    await settle(page);

    const suffix = theme === 'negative' ? '-negative' : '';
    const file = `${OUT}/${shot.name}-${viewport.label}${suffix}.png`;
    await page.screenshot({ path: file, fullPage: shot.full ?? false });

    const status = response?.status() ?? 0;
    const flag = status === 200 && errors.length === 0 ? style.green('ok  ') : style.red('FAIL');
    process.stdout.write(`  ${flag} ${file}  ${style.dim(`${status}`)}\n`);
    for (const error of errors.slice(0, 3)) {
      process.stdout.write(`       ${style.red(error)}\n`);
    }

    await context.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  process.stdout.write(`\n${style.bold('Understory - capture')}  ${style.dim(BASE)}\n\n`);

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
  });

  try {
    for (const shot of SHOTS) {
      await capture(browser, shot, 'stock');
    }
    // One pair in the negative print, to prove the second theme is composed
    // rather than mechanically inverted.
    await capture(browser, SHOTS[0] as Shot, 'negative');
    await capture(browser, SHOTS[2] as Shot, 'negative');
  } finally {
    await browser.close();
  }

  process.stdout.write(`\n${style.green('Captured into ' + OUT)}\n\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${style.red(error instanceof Error ? error.message : String(error))}\n`);
  process.exit(1);
});
