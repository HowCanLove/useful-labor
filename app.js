// 主逻辑：渲染、过滤、搜索、暗色模式、多语言、详情弹窗
(function () {
  'use strict';

  const LANG_STORAGE_KEY = 'lang';
  const THEME_STORAGE_KEY = 'theme';
  const OS_STORAGE_KEY = 'os';
  const FAVORITES_STORAGE_KEY = 'favorites';
  const SORT_STORAGE_KEY = 'sort';

  const state = {
    lang: DEFAULT_LANG,
    os: 'all',
    category: 'all',
    query: '',
    modalItem: null,
    favorites: new Set(),
    favoritesOnly: false,
    sort: 'default',
  };

  const $grid = document.getElementById('softwareGrid');
  const $count = document.getElementById('resultCount');
  const $totalCount = document.getElementById('totalCount');
  const $empty = document.getElementById('emptyState');
  const $search = document.getElementById('searchInput');
  const $chips = document.getElementById('categoryChips');
  const $themeToggle = document.getElementById('themeToggle');
  const $langSwitch = document.getElementById('langSwitch');
  const $osTabs = document.querySelectorAll('.os-tab');

  // Modal elements
  const $modal = document.getElementById('modal');
  const $modalIcon = document.getElementById('modalIcon');
  const $modalName = document.getElementById('modalName');
  const $modalBadges = document.getElementById('modalBadges');
  const $modalDesc = document.getElementById('modalDesc');
  const $modalMedia = document.getElementById('modalMedia');
  const $modalMediaEmpty = document.getElementById('modalMediaEmpty');
  const $modalLink = document.getElementById('modalLink');
  const $modalDownload = document.getElementById('modalDownload');
  const $modalFav = document.getElementById('modalFav');
  const $favToggle = document.getElementById('favToggle');
  const $favToggleLabel = document.getElementById('favToggleLabel');
  const $sortSelect = document.getElementById('sortSelect');
  const $resultRow = document.querySelector('.result-row');

  // ---------- helpers ----------

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlight(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(escapedQuery, 'gi'), m => `<mark>${m}</mark>`);
  }

  function t(key, vars) {
    const dict = I18N[state.lang] || I18N[DEFAULT_LANG];
    let str = dict[key];
    if (str == null) str = (I18N[DEFAULT_LANG] || {})[key] || key;
    if (vars) {
      for (const k in vars) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      }
    }
    return str;
  }

  function descFor(item) {
    return (item.desc && (item.desc[state.lang] || item.desc[DEFAULT_LANG])) || '';
  }

  function faviconFor(url) {
    try {
      const host = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
    } catch (e) {
      return '';
    }
  }

  function hostnameFor(url) {
    try { return new URL(url).hostname; } catch (e) { return ''; }
  }

  // ---------- versions sidecar (populated by scripts/update-versions.mjs) ----------

  let VERSIONS = {};

  function loadVersions() {
    // Best-effort, async — re-renders when ready. 404 is normal before first script run.
    fetch('versions.json', { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json && typeof json === 'object') {
          VERSIONS = json;
          render();
          if (state.modalItem) openModal(state.modalItem);
        }
      })
      .catch(() => {});
  }

  function downloadInfoFor(item) {
    // Resolution order: scripted versions.json → manual data.js → fall back to homepage so the button always appears
    const v = VERSIONS[slugFor(item)] || {};
    const url = v.downloadUrl || item.downloadUrl || item.url || '';
    const version = v.version || item.version || '';
    // hasDirect 用来区分"直接下载"与"跳到官网让用户自己找"，影响 tooltip 与版本号是否展示
    const hasDirect = !!(v.downloadUrl || item.downloadUrl);
    return { url, version, hasDirect };
  }

  // ---------- slug map (for hash routing & favorites identity) ----------

  function slugify(s) {
    return String(s)
      .toLowerCase()
      .replace(/[^\w\s-]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  const slugToItem = new Map();
  const itemToSlug = new Map();
  CATALOG.forEach((item, i) => {
    let slug = slugify(item.name) || ('item-' + i);
    if (slugToItem.has(slug)) slug = slug + '-' + i;
    slugToItem.set(slug, item);
    itemToSlug.set(item, slug);
  });
  function slugFor(item) { return itemToSlug.get(item) || ''; }

  // ---------- favorites ----------

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) state.favorites = new Set(arr);
      }
    } catch (e) {}
  }

  function persistFavorites() {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(state.favorites)));
    } catch (e) {}
  }

  function isFavorite(item) {
    return state.favorites.has(slugFor(item));
  }

  function toggleFavorite(item) {
    const slug = slugFor(item);
    if (!slug) return;
    if (state.favorites.has(slug)) state.favorites.delete(slug);
    else state.favorites.add(slug);
    persistFavorites();
    updateFavToggleLabel();
    if (state.modalItem === item) updateModalFav();
    render();
  }

  function updateFavToggleLabel() {
    if (!$favToggleLabel) return;
    $favToggleLabel.textContent = t('favorites.toggle', { n: state.favorites.size });
    $favToggle.classList.toggle('active', state.favoritesOnly);
    $favToggle.setAttribute('aria-pressed', state.favoritesOnly ? 'true' : 'false');
  }

  function bindFavToggle() {
    $favToggle.addEventListener('click', () => {
      state.favoritesOnly = !state.favoritesOnly;
      updateFavToggleLabel();
      render();
    });
  }

  // ---------- sort ----------

  function loadSort() {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY);
      if (saved && ['default', 'name-asc', 'name-desc'].indexOf(saved) !== -1) {
        state.sort = saved;
      }
    } catch (e) {}
  }

  function persistSort() {
    try { localStorage.setItem(SORT_STORAGE_KEY, state.sort); } catch (e) {}
  }

  function bindSort() {
    $sortSelect.value = state.sort;
    $sortSelect.addEventListener('change', () => {
      state.sort = $sortSelect.value;
      persistSort();
      render();
    });
  }

  function applySort(list) {
    if (state.sort === 'name-asc') {
      return list.slice().sort((a, b) => a.name.localeCompare(b.name));
    }
    if (state.sort === 'name-desc') {
      return list.slice().sort((a, b) => b.name.localeCompare(a.name));
    }
    return list;
  }

  // ---------- hash routing ----------

  function setHashForItem(item) {
    const slug = slugFor(item);
    if (slug && location.hash !== '#' + slug) {
      history.replaceState(null, '', '#' + slug);
    }
  }

  function clearHash() {
    if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function openFromHash() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!hash) return;
    const item = slugToItem.get(hash);
    if (item) openModal(item);
  }

  function bindHashChange() {
    window.addEventListener('hashchange', () => {
      const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
      const item = hash && slugToItem.get(hash);
      if (item) {
        if (state.modalItem !== item) openModal(item);
      } else if (state.modalItem) {
        closeModal({ keepHash: true });
      }
    });
  }

  // ---------- OS detection ----------

  function detectOS() {
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    const ua = navigator.userAgent || '';
    if (/Mac/i.test(platform) || /Mac/i.test(ua) || /iPhone|iPad|iPod/i.test(ua)) return 'macos';
    if (/Win/i.test(platform) || /Windows/i.test(ua)) return 'windows';
    return 'all';
  }

  function detectInitialOs() {
    let saved;
    try { saved = localStorage.getItem(OS_STORAGE_KEY); } catch (e) {}
    const valid = ['all', 'windows', 'macos', 'cross'];
    if (saved && valid.indexOf(saved) !== -1) return saved;
    const detected = detectOS();
    return valid.indexOf(detected) !== -1 ? detected : 'all';
  }

  function persistOs() {
    try { localStorage.setItem(OS_STORAGE_KEY, state.os); } catch (e) {}
  }

  // ---------- language detection ----------

  function detectInitialLang() {
    let saved;
    try { saved = localStorage.getItem(LANG_STORAGE_KEY); } catch (e) {}
    if (saved && I18N[saved]) return saved;

    const supportedCodes = SUPPORTED_LANGS.map(l => l.code);
    const candidates = [].concat(navigator.languages || [], navigator.language || []);
    for (const raw of candidates) {
      if (!raw) continue;
      const lower = String(raw).toLowerCase();
      const exact = supportedCodes.find(c => lower === c || lower.startsWith(c + '-'));
      if (exact) return exact;
    }
    return DEFAULT_LANG;
  }

  function persistLang() {
    try { localStorage.setItem(LANG_STORAGE_KEY, state.lang); } catch (e) {}
  }

  function setLang(lang) {
    if (!I18N[lang]) return;
    state.lang = lang;
    persistLang();
    applyLangToDocument();
    buildLangSwitch();
    buildOsTabs();
    buildCategoryChips();
    applyStaticI18n();
    updateFavToggleLabel();
    render();
    if (state.modalItem) openModal(state.modalItem); // 重新渲染弹窗内容到新语言
  }

  function applyLangToDocument() {
    const langInfo = SUPPORTED_LANGS.find(l => l.code === state.lang) || SUPPORTED_LANGS[0];
    document.documentElement.setAttribute('lang', langInfo.htmlLang);
    document.title = t('meta.title');
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', t('meta.description'));
  }

  // ---------- UI builders ----------

  function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const pairs = el.dataset.i18nAttr.split(',');
      pairs.forEach(p => {
        const [attr, key] = p.split(':').map(s => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
  }

  function buildLangSwitch() {
    const buttons = SUPPORTED_LANGS.map(l => {
      const active = l.code === state.lang ? ' active' : '';
      return `<button class="lang-btn${active}" data-lang="${l.code}" title="${l.name}">${l.name}</button>`;
    }).join('');
    $langSwitch.innerHTML = buttons;
    $langSwitch.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
  }

  // 各 OS tab 真正会展示的条目数（与 matches() 的逻辑保持一致）
  const osCounts = (function () {
    let win = 0, mac = 0, cross = 0;
    CATALOG.forEach(s => {
      if (s.os === 'windows') win++;
      else if (s.os === 'macos') mac++;
      else if (s.os === 'cross') cross++;
    });
    return { all: CATALOG.length, windows: win + cross, macos: mac + cross, cross };
  })();

  function buildOsTabs() {
    const labels = {
      all:     t('os.all'),
      windows: t('os.windows'),
      macos:   t('os.macos'),
      cross:   t('os.cross'),
    };
    $osTabs.forEach(tab => {
      const key = tab.dataset.os;
      const label = labels[key] || key;
      const count = osCounts[key];
      tab.innerHTML = count != null
        ? `${escapeHtml(label)} <span class="os-tab-count">${count}</span>`
        : escapeHtml(label);
      tab.classList.toggle('active', key === state.os);
    });
  }

  function bindOsTabs() {
    $osTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        state.os = tab.dataset.os;
        persistOs();
        $osTabs.forEach(t => t.classList.toggle('active', t.dataset.os === state.os));
        // 切换 OS 后，分类计数和可见的分类都要随之刷新
        buildCategoryChips();
        render();
      });
    });
  }

  function buildCategoryChips() {
    // 计数随 OS tab 变化：选中 Windows 时只统计 win + cross 范围内的分类
    const visibleByOs = CATALOG.filter(s => osMatches(s, state.os));
    const counts = { all: visibleByOs.length };
    visibleByOs.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });

    // 当前选中的分类在新 OS 下数量为 0 时，自动回退到"全部"避免出现空结果
    if (state.category !== 'all' && !counts[state.category]) {
      state.category = 'all';
    }

    const cats = ['system','disk','files','productivity','dev','media','network','security','browser'];
    const chips = [
      `<button class="chip${state.category === 'all' ? ' active' : ''}" data-cat="all">${t('category.all')} <span class="chip-count">${counts.all}</span></button>`,
    ];
    cats.forEach(cat => {
      if (!counts[cat]) return;
      const active = state.category === cat ? ' active' : '';
      chips.push(`<button class="chip${active}" data-cat="${cat}">${t('category.' + cat)} <span class="chip-count">${counts[cat]}</span></button>`);
    });
    $chips.innerHTML = chips.join('');

    $chips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        state.category = chip.dataset.cat;
        $chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.cat === state.category));
        render();
      });
    });
  }

  function osMatches(item, os) {
    if (os === 'all') return true;
    if (os === 'cross') return item.os === 'cross';
    return item.os === os || item.os === 'cross';
  }

  function matches(item) {
    if (state.favoritesOnly && !isFavorite(item)) return false;
    if (!osMatches(item, state.os)) return false;
    if (state.category !== 'all' && item.category !== state.category) return false;
    if (state.query) {
      const q = state.query.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !descFor(item).toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function badgesHTML(item) {
    const osBadge = `<span class="badge badge-os">${t('os.badge.' + item.os) || item.os}</span>`;
    const priceClass = `badge-price-${item.price}`;
    const priceBadge = `<span class="badge ${priceClass}">${t('price.' + item.price) || item.price}</span>`;
    return osBadge + priceBadge;
  }

  function cardHTML(item, idx) {
    const hasMedia = Array.isArray(item.media) && item.media.length > 0;
    const mediaBadge = hasMedia
      ? `<span class="card-media-badge">📺 ${item.media.length}</span>`
      : '';
    const safeUrl = escapeHtml(item.url);
    const fav = isFavorite(item);
    const favIcon = fav ? '★' : '☆';
    const favLabel = t(fav ? 'favorites.aria.remove' : 'favorites.aria.add');
    const dl = downloadInfoFor(item);
    const dlTitle = t(dl.hasDirect ? 'card.downloadTitle' : 'card.downloadFallbackTitle');
    const downloadBtn = dl.url
      ? `<a class="card-link card-download${dl.hasDirect ? '' : ' card-download-fallback'}" href="${escapeHtml(dl.url)}" target="_blank" rel="noopener noreferrer" data-no-modal title="${escapeHtml(dlTitle)}">${t('card.download')}</a>`
      : '';
    return `
      <article class="card" data-idx="${idx}" tabindex="0" role="button" aria-label="${escapeHtml(item.name)}">
        <button class="card-fav${fav ? ' active' : ''}" data-no-modal data-fav-idx="${idx}" aria-pressed="${fav}" aria-label="${escapeHtml(favLabel)}" title="${escapeHtml(favLabel)}">${favIcon}</button>
        <div class="card-head">
          <h3 class="card-name">${highlight(item.name, state.query)}</h3>
          <div class="card-badges">${badgesHTML(item)}</div>
        </div>
        <p class="card-desc">${highlight(descFor(item), state.query)}</p>
        <div class="card-actions">
          <a class="card-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" data-no-modal>${t('card.visit')}</a>
          ${downloadBtn}
          ${mediaBadge}
        </div>
      </article>
    `;
  }

  function render() {
    const filtered = applySort(CATALOG.filter(matches));
    if (filtered.length === 0) {
      $grid.innerHTML = '';
      $empty.hidden = false;
      const emptyKey = state.favoritesOnly && state.favorites.size === 0
        ? 'empty.favorites' : 'empty.title';
      $empty.textContent = t(emptyKey);
    } else {
      $empty.hidden = true;
      // 渲染时把过滤后数组的索引映射回原 CATALOG 索引，便于点击查找
      $grid.innerHTML = filtered.map(item => {
        const realIdx = CATALOG.indexOf(item);
        return cardHTML(item, realIdx);
      }).join('');
    }
    const filteredFlag = (state.favoritesOnly || state.os !== 'all' || state.category !== 'all' || state.query)
      ? ' ' + t('count.filtered') : '';
    $count.textContent = t('count.total', { n: filtered.length }) + filteredFlag;

    const footer = document.getElementById('footerText');
    if (footer) {
      const linkHTML = `<a href="https://github.com/HowCanLove/useful-software/edit/main/data.js" target="_blank" rel="noopener">${t('footer.linkText')}</a>`;
      footer.innerHTML = t('footer.text', { link: linkHTML, n: CATALOG.length });
    }

    bindCardClicks();
  }

  function bindCardClicks() {
    $grid.querySelectorAll('.card').forEach(card => {
      const open = () => {
        const idx = parseInt(card.dataset.idx, 10);
        const item = CATALOG[idx];
        if (item) openModal(item);
      };
      card.addEventListener('click', e => {
        // 点击卡片上的"访问官网"按钮和星标时不开弹窗
        if (e.target.closest('[data-no-modal]')) return;
        open();
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
    $grid.querySelectorAll('.card-fav').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.favIdx, 10);
        const item = CATALOG[idx];
        if (item) toggleFavorite(item);
      });
    });
  }

  // ---------- modal ----------

  function mediaItemHTML(m) {
    const captionHTML = m.caption
      ? `<div class="modal-media-caption">${escapeHtml(m.caption)}</div>`
      : '';
    if (m.type === 'image') {
      return `<div class="modal-media-item"><img src="${escapeHtml(m.src)}" loading="lazy" alt="${escapeHtml(m.caption || '')}" referrerpolicy="no-referrer">${captionHTML}</div>`;
    }
    if (m.type === 'video') {
      return `<div class="modal-media-item"><video controls preload="metadata" src="${escapeHtml(m.src)}"></video>${captionHTML}</div>`;
    }
    if (m.type === 'youtube') {
      return `<div class="modal-media-item"><div class="modal-media-iframe-wrap"><iframe src="${escapeHtml(m.src)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>${captionHTML}</div>`;
    }
    return '';
  }

  function openModal(item) {
    state.modalItem = item;
    $modalIcon.src = faviconFor(item.url);
    $modalIcon.alt = item.name;
    $modalName.textContent = item.name;
    $modalBadges.innerHTML = badgesHTML(item);
    $modalDesc.innerHTML = '<p>' + escapeHtml(descFor(item)).replace(/\n\s*\n/g, '</p><p>') + '</p>';

    if (Array.isArray(item.media) && item.media.length) {
      $modalMedia.innerHTML = item.media.map(mediaItemHTML).join('');
      $modalMedia.hidden = false;
      $modalMediaEmpty.hidden = true;
    } else {
      $modalMedia.innerHTML = '';
      $modalMedia.hidden = true;
      const editUrl = 'https://github.com/HowCanLove/useful-software/edit/main/data.js';
      const noMediaText = state.lang === 'zh'
        ? `🖼️ 暂无截图或视频。可以 <a href="${editUrl}" target="_blank" rel="noopener">编辑 data.js</a> 给这条加 <code>media</code> 字段。`
        : state.lang === 'ja'
          ? `🖼️ スクリーンショット・動画は未登録。<a href="${editUrl}" target="_blank" rel="noopener">data.js</a> を編集して <code>media</code> フィールドを追加できます。`
          : `🖼️ No screenshots or videos yet. <a href="${editUrl}" target="_blank" rel="noopener">Edit data.js</a> to add a <code>media</code> field for this entry.`;
      $modalMediaEmpty.innerHTML = noMediaText;
      $modalMediaEmpty.hidden = false;
    }

    $modalLink.href = item.url;
    $modalLink.textContent = `${t('card.visit')}  ·  ${hostnameFor(item.url)}`;

    const dl = downloadInfoFor(item);
    if (dl.url) {
      $modalDownload.href = dl.url;
      const versionTag = dl.hasDirect && dl.version ? `  ·  ${t('card.version', { v: dl.version })}` : '';
      $modalDownload.textContent = `${t('card.download')}${versionTag}`;
      $modalDownload.title = t(dl.hasDirect ? 'card.downloadTitle' : 'card.downloadFallbackTitle');
      $modalDownload.classList.toggle('modal-download-fallback', !dl.hasDirect);
      $modalDownload.hidden = false;
    } else {
      $modalDownload.hidden = true;
    }

    updateModalFav();

    $modal.hidden = false;
    document.body.classList.add('modal-open');
    setHashForItem(item);
    setTimeout(() => $modal.querySelector('.modal-close').focus(), 50);
  }

  function updateModalFav() {
    if (!state.modalItem || !$modalFav) return;
    const fav = isFavorite(state.modalItem);
    $modalFav.textContent = fav ? '★' : '☆';
    $modalFav.classList.toggle('active', fav);
    $modalFav.setAttribute('aria-pressed', fav ? 'true' : 'false');
    $modalFav.setAttribute('aria-label', t(fav ? 'favorites.aria.remove' : 'favorites.aria.add'));
    $modalFav.setAttribute('title', t(fav ? 'favorites.aria.remove' : 'favorites.aria.add'));
  }

  function closeModal(opts) {
    state.modalItem = null;
    $modal.hidden = true;
    document.body.classList.remove('modal-open');
    // 停止 iframe/video 的播放
    $modalMedia.querySelectorAll('iframe').forEach(f => { f.src = f.src; });
    $modalMedia.querySelectorAll('video').forEach(v => v.pause());
    if (!(opts && opts.keepHash)) clearHash();
  }

  function bindModalEvents() {
    $modal.addEventListener('click', e => {
      if (e.target.closest('[data-close-modal]')) closeModal();
    });
    $modalFav.addEventListener('click', () => {
      if (state.modalItem) toggleFavorite(state.modalItem);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$modal.hidden) closeModal();
    });
  }

  // ---------- search ----------

  function bindSearch() {
    let timer;
    $search.addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.query = e.target.value.trim();
        render();
      }, 80);
    });
  }

  // ---------- theme ----------

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (e) {}
  }

  function initTheme() {
    let saved;
    try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (e) {}
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));

    $themeToggle.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // ---------- init ----------

  state.lang = detectInitialLang();
  state.os = detectInitialOs();
  loadFavorites();
  loadSort();
  loadVersions();
  $totalCount.textContent = CATALOG.length;
  applyLangToDocument();
  buildLangSwitch();
  buildOsTabs();
  bindOsTabs();
  buildCategoryChips();
  applyStaticI18n();
  bindSearch();
  initTheme();
  bindModalEvents();
  bindFavToggle();
  bindSort();
  bindHashChange();
  updateFavToggleLabel();
  $search.setAttribute('placeholder', t('search.placeholder'));
  render();
  openFromHash();
})();
