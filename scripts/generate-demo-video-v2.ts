import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const OUTPUT_VIDEO = '/Users/InhouseHQ/.gemini/antigravity-ide/brain/2292e2ba-23eb-4726-8bf3-926b078d5f48/understory_demo_walkthrough_v2.mp4';

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

    // 1. Virtual Animated Cursor with Glowing Reticle
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 18px;
      height: 18px;
      background: #e04c32;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6), 0 0 14px rgba(224, 76, 50, 0.95);
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
      border: 2.5px solid var(--color-jumper, #e04c32);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      transition: transform 0.5s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.5s ease-out;
      pointer-events: none;
      z-index: 999999;
    `;

    // 3. Floating Glassmorphic Annotation Card (Bottom Left with Progress Indicator)
    const banner = document.createElement('div');
    banner.id = 'demo-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 32px;
      left: 32px;
      width: 640px;
      background: color-mix(in oklch, var(--color-sheet, #162438) 95%, black);
      border: 1.5px solid var(--color-rule-strong, #3a567c);
      padding: 18px 24px;
      box-shadow: 0 24px 50px -12px rgba(0,0,0,0.75);
      opacity: 0;
      transform: translateY(24px);
      transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(14px);
    `;

    banner.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 6px;">
        <div id="demo-banner-tag" style="font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-jumper, #e04c32);">
          CHAPTER 01 / 08
        </div>
        <div id="demo-banner-badge" style="font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-ink-3, #7a94b4); border: 1px solid var(--color-rule, #2c4464); padding: 2px 8px;">
          COGNODB ARCHITECTURE
        </div>
      </div>
      <div id="demo-banner-title" style="font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink, #ffffff); line-height: 1.2; margin-bottom: 6px;">
        Dependency Reach Across An Estate
      </div>
      <div id="demo-banner-body" style="font-family: var(--font-sans), sans-serif; font-size: 13.5px; color: var(--color-ink-2, #b4c6db); line-height: 1.5;">
        Direct dependencies are just the entry point. Real vulnerability reach extends 6 hops deep into the graph.
      </div>
      <div style="margin-top: 12px; height: 2px; width: 100%; background: var(--color-rule, #2c4464); overflow: hidden; position: relative;">
        <div id="demo-banner-bar" style="position: absolute; top:0; left:0; height:100%; width: 100%; background: var(--color-jumper, #e04c32); transform-origin: left; transform: scaleX(0); transition: transform 5s linear;"></div>
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
      showBanner(tag: string, badge: string, title: string, body: string, durationMs: number = 5500) {
        const tagEl = document.getElementById('demo-banner-tag');
        const badgeEl = document.getElementById('demo-banner-badge');
        const titleEl = document.getElementById('demo-banner-title');
        const bodyEl = document.getElementById('demo-banner-body');
        const barEl = document.getElementById('demo-banner-bar');
        
        if (tagEl) tagEl.innerText = tag;
        if (badgeEl) badgeEl.innerText = badge;
        if (titleEl) titleEl.innerText = title;
        if (bodyEl) bodyEl.innerText = body;
        
        if (barEl) {
          barEl.style.transition = 'none';
          barEl.style.transform = 'scaleX(0)';
          requestAnimationFrame(() => {
            barEl.style.transition = `transform ${durationMs}ms linear`;
            barEl.style.transform = 'scaleX(1)';
          });
        }
        
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

async function moveMouseSmooth(page: any, startX: number, startY: number, targetX: number, targetY: number, steps = 35) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const curX = Math.round(startX + (targetX - startX) * ease);
    const curY = Math.round(startY + (targetY - startY) * ease);
    await page.evaluate(({ x, y }: { x: number; y: number }) => {
      if ((window as any).__demo) (window as any).__demo.setCursor(x, y);
    }, { x: curX, y: curY });
    await sleep(16);
  }
}

async function performClick(page: any, x: number, y: number) {
  await page.evaluate(({ x, y }: { x: number; y: number }) => {
    if ((window as any).__demo) {
      (window as any).__demo.setCursor(x, y);
      (window as any).__demo.clickEffect(x, y);
    }
  }, { x, y });
  await sleep(150);
  await page.mouse.click(x, y);
  await sleep(300);
}

async function smoothScroll(page: any, targetScrollY: number, steps = 45) {
  const currentScroll = await page.evaluate(() => window.scrollY);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const scrollVal = Math.round(currentScroll + (targetScrollY - currentScroll) * ease);
    await page.evaluate((y: number) => window.scrollTo(0, y), scrollVal);
    await sleep(20);
  }
}

async function main() {
  console.log('🚀 Launching Chromium for Walkthrough V2 (Extended & Unhurried)...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  console.log('🎥 Initializing FFmpeg 1080p MP4 Encoder (CRF 18)...');
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
  // SCENE 1: THE CORE THESIS & SCHEDULE (6.5s)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 1: Estate Overview & Quantities');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await injectOverlayAndCursor(page);
  await moveMouseSmooth(page, mouseX, mouseY, 450, 320, 25);
  mouseX = 450; mouseY = 320;

  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '01 · THE PROBLEM',
      'SUPPLY CHAIN TOPOLOGY',
      'The Transitive Risk Horizon',
      'Understory models 12 applications across 2,501 releases and 9,618 edges in CognoDB to answer path questions SQL cannot solve.',
      6500
    );
  });
  await sleep(3500);

  // Hover schedule stats in top right
  await moveMouseSmooth(page, mouseX, mouseY, 1500, 310, 30);
  mouseX = 1500; mouseY = 310;
  await sleep(3000);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 2: LIVE DIRECTORY LOOKUP (5.5s)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 2: Live Index Lookup');
  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '02 · GLOBAL INDEX',
      'MULTI-KIND SEARCH',
      'Instant Search Across Graph Entities',
      'Finds applications, packages, maintainers, and advisories instantly through parameterized graph lookup indices.',
      5500
    );
  });

  // Focus lookup input in masthead
  await moveMouseSmooth(page, mouseX, mouseY, 1420, 25, 25);
  mouseX = 1420; mouseY = 25;
  await performClick(page, mouseX, mouseY);
  await page.type('input[role="combobox"]', 'lodash', { delay: 100 });
  await sleep(3000);

  // Clear search
  await page.keyboard.press('Escape');
  await sleep(1500);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 3: ESTATE LEDGER & REACH MATRIX (7.0s)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 3: Estate Ledger & Reach Matrix');
  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '03 · REACH MATRIX',
      'GRAPH EXPANSION',
      'Declared Dependencies vs True Reach',
      'Notification Relay declares 12 direct libraries, but traverses downstream into 132 packages and 17 open security faults.',
      7000
    );
  });

  await smoothScroll(page, 460, 40);
  await sleep(800);

  // Hover over Notification Relay row
  await moveMouseSmooth(page, mouseX, mouseY, 720, 375, 25);
  mouseX = 720; mouseY = 375;
  await sleep(2000);

  // Hover over Admin Console row
  await moveMouseSmooth(page, mouseX, mouseY, 720, 435, 20);
  mouseX = 720; mouseY = 435;
  await sleep(2000);

  // Hover over Storefront Web row
  await moveMouseSmooth(page, mouseX, mouseY, 720, 615, 25);
  mouseX = 720; mouseY = 615;
  await sleep(2200);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 4: OPENCYPHER QUERY DISCLOSURE (7.0s)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 4: openCypher Query Disclosure');
  await smoothScroll(page, 1380, 45);
  await sleep(800);

  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '04 · THE GRAPH ENGINE',
      'OPENCYPHER / BOLT',
      'Bidirectional BFS Shortest-Path',
      'MATCH route = shortestPath((app)-[:DEPENDS_ON*1..8]->(vuln)) executes in milliseconds, replacing recursive SQL CTE table scans.',
      7000
    );
  });

  // Click Show the queries button
  await moveMouseSmooth(page, mouseX, mouseY, 520, 840, 25);
  mouseX = 520; mouseY = 840;
  await performClick(page, mouseX, mouseY);
  await sleep(1000);

  await smoothScroll(page, 1800, 35);
  await sleep(4500);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 5: REPROGRAPHER THEME TOGGLE (5.5s)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 5: Reprographer Theme Toggle');
  await smoothScroll(page, 0, 45);
  await sleep(800);

  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '05 · DESIGN SYSTEM',
      'INDUSTRIAL DRAFTING',
      'The Reprographer’s Negative Print',
      'White linework on Prussian blue, designed with telephone-exchange cable record aesthetics and strict WCAG AA contrast.',
      5500
    );
  });

  // Click theme toggle in top right
  await moveMouseSmooth(page, mouseX, mouseY, 1785, 25, 30);
  mouseX = 1785; mouseY = 25;
  await performClick(page, mouseX, mouseY);
  await sleep(4000);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 6: ROUTE FINDER & JUMPER RUN (7.5s)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 6: Route Finder & Multi-Hop Jumper');
  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '06 · ROUTE TRACER',
      'MULTI-HOP PATHS',
      'The Dependency Jumper Run',
      'Traces the exact 4-hop chain from Inventory Sync down through intermediate libraries to npm:archiver.',
      7500
    );
  });

  await page.goto('http://localhost:3000/trace?app=inventory-sync&pkg=npm%3Aarchiver', { waitUntil: 'networkidle0' });
  await injectOverlayAndCursor(page);
  mouseX = 400; mouseY = 25;

  await sleep(1500);

  // Scroll down through the vertical jumper run
  await smoothScroll(page, 580, 40);
  await sleep(1500);

  // Deliberately hover over each hop in the route
  await moveMouseSmooth(page, mouseX, mouseY, 450, 420, 20);
  mouseX = 450; mouseY = 420;
  await sleep(1500);

  await moveMouseSmooth(page, mouseX, mouseY, 450, 540, 20);
  mouseX = 450; mouseY = 540;
  await sleep(1500);

  await moveMouseSmooth(page, mouseX, mouseY, 450, 660, 20);
  mouseX = 450; mouseY = 660;
  await sleep(2500);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 7: BLAST RADIUS & CUT POINT ANALYSIS (8.0s)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 7: Fault Register & Blast Radius Cut Points');
  await smoothScroll(page, 0, 35);
  await sleep(600);

  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '07 · BLAST RADIUS',
      'REMEDIATION INTELLIGENCE',
      'The One Change That Cuts The Chain',
      'Calculates which single package upgrade (color-convert) cuts this critical vulnerability across all 9 exposed applications simultaneously.',
      8000
    );
  });

  await page.goto('http://localhost:3000/advisories/USY-2026-0122', { waitUntil: 'networkidle0' });
  await injectOverlayAndCursor(page);
  mouseX = 480; mouseY = 25;

  await sleep(1500);

  // Show blast radius and Where to cut card
  await smoothScroll(page, 400, 35);
  await sleep(2000);

  // Hover over Where to cut recommendation
  await moveMouseSmooth(page, mouseX, mouseY, 620, 380, 25);
  mouseX = 620; mouseY = 380;
  await sleep(3500);

  // Scroll through dependency chains
  await smoothScroll(page, 850, 40);
  await sleep(2500);

  // ─────────────────────────────────────────────────────────────────────────────
  // SCENE 8: MAINTAINER CHOKEPOINTS & SUPPLY CHAIN RISK (6.5s)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Scene 8: Maintainer Supply Chain Chokepoints');
  await smoothScroll(page, 0, 35);
  await sleep(600);

  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      '08 · SUPPLY CHAIN',
      'STRUCTURAL SECURITY',
      'Maintainer Chokepoints Without 2FA',
      'Surfaces sole maintainers with no second factor, ranked by their transitive reach into production applications.',
      6500
    );
  });

  await page.goto('http://localhost:3000/maintainers', { waitUntil: 'networkidle0' });
  await injectOverlayAndCursor(page);
  mouseX = 560; mouseY = 25;

  await sleep(1500);
  await smoothScroll(page, 320, 30);

  // Hover top maintainer
  await moveMouseSmooth(page, mouseX, mouseY, 620, 400, 25);
  mouseX = 620; mouseY = 400;
  await sleep(3500);

  // ─────────────────────────────────────────────────────────────────────────────
  // OUTRO CARD (5.0s)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('▶ Outro Title Card');
  await page.evaluate(() => {
    (window as any).__demo.showBanner(
      'UNDERSTORY · MERIDIAN SYSTEMS',
      'WEXA AI TAKE-HOME ASSIGNMENT',
      'Built by Ebube Ezediimbu · @ISyncPlus',
      'Data Layer: CognoDB (openCypher over Bolt) · Interface: Next.js 15 App Router',
      5000
    );
  });
  await sleep(5000);

  console.log('🎬 Finalizing MP4 Stream...');
  await client.send('Page.stopScreencast');
  ffmpeg.stdin.end();

  await new Promise((resolve) => ffmpeg.on('close', resolve));
  await browser.close();
  console.log(`✅ Demo walkthrough V2 created successfully at: ${OUTPUT_VIDEO}`);
}

main().catch(console.error);
