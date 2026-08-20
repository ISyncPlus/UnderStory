import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const OUTPUT_VIDEO = '/Users/InhouseHQ/.gemini/antigravity-ide/brain/2292e2ba-23eb-4726-8bf3-926b078d5f48/understory_demo_walkthrough.mp4';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function injectOverlayAndCursor(page: any) {
  await page.evaluate(() => {
    const existing = document.getElementById('demo-motion-layer');
    if (existing) existing.remove();

    const layer = document.createElement('div');
    layer.id = 'demo-motion-layer';
    layer.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 999999;
      font-family: var(--font-stencil), 'Barlow Condensed', sans-serif;
    `;

    // 1. Virtual Cursor with Glowing Ring
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 18px;
      height: 18px;
      background: rgba(224, 76, 50, 0.95);
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5), 0 0 12px rgba(224, 76, 50, 0.9);
      transform: translate(-50%, -50%);
      transition: transform 0.08s ease;
      z-index: 1000000;
      display: block;
    `;

    // 2. Click ripple element
    const ripple = document.createElement('div');
    ripple.id = 'demo-ripple';
    ripple.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid var(--color-jumper, #e04c32);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      transition: transform 0.45s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.45s ease-out;
      pointer-events: none;
      z-index: 999999;
    `;

    // 3. Floating Glassmorphic Annotation Card (Bottom Left)
    const banner = document.createElement('div');
    banner.id = 'demo-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 28px;
      left: 28px;
      max-width: 620px;
      background: color-mix(in oklch, var(--color-sheet, #162438) 94%, black);
      border: 1.5px solid var(--color-rule-strong, #3a567c);
      padding: 16px 24px;
      box-shadow: 0 20px 48px -10px rgba(0,0,0,0.7);
      opacity: 0;
      transform: translateY(24px);
      transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(12px);
    `;

    banner.innerHTML = `
      <div id="demo-banner-tag" style="font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-jumper, #e04c32); margin-bottom: 4px;">
        01 · THE PROBLEM
      </div>
      <div id="demo-banner-title" style="font-size: 19px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink, #ffffff); line-height: 1.2; margin-bottom: 6px;">
        Transitive Dependency Explosion
      </div>
      <div id="demo-banner-body" style="font-family: var(--font-sans), sans-serif; font-size: 13.5px; color: var(--color-ink-2, #b4c6db); line-height: 1.45;">
        Direct dependencies are only the entry point. Real vulnerability reach extends 6 hops deep into the graph.
      </div>
    `;

    // 4. Live Graph Status Badge (Top Right)
    const watermark = document.createElement('div');
    watermark.id = 'demo-watermark';
    watermark.style.cssText = `
      position: fixed;
      top: 16px;
      right: 170px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: color-mix(in oklch, var(--color-sheet, #162438) 90%, transparent);
      border: 1px solid var(--color-rule, #2c4464);
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--color-ink, #ffffff);
      backdrop-filter: blur(8px);
    `;
    watermark.innerHTML = `
      <span style="display:inline-block; width:7px; height:7px; background: #28c76f; border-radius:1px;"></span>
      <span>COGNODB LIVE GRAPH · MERIDIAN SYSTEMS</span>
    `;

    layer.appendChild(cursor);
    layer.appendChild(ripple);
    layer.appendChild(banner);
    layer.appendChild(watermark);
    document.body.appendChild(layer);

    (window as any).__demo = {
      setCursor(x: number, y: number) {
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
      },
      clickEffect(x: number, y: number) {
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.style.transform = 'translate(-50%, -50%) scale(0)';
        ripple.style.opacity = '1';
        requestAnimationFrame(() => {
          ripple.style.transform = 'translate(-50%, -50%) scale(4)';
          ripple.style.opacity = '0';
        });
      },
      showBanner(tag: string, title: string, body: string) {
        const tagEl = document.getElementById('demo-banner-tag');
        const titleEl = document.getElementById('demo-banner-title');
        const bodyEl = document.getElementById('demo-banner-body');
        if (tagEl) tagEl.innerText = tag;
        if (titleEl) titleEl.innerText = title;
        if (bodyEl) bodyEl.innerText = body;
        banner.style.opacity = '1';
        banner.style.transform = 'translateY(0)';
      },
      hideBanner() {
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(24px)';
      }
    };
  });
}

async function moveMouseSmooth(page: any, startX: number, startY: number, targetX: number, targetY: number, steps = 30) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const curX = Math.round(startX + (targetX - startX) * ease);
    const curY = Math.round(startY + (targetY - startY) * ease);
    await page.evaluate(({ x, y }: { x: number; y: number }) => {
      if ((window as any).__demo) (window as any).__demo.setCursor(x, y);
    }, { x: curX, y: curY });
    await sleep(15);
  }
}

async function performClick(page: any, x: number, y: number) {
  await page.evaluate(({ x, y }: { x: number; y: number }) => {
    if ((window as any).__demo) {
      (window as any).__demo.setCursor(x, y);
      (window as any).__demo.clickEffect(x, y);
    }
  }, { x, y });
  await sleep(140);
  await page.mouse.click(x, y);
  await sleep(250);
}

async function smoothScroll(page: any, targetScrollY: number, steps = 40) {
  const currentScroll = await page.evaluate(() => window.scrollY);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const scrollVal = Math.round(currentScroll + (targetScrollY - currentScroll) * ease);
    await page.evaluate((y: number) => window.scrollTo(0, y), scrollVal);
    await sleep(18);
  }
}

async function main() {
  console.log('🚀 Launching Chromium for High-Definition Walkthrough Demo...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  console.log('🎥 Initializing FFmpeg 1080p MP4 Encoder...');
  const ffmpeg = spawn('/opt/homebrew/bin/ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', '30',
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'slow',
    '-crf', '18',
    OUTPUT_VIDEO
  ]);

  const client = await page.createCDPSession();
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });

  client.on('Page.screencastFrame', async ({ data, sessionId }) => {
    const buffer = Buffer.from(data, 'base64');
    try {
      ffmpeg.stdin.write(buffer);
      await client.send('Page.screencastFrameAck', { sessionId });
    } catch (e) {}
  });

  let mouseX = 960;
  let mouseY = 540;

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 1: THE OVERVIEW & THESIS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 1: Estate Overview & Thesis');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await injectOverlayAndCursor(page);
  await moveMouseSmooth(page, mouseX, mouseY, 420, 320, 25);
  mouseX = 420; mouseY = 320;

  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '01 · THE SYSTEM',
      'Understory · Dependency Reachability',
      'Models 12 applications across 2,501 releases in CognoDB to answer reachability questions tables cannot solve.'
    );
  });
  await sleep(3000);

  // Hover schedule stats in top right
  await moveMouseSmooth(page, mouseX, mouseY, 1520, 320, 30);
  mouseX = 1520; mouseY = 320;
  await sleep(1800);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 2: ESTATE LEDGER & REACH
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 2: Estate Ledger & Reach Matrix');
  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '02 · DECLARED VS REACHABLE',
      'The Transitive Risk Horizon',
      'An application imports 12 direct libraries, but traverses downstream into 132 packages and 17 faults.'
    );
  });

  await smoothScroll(page, 460, 35);
  await sleep(600);

  // Hover over Notification Relay row
  await moveMouseSmooth(page, mouseX, mouseY, 720, 380, 25);
  mouseX = 720; mouseY = 380;
  await sleep(1500);

  // Hover over Admin Console
  await moveMouseSmooth(page, mouseX, mouseY, 720, 440, 20);
  mouseX = 720; mouseY = 440;
  await sleep(1500);

  // Hover over Storefront Web
  await moveMouseSmooth(page, mouseX, mouseY, 720, 620, 25);
  mouseX = 720; mouseY = 620;
  await sleep(1500);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 3: SHOW THE QUERIES (OPENCYPHER)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 3: openCypher Query Disclosure');
  await smoothScroll(page, 1380, 40);
  await sleep(600);

  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '03 · WHY A GRAPH DATABASE?',
      'Bidirectional BFS Shortest-Path',
      'openCypher executes shortestPath() with bidirectional search in milliseconds, replacing 40-line recursive CTEs.'
    );
  });

  // Click Show the queries button
  await moveMouseSmooth(page, mouseX, mouseY, 520, 840, 25);
  mouseX = 520; mouseY = 840;
  await performClick(page, mouseX, mouseY);
  await sleep(1000);

  await smoothScroll(page, 1800, 30);
  await sleep(3000);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 4: NEGATIVE PRINT THEME TOGGLE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 4: Reprographer Theme Toggle');
  await smoothScroll(page, 0, 40);
  await sleep(600);

  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '04 · THEME SYSTEM',
      'The Reprographer’s Negative Print',
      'White linework on Prussian blue, styled as a physical engineering cable record.'
    );
  });

  // Click theme toggle in top right
  await moveMouseSmooth(page, mouseX, mouseY, 1785, 25, 30);
  mouseX = 1785; mouseY = 25;
  await performClick(page, mouseX, mouseY);
  await sleep(2500);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 5: ROUTE TRACER (/trace)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 5: Route Finder & Multi-Hop Jumper');
  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '05 · ROUTE TRACER',
      'Multi-Hop Dependency Runs',
      'Pick any application and target package to trace the shortest path down the cable run.'
    );
  });

  await page.goto('http://localhost:3000/trace?app=inventory-sync&pkg=npm%3Aarchiver', { waitUntil: 'networkidle0' });
  await injectOverlayAndCursor(page);
  mouseX = 400; mouseY = 25;

  await sleep(1200);

  // Scroll down through the vertical jumper run
  await smoothScroll(page, 580, 35);
  await sleep(1800);

  // Hover over hops in the route
  await moveMouseSmooth(page, mouseX, mouseY, 450, 420, 20);
  mouseX = 450; mouseY = 420;
  await sleep(1000);
  await moveMouseSmooth(page, mouseX, mouseY, 450, 540, 20);
  mouseX = 450; mouseY = 540;
  await sleep(1000);
  await moveMouseSmooth(page, mouseX, mouseY, 450, 660, 20);
  mouseX = 450; mouseY = 660;
  await sleep(2000);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 6: FAULT REGISTER & CUT POINT (/advisories)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 6: Fault Register & Blast Radius Cut Points');
  await smoothScroll(page, 0, 30);
  await sleep(400);

  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '06 · BLAST RADIUS & CUT POINTS',
      'The One Change That Breaks The Chain',
      'Calculates which single package upgrade cuts the vulnerability across all exposed applications.'
    );
  });

  await page.goto('http://localhost:3000/advisories/USY-2026-0122', { waitUntil: 'networkidle0' });
  await injectOverlayAndCursor(page);
  mouseX = 480; mouseY = 25;

  await sleep(1200);

  // Show blast radius and Where to cut card
  await smoothScroll(page, 400, 30);
  await sleep(1800);

  // Hover over Where to cut recommendation
  await moveMouseSmooth(page, mouseX, mouseY, 620, 380, 25);
  mouseX = 620; mouseY = 380;
  await sleep(2500);

  // Scroll through dependency chains
  await smoothScroll(page, 850, 35);
  await sleep(2200);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 7: MAINTAINER CHOKEPOINTS (/maintainers)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 7: Maintainer Supply Chain Chokepoints');
  await smoothScroll(page, 0, 30);
  await sleep(400);

  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '07 · STRUCTURAL RISK',
      'Sole Maintainers Without 2FA',
      'Ranks sole maintainers by the percentage of downstream applications they reach.'
    );
  });

  await page.goto('http://localhost:3000/maintainers', { waitUntil: 'networkidle0' });
  await injectOverlayAndCursor(page);
  mouseX = 560; mouseY = 25;

  await sleep(1200);
  await smoothScroll(page, 320, 25);

  // Hover top maintainer
  await moveMouseSmooth(page, mouseX, mouseY, 620, 400, 25);
  mouseX = 620; mouseY = 400;
  await sleep(2500);

  // ─────────────────────────────────────────────────────────────────────────────
  // OUTRO CARD
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Outro Title Card');
  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      'UNDERSTORY · SUBMISSION',
      'Ebube Ezediimbu · @ISyncPlus',
      'Built for Wexa AI · Powered by CognoDB & Next.js 15'
    );
  });
  await sleep(3500);

  console.log('🎬 Finalizing MP4 Stream...');
  await client.send('Page.stopScreencast');
  ffmpeg.stdin.end();

  await new Promise((resolve) => ffmpeg.on('close', resolve));
  await browser.close();
  console.log(`✅ Demo walkthrough video created successfully at: ${OUTPUT_VIDEO}`);
}

main().catch(console.error);
