#!/usr/bin/env node
// 把 sitemap.xml 里的 <lastmod> 刷到今天。
// Usage: node scripts/refresh-sitemap.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITEMAP = resolve(__dirname, '..', 'sitemap.xml');

const today = new Date().toISOString().slice(0, 10);
const before = readFileSync(SITEMAP, 'utf8');
const after  = before.replace(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g, `<lastmod>${today}</lastmod>`);

if (before === after) {
  console.log(`✅ sitemap already at ${today}`);
} else {
  writeFileSync(SITEMAP, after);
  console.log(`✅ sitemap lastmod → ${today}`);
}
