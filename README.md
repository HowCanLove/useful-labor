# 📚 useful-catalog-template

A reusable, zero-build static template for **multilingual curated-list sites** — fork it, swap the data, push, done. The first site built with this template is [useful-software](https://github.com/HowCanLove/useful-software) (100+ Windows / macOS apps with auto-updated downloads).

## 🎯 What you get out of the box

- 🌍 Multilingual UI (中文 / English / 日本語) with browser-language auto-detection and persisted choice
- 🎯 Two-axis filtering — primary axis (default: OS) + categories
- 🔍 Full-text search with match highlighting
- 🌙 Dark mode (system preference + manual toggle, persisted)
- 🖼️ Detail modal with optional images / videos / YouTube embeds
- ⭐ Favorites stored in localStorage
- 🔀 Sort by curated order / name A→Z / Z→A
- 🔗 Hash-based deep links (`/#item-slug` opens the modal directly — shareable URLs)
- 📥 Download buttons that prefer auto-fetched URLs over manual ones over a homepage fallback
- 🤖 `update-versions.mjs` script that walks GitHub-hosted entries and writes the latest release info to a sidecar JSON
- 🖼️ `render-og.mjs` to regenerate the social-share image from `scripts/og-template.html`
- 📊 SEO basics: OG / Twitter Card meta, JSON-LD WebSite schema, sitemap.xml + robots.txt
- 🚀 Pure static HTML/CSS/JS — no build step, deploys to GitHub Pages directly

## 🚀 Spin up a new site (under an hour)

```bash
# 1. Clone this template
git clone https://github.com/HowCanLove/useful-catalog-template my-vscode-list
cd my-vscode-list
rm -rf .git && git init   # start fresh history

# 2. Open the project — the rest is just editing config:

#    a. data.js          your catalog entries (start with the 5 placeholders)
#    b. i18n.js          UI strings — search "{{TODO}}" at the top to know what to swap
#    c. index.html       search "{{" — every placeholder needs a real value
#    d. scripts/og-template.html — same {{}} placeholders for the OG image

# 3. Generate the social-share image
node scripts/render-og.mjs

# 4. (If GitHub-hosted entries are in your data.js) auto-fill download URLs + versions
node scripts/update-versions.mjs

# 5. Push to a new GitHub repo + enable Pages
git add -A && git commit -m "Initial catalog"
gh repo create my-vscode-list --public --source=. --push
gh api -X POST repos/<you>/my-vscode-list/pages -f source[branch]=main -f source[path]=/

# 6. Verify Google Search Console + submit sitemap.xml (see SEO section)
```

## 🧩 What to edit, file by file

| File | What needs to change | When you can leave it alone |
|---|---|---|
| `data.js` | Always — your catalog entries | Never (that's the whole point) |
| `i18n.js` | `meta.*`, `site.title`, `site.tagline`, `os.*`, `category.*`, `search.placeholder`, `count.total`, `footer.text` | If your catalog *is* a Windows / macOS software list |
| `index.html` | Every `{{PLACEHOLDER}}` in `<head>`; the four `<button class="os-tab">` if your axis isn't OS | If your axis is OS-shaped |
| `scripts/og-template.html` | Every `{{PLACEHOLDER}}` | If you keep the example branding |
| `app.js` | The `cats` array inside `buildCategoryChips()` if your category keys differ from the defaults | If you reuse the default categories |
| `style.css` | The header gradient (lines ~67 and ~76) for a custom brand colour | If purple-blue works for you |
| `robots.txt`, `sitemap.xml` | Replace `{{YOUR_USERNAME}}` and `{{YOUR_REPO_NAME}}` | Never (URL is yours) |

## 🔌 Reusing the auto-update script for non-software catalogs

`scripts/update-versions.mjs` was built for GitHub-hosted projects but the same pattern fits anything with a public API. Quick wins:

| Catalog domain | API to swap in | What to fetch |
|---|---|---|
| **VS Code / Cursor extensions** | `marketplace.visualstudio.com/_apis/public/gallery/extensionquery` | Latest version + install URL |
| **npm packages** | `registry.npmjs.org/<pkg>` | `dist-tags.latest` + tarball URL |
| **Cargo crates** | `crates.io/api/v1/crates/<name>` | Latest stable version |
| **Homebrew formulae** | `formulae.brew.sh/api/formula/<name>.json` | Version + bottle URL |
| **AI prompts** | (no API — script becomes a markdown→JSON converter) | Lift prompts from `prompts/*.md` files |

The pattern: read `data.js`, walk entries, hit the API, write `versions.json`, frontend merges it in via `loadVersions()` in `app.js`. Around 100 lines.

## 🎨 Repurposing the primary axis (was OS)

The "OS tabs" top bar can become any 3-4-way axis. The fields you need to keep in sync:

1. `data.js` — change `os: 'windows' | 'macos' | 'cross'` to your values, e.g. `os: 'chrome' | 'firefox' | 'edge' | 'cross'`
2. `index.html` — update the four `<button class="os-tab" data-os="...">` to match
3. `i18n.js` — `os.all`, `os.windows`, `os.macos`, `os.cross` (and the `os.badge.*` short forms)
4. `app.js` — `osMatches()` and `detectOS()`. The "auto-detect device OS on first visit" logic only makes sense for an OS axis; gut it for axes that aren't OS-shaped.

The `cross` value is special — it shows up under all other tabs. Keep that semantic if you have a "works everywhere" option.

## 🌍 Adding / removing languages

Add (e.g. Korean):

1. `i18n.js` → `SUPPORTED_LANGS.push({ code: 'ko', name: '한국어', htmlLang: 'ko' })`
2. `i18n.js` → copy any existing locale block, translate every key
3. `data.js` → add `desc.ko: '...'` to every entry
4. `index.html` → add `<meta property="og:locale:alternate" content="ko_KR">`

Drop a language by removing it from those four places (and stripping the `desc.<lang>` keys to save bytes).

## 📊 SEO checklist after you ship

- [ ] [Google Search Console](https://search.google.com/search-console) → add property → verify via the HTML file method → submit `sitemap.xml`
- [ ] [Bing Webmaster Tools](https://www.bing.com/webmasters) → import from Search Console (one click) → submit sitemap
- [ ] [百度站长平台](https://ziyuan.baidu.com/) → if you target zh-CN traffic
- [ ] [opengraph.xyz](https://www.opengraph.xyz/) → preview your OG card across every social platform
- [ ] [Google Rich Results Test](https://search.google.com/test/rich-results) → verify the JSON-LD parses

## 📄 License

MIT. Spin up as many sites as you want, no attribution required (but a link back is appreciated 🙏).
