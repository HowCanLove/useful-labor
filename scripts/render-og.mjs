#!/usr/bin/env node
// 把 og-template.html 渲染成 1200x630 的 og-image.png（社交分享缩略图）。
// 依赖 Microsoft Edge（Windows 11 默认装好），用 --headless --screenshot 模式。
//
// Usage: node scripts/render-og.mjs

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(__dirname, 'og-template.html');
const OUTPUT   = resolve(__dirname, '..', 'og-image.png');

const candidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const browser = candidates.find(p => existsSync(p));
if (!browser) {
  console.error('❌ Could not find Edge or Chrome. Edit candidates[] in this script.');
  process.exit(1);
}

console.log(`🖼️  Rendering ${TEMPLATE}\n   via ${browser}`);
execFileSync(browser, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-size=1200,630',
  `--screenshot=${OUTPUT}`,
  `file://${TEMPLATE.replace(/\\/g, '/')}`,
], { stdio: ['ignore', 'inherit', 'pipe'] });

console.log(`✅ Wrote ${OUTPUT}`);
