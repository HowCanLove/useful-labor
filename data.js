// Catalog data. Append objects to this array; the frontend renders them.
//
// Required fields:
//   name      — display name (string)
//   desc      — { zh, en, ja } 2–3 sentence intros per language
//   url       — official site / homepage
//   os        — primary axis. Default values: 'windows' | 'macos' | 'cross'.
//               Repurpose for your catalog: e.g. 'chrome' | 'firefox' | 'cross'
//               for browser extensions. Update i18n.js (`os.*`, `os.badge.*`)
//               and the four `<button class="os-tab" data-os="...">` in
//               index.html so labels match.
//   category  — taxonomy slot. Default values match a software list. Edit
//               app.js's `cats` array and i18n keys (`category.*`) to fit
//               your domain (e.g. for AI prompts: writing | coding | seo).
//   price     — 'free' | 'oss' | 'freemium' | 'paid'. Drop the price badge
//               by removing this field and stripping `priceBadge` from
//               app.js if your catalog isn't priced.
//
// Optional fields:
//   media        — [{ type: 'image' | 'video' | 'youtube', src, caption? }]
//                  for the detail modal gallery
//   downloadUrl  — direct download / installer URL. Renders a "📥 Download"
//                  button. If omitted, the button falls back to `url`.
//   repo         — 'owner/name' on GitHub. Lets scripts/update-versions.mjs
//                  auto-populate downloadUrl + version into versions.json
//                  on each run. Skip if the project isn't on GitHub.
//   version      — manual override (the script normally fills this)

const CATALOG = [
  {
    name: 'Example One',
    desc: {
      zh: '这是一条示例条目。把这段中文换成对应工具的 2–3 句介绍：先说它做什么，再说为什么值得装。',
      en: 'This is a placeholder. Replace with a 2–3 sentence pitch: what it does first, then why it is worth using.',
      ja: 'これはプレースホルダーです。2〜3文で「何ができるか」「なぜ使う価値があるか」を順に書いてください。',
    },
    url: 'https://example.com/',
    os: 'windows',
    category: 'system',
    price: 'free',
  },
  {
    name: 'Example Two (with GitHub repo)',
    desc: {
      zh: '把 repo 字段填成 owner/name，每次跑 update-versions.mjs 都会自动抓最新 release，给这条加直链下载和版本号。',
      en: 'Set the repo field to owner/name. Running update-versions.mjs auto-populates the download URL and version from the latest GitHub release.',
      ja: 'repoフィールドにowner/nameを設定すると、update-versions.mjsが最新リリースを自動取得します。',
    },
    url: 'https://github.com/microsoft/PowerToys',
    repo: 'microsoft/PowerToys',
    os: 'windows',
    category: 'system',
    price: 'oss',
  },
  {
    name: 'Example Three (with media)',
    desc: {
      zh: 'media 字段可以放截图或视频；YouTube 用 embed 链接，搜索结果嵌入也支持。点开详情卡就能看到。',
      en: 'The media field accepts images, MP4 video URLs, or YouTube embed links (including search-list embeds). Visible in the detail modal.',
      ja: 'mediaフィールドには画像、MP4動画URL、YouTube埋め込みリンクを設定できます。詳細モーダルに表示されます。',
    },
    url: 'https://example.com/three',
    os: 'macos',
    category: 'productivity',
    price: 'freemium',
    media: [
      { type: 'image', src: 'https://via.placeholder.com/1200x600.png?text=Screenshot', caption: 'Main UI' },
    ],
  },
  {
    name: 'Example Four (cross-platform)',
    desc: {
      zh: 'os 设为 cross 的条目同时出现在 Windows 和 macOS tab 下，避免任何一边的用户漏看。',
      en: 'Entries with os: cross show up under both Windows and macOS tabs, so neither audience misses them.',
      ja: 'os: crossのエントリはWindowsとmacOSの両方のタブに表示されます。',
    },
    url: 'https://example.com/four',
    os: 'cross',
    category: 'dev',
    price: 'oss',
  },
  {
    name: 'Example Five (with manual download URL)',
    desc: {
      zh: '非 GitHub 项目可以手填 downloadUrl，让卡片显示蓝色直链按钮。',
      en: 'Non-GitHub projects can set downloadUrl manually to render the solid blue Download button.',
      ja: 'GitHub以外のプロジェクトはdownloadUrlを手動設定すると、青いダウンロードボタンが表示されます。',
    },
    url: 'https://example.com/five',
    downloadUrl: 'https://example.com/five/download',
    os: 'cross',
    category: 'media',
    price: 'paid',
  },
];
