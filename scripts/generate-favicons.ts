import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const APP_DIR = path.join(ROOT, 'src/app');

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 1. Standalone Adaptive SVG Favicon
const svgAdaptive = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <style>
    :root {
      --bg: #f4f2ea;
      --border: #d5d2c7;
      --ink: #17212d;
      --jumper: #c83b1e;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #15243c;
        --border: #253956;
        --ink: #edf2f7;
        --jumper: #ff5e3a;
      }
    }
  </style>
  <rect width="32" height="32" rx="7" fill="var(--bg)"/>
  <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" fill="none" stroke="var(--border)" stroke-width="1"/>
  
  <!-- Orthogonal jumper run -->
  <path d="M 7 9 v 6 h 9 v 7 h 9" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
  
  <!-- Terminal block 1: solid ink application node -->
  <rect x="4" y="6" width="6" height="6" fill="var(--ink)"/>
  
  <!-- Terminal block 2: hollow intermediate distribution block -->
  <rect x="13" y="12" width="6" height="6" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>
  
  <!-- Terminal block 3: jumper vermilion fault node -->
  <rect x="22" y="19" width="6" height="6" fill="var(--jumper)"/>
</svg>
`;

// Save SVG to public and app
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), svgAdaptive.trim());
fs.writeFileSync(path.join(APP_DIR, 'icon.svg'), svgAdaptive.trim());

// Light and Dark standalone SVGs for raster rendering
function getSvgForRender(theme: 'light' | 'dark', size: number = 32) {
  const bg = theme === 'light' ? '#f4f2ea' : '#15243c';
  const border = theme === 'light' ? '#d5d2c7' : '#253956';
  const ink = theme === 'light' ? '#17212d' : '#edf2f7';
  const jumper = theme === 'light' ? '#c83b1e' : '#ff5e3a';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 0;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
    <rect width="32" height="32" rx="7" fill="${bg}"/>
    <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" fill="none" stroke="${border}" stroke-width="1"/>
    <path d="M 7 9 v 6 h 9 v 7 h 9" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
    <rect x="4" y="6" width="6" height="6" fill="${ink}"/>
    <rect x="13" y="12" width="6" height="6" fill="${bg}" stroke="${ink}" stroke-width="2"/>
    <rect x="22" y="19" width="6" height="6" fill="${jumper}"/>
  </svg>
</body>
</html>`;
}

function createIco(pngBuffers: { size: number; buffer: Buffer }[]): Buffer {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(count, 4); // Number of images

  const entries: Buffer[] = [];
  const datas: Buffer[] = [];

  for (const item of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    const width = item.size >= 256 ? 0 : item.size;
    const height = item.size >= 256 ? 0 : item.size;

    entry.writeUInt8(width, 0);
    entry.writeUInt8(height, 1);
    entry.writeUInt8(0, 2); // Colors in palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8); // Image data size
    entry.writeUInt32LE(offset, 12); // Offset of image data

    entries.push(entry);
    datas.push(item.buffer);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...datas]);
}

async function main() {
  console.log('Launching headless browser to render pixel-perfect icons...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  async function renderPng(html: string, size: number): Promise<Buffer> {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    const buffer = await page.screenshot({ omitBackground: true, type: 'png' });
    return Buffer.from(buffer);
  }

  // Generate raster icons
  const p16 = await renderPng(getSvgForRender('light', 16), 16);
  const p32 = await renderPng(getSvgForRender('light', 32), 32);
  const p48 = await renderPng(getSvgForRender('light', 48), 48);
  const p180 = await renderPng(getSvgForRender('light', 180), 180);
  const p192 = await renderPng(getSvgForRender('light', 192), 192);
  const p512 = await renderPng(getSvgForRender('light', 512), 512);

  // Write PNG files
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-16x16.png'), p16);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-32x32.png'), p32);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), p180);
  fs.writeFileSync(path.join(APP_DIR, 'apple-icon.png'), p180);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-192.png'), p192);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-512.png'), p512);

  // Create multi-size ICO
  const icoBuffer = createIco([
    { size: 16, buffer: p16 },
    { size: 32, buffer: p32 },
    { size: 48, buffer: p48 },
  ]);

  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(APP_DIR, 'favicon.ico'), icoBuffer);

  await browser.close();
  console.log('Successfully generated and uploaded all favicon & icon assets!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
