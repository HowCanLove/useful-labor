#!/usr/bin/env node
// 从 data.js 收集 GitHub 项目，调用 GitHub API 拉最新 release，
// 写入 ../versions.json。前端会自动加载并显示下载按钮和版本号。
//
// Usage:
//   node scripts/update-versions.mjs
//   node scripts/update-versions.mjs --dry-run    # 只打印不写文件
//
// Auth (optional, raises 60/h → 5000/h):
//   - 如果安装了 gh CLI 并已登录，会自动使用其 token
//   - 或显式设置 GITHUB_TOKEN 环境变量

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_JS       = resolve(__dirname, '..', 'data.js');
const VERSIONS_JSON = resolve(__dirname, '..', 'versions.json');
const dryRun = process.argv.includes('--dry-run');

function loadSoftware() {
  const code = readFileSync(DATA_JS, 'utf8');
  const result = new Function(code + '\nreturn { CATALOG };')();
  return result.CATALOG;
}

function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const candidates = [
    'gh auth token',
    `"${process.env.PROGRAMFILES || 'C:\\Program Files'}\\GitHub CLI\\gh.exe" auth token`,
  ];
  for (const c of candidates) {
    try {
      const t = execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], shell: true }).trim();
      if (t) return t;
    } catch {}
  }
  return null;
}

function parseRepo(item) {
  if (item.repo && /^[\w.-]+\/[\w.-]+$/.test(item.repo)) return item.repo;
  if (typeof item.url !== 'string') return null;
  const m = item.url.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:[/#?]|$)/);
  if (!m) return null;
  return `${m[1]}/${m[2].replace(/\.git$/, '')}`;
}

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function pickAsset(assets, os) {
  if (!assets || !assets.length) return null;
  const matchers = {
    windows: [/\.exe$/i, /\.msi$/i, /\.zip$/i],
    macos:   [/\.dmg$/i, /\.pkg$/i, /arm64.*\.zip$/i, /\.zip$/i],
  };
  const regexes = matchers[os];
  if (!regexes) return null;
  // 跳过校验/源码包
  const SKIP = /\.(sig|sha256|asc|sbom|json|yml|yaml)$|^Source code/i;
  for (const re of regexes) {
    const matches = assets.filter(a => re.test(a.name) && !SKIP.test(a.name));
    if (!matches.length) continue;
    // x64 / amd64 优先；其次任意
    return matches.find(a => /(x64|amd64|win64|x86_64)/i.test(a.name)) || matches[0];
  }
  return null;
}

async function fetchLatest(repo, token) {
  const headers = {
    'User-Agent': 'useful-software-updater',
    'Accept': 'application/vnd.github+json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
  if (res.status === 404) {
    // 退回到完整 releases 列表（适用于只发 pre-release 的项目）
    res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=1`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.json();
    if (!arr.length) throw new Error('no releases');
    return arr[0];
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${body ? ' · ' + body.slice(0, 80) : ''}`);
  }
  return res.json();
}

async function main() {
  const items = loadSoftware();
  const token = getToken();
  console.log(token ? '🔑 Auth: GitHub token (5000 req/h)' : '⚠️  Auth: anonymous (60 req/h)');

  const ghItems = items
    .map(item => ({ item, repo: parseRepo(item) }))
    .filter(x => x.repo);

  console.log(`📦 Found ${ghItems.length} GitHub-backed entries / ${items.length} total\n`);

  const out = {};
  let ok = 0, failed = 0;
  for (const { item, repo } of ghItems) {
    const slug = slugify(item.name);
    const label = `  ${item.name.padEnd(28)} (${repo})`;
    try {
      const release = await fetchLatest(repo, token);
      const tag = release.tag_name || release.name || '';
      const asset = pickAsset(release.assets, item.os);
      out[slug] = {
        version: tag.replace(/^v/, ''),
        downloadUrl: asset ? asset.browser_download_url : release.html_url,
        assetName: asset ? asset.name : null,
        sourceRepo: repo,
        checkedAt: new Date().toISOString(),
      };
      console.log(`${label} ✓ ${tag}${asset ? ` → ${asset.name}` : ' (release page)'}`);
      ok++;
    } catch (e) {
      console.log(`${label} ✗ ${e.message}`);
      failed++;
    }
  }

  console.log(`\n📊 ${ok} updated · ${failed} failed · ${items.length - ghItems.length} non-github skipped`);

  if (dryRun) {
    console.log('🚫 --dry-run: not writing versions.json');
    return;
  }
  writeFileSync(VERSIONS_JSON, JSON.stringify(out, null, 2) + '\n');
  console.log(`✅ Wrote versions.json (${Object.keys(out).length} entries)`);
}

main().catch(e => { console.error(e); process.exit(1); });
