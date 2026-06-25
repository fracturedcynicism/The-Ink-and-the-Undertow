/* ═══════════════════════════════════════════════
   FC READER — APP.JS
   Generic two-panel reader. Configure via data/series.json.
   Supports single-book and multi-book series.
   ═══════════════════════════════════════════════ */

'use strict';

const State = {
  books: [],
  series: {},
  currentBookIndex: -1,
  currentChapters: [],
  fontSizeClass: 'font-md',
  scrollPositions: {},
};

const DOM = {};

// ── INIT ──────────────────────────────────────────
async function init() {
  cacheDOMRefs();
  setupFontControls();
  setupMobileControls();
  setupNavButtons();
  setupScrollTracking();
  document.body.classList.add('font-md');

  try {
    const data = await fetchJSON('data/series.json');
    State.series = data.series;
    State.books  = data.books;

    applySeriesBranding();
    renderBookNav();
    buildWelcomeScreen();
    showWelcome();
  } catch (e) {
    console.error('Reader init failed:', e);
    showError('Initialisation failed. Ensure the server is running and series.json is present.');
  }
}

function cacheDOMRefs() {
  const ids = [
    'app','sidebar','reader-panel',
    'book-nav-list','chapter-nav-wrap','chapter-nav-list','progress-fill',
    'loading-state','welcome-screen','book-content',
    'book-header','reading-content','book-text',
    'topbar-location','reading-stat-current','reading-stat-total',
    'mobile-nav-drawer','drawer-overlay','mobile-nav-btn',
    'mobile-book-nav-list','mobile-chapter-nav-list',
    'sidebar-badge','sidebar-series-title','sidebar-series-sub',
    'mobile-badge','mobile-series-header','mobile-series-sub','mobile-series-title',
    'welcome-eyebrow','welcome-title','welcome-tagline',
    'welcome-synopsis','welcome-series-grid','welcome-begin-btn',
    'footer-tagline','prev-btn','next-btn','prev-book-btn','next-book-btn',
    'font-decrease','font-increase',
  ];
  ids.forEach(id => {
    const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    DOM[key] = document.getElementById(id);
  });
}

// ── BRANDING FROM series.json ──────────────────────
function applySeriesBranding() {
  const s = State.series;
  const badge    = s.badge    || '';
  const title    = s.title    || 'Untitled Series';
  const sub      = s.subtitle || '';
  const tagline  = s.tagline  || '';
  const synopsis = s.synopsis || '';

  document.title = title;
  if (document.querySelector('meta[name="description"]'))
    document.querySelector('meta[name="description"]').content = synopsis || title;

  // Sidebar
  setText('sidebarBadge', badge);
  setText('sidebarSeriesTitle', title);
  setText('sidebarSeriesSub', sub);

  // Mobile
  setText('mobileSeriesTitle', title);
  setText('mobileBadge', badge);
  setText('mobileSeriesHeader', title);
  setText('mobileSeriesSub', sub);

  // Topbar default
  setText('topbarLocation', title);

  // Welcome screen
  setText('welcomeEyebrow', badge);
  setText('welcomeTitle', title);
  setText('welcomeTagline', tagline);
  setText('welcomeSynopsis', synopsis);

  // Footer tagline
  setText('footerTagline', tagline);

  // Accent color override from series.json (optional)
  if (s.accentColor) {
    document.documentElement.style.setProperty('--accent', s.accentColor);
  }
  if (s.accentDim) {
    document.documentElement.style.setProperty('--accent-dim', s.accentDim);
  }
}

function setText(domKey, value) {
  if (DOM[domKey]) DOM[domKey].textContent = value;
}

// ── WELCOME SCREEN ────────────────────────────────
function buildWelcomeScreen() {
  const grid = DOM.welcomeSeriesGrid;
  if (!grid) return;

  if (State.books.length === 1) {
    // Single book — skip grid, just show begin button
    grid.style.display = 'none';
    if (DOM.welcomeBeginBtn) {
      DOM.welcomeBeginBtn.textContent = `BEGIN READING — ${State.books[0].title.toUpperCase()}`;
      DOM.welcomeBeginBtn.onclick = () => loadBook(0);
    }
    return;
  }

  // Multi-book series
  grid.innerHTML = State.books.map((book, i) => `
    <div class="welcome-book-row" onclick="loadBook(${i})">
      <div class="wb-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="wb-title">${escapeHtml(book.title)}</div>
      ${book.subtitle ? `<div class="wb-sub">${escapeHtml(book.subtitle)}</div>` : ''}
      <div class="wb-arrow">→</div>
    </div>
  `).join('');

  if (DOM.welcomeBeginBtn) {
    DOM.welcomeBeginBtn.textContent = 'BEGIN READING — BOOK ONE';
    DOM.welcomeBeginBtn.onclick = () => loadBook(0);
  }
}

// ── BOOK NAVIGATION RENDER ────────────────────────
function renderBookNav() {
  const html = State.books.map((book, i) => `
    <div class="book-nav-item" data-book-index="${i}" onclick="loadBook(${i})">
      <div class="book-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="book-nav-content">
        <div class="book-nav-title">${escapeHtml(book.title)}</div>
        ${book.subtitle ? `<div class="book-nav-sub">${escapeHtml(book.subtitle)}</div>` : ''}
      </div>
    </div>
  `).join('');

  if (DOM.bookNavList) DOM.bookNavList.innerHTML = html;
  if (DOM.mobileBookNavList) DOM.mobileBookNavList.innerHTML = html;

  // Re-attach onclick for mobile clone
  DOM.mobileBookNavList && DOM.mobileBookNavList.querySelectorAll('.book-nav-item').forEach(el => {
    const idx = parseInt(el.dataset.bookIndex);
    el.onclick = () => loadBook(idx);
  });
}

function updateBookNavActive(index) {
  document.querySelectorAll('.book-nav-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
}

// ── LOAD BOOK ─────────────────────────────────────
async function loadBook(index) {
  if (index < 0 || index >= State.books.length) return;
  if (index === State.currentBookIndex) return;

  if (State.currentBookIndex >= 0 && DOM.readerPanel) {
    State.scrollPositions[State.currentBookIndex] = DOM.readerPanel.scrollTop;
  }

  const book = State.books[index];
  State.currentBookIndex = index;

  updateBookNavActive(index);
  closeMobileDrawers();
  showLoading();

  try {
    const rawText = await fetchText(book.file);
    State.currentChapters = [];

    renderBookContent(book, rawText, index);
    renderChapterNav(State.currentChapters);
    syncMobileChapterNav();
    updateTopbarLocation(book);
    updateNavButtons();

    const savedPos = State.scrollPositions[index] || 0;
    if (DOM.readerPanel) DOM.readerPanel.scrollTop = savedPos;

    showBookContent();
    if (DOM.readerPanel) {
      DOM.readerPanel.classList.add('book-transition');
      setTimeout(() => DOM.readerPanel.classList.remove('book-transition'), 500);
    }
  } catch (e) {
    console.error('Failed to load book:', e);
    showError(`Failed to load "${book.title}". Check that the file exists in the books/ folder.`);
  }
}

// ── TEXT RENDERING ────────────────────────────────
function renderBookContent(book, rawText, index) {
  const total = State.books.length;

  if (DOM.bookHeader) {
    DOM.bookHeader.innerHTML = `
      <div class="book-header-inner">
        ${total > 1 ? `<div class="book-number-label">Book ${index + 1} of ${total} — ${escapeHtml(State.series.title || '')}</div>` : ''}
        <div class="book-main-title">${escapeHtml(book.title)}</div>
        ${book.subtitle ? `<div class="book-subtitle-line">${escapeHtml(book.subtitle)}</div>` : ''}
        ${book.setting ? `<div class="book-meta-row"><div class="book-meta-item"><strong>Setting</strong> ${escapeHtml(book.setting)}</div></div>` : ''}
      </div>
    `;
  }

  const html = processBookText(rawText);
  if (DOM.bookText) DOM.bookText.innerHTML = html;

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  const ert = Math.ceil(wordCount / 230);
  if (DOM.readingStatTotal) DOM.readingStatTotal.textContent = `~${ert} min`;
}

// ── TEXT PROCESSING ───────────────────────────────

// Detects .txt files exported from Word/Google Docs with no blank
// lines between paragraphs — every line-break is a paragraph break,
// not a wrapped continuation, producing a single wall of text if
// treated normally. Only triggers when blank lines are nearly absent
// across a long-enough file, so normally-formatted files (with real
// blank-line paragraph spacing) are never touched or altered.
function detectSingleBreakFormat(lines) {
  const nonEmpty = lines.filter(l => l.trim() !== '').length;
  const empty    = lines.length - nonEmpty;
  if (nonEmpty < 20) return false;            // too short to judge reliably
  const blankRatio = empty / lines.length;
  return blankRatio < 0.03;                   // almost no blank lines anywhere
}

function processBookText(rawText) {
  const rawLines = rawText.split('\n');
  const singleBreakMode = detectSingleBreakFormat(rawLines);

  let html = '';
  let chapterCount = 0;
  let paraBuffer = [];

  const flushPara = () => {
    const text = paraBuffer.join(' ').trim();
    if (text) html += `<p class="book-para">${escapeHtml(text)}</p>\n`;
    paraBuffer = [];
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Chapter headings — CHAPTER 1, CHAPTER ONE, Chapter 1:, etc.
    if (/^(CHAPTER|Chapter)\s+(\d+|[A-Z]+)\b/i.test(trimmed) && trimmed.length < 120) {
      flushPara();
      const clean = stripMarkdown(trimmed);
      const chapterId = `chapter-${++chapterCount}`;
      State.currentChapters.push({ id: chapterId, title: clean });
      html += `<span id="${chapterId}" class="chapter-anchor chapter-heading">${escapeHtml(clean)}</span>\n`;
      continue;
    }

    // Section/scene break markers
    if (/^(\*{3,}|—{3,}|—\s*\*\s*—|\*\s*\*\s*\*|#{3,}|-{3,})$/.test(trimmed)) {
      flushPara();
      html += `<div class="scene-break">· · ·</div>\n`;
      continue;
    }

    // Italic timestamp lines *Location — Time*
    if (/^\*[^*]+\*$/.test(trimmed) && trimmed.length < 100) {
      flushPara();
      const clean = trimmed.replace(/^\*/, '').replace(/\*$/, '').trim();
      html += `<span class="timestamp-line">${escapeHtml(clean)}</span>\n`;
      continue;
    }

    // Empty lines flush paragraph buffer
    if (trimmed === '') {
      flushPara();
      continue;
    }

    // ── Single-break mode: every non-empty line is its own paragraph ──
    if (singleBreakMode) {
      paraBuffer.push(trimmed);
      flushPara();
      continue;
    }

    // Accumulate paragraph lines (normal mode — wait for blank line)
    paraBuffer.push(trimmed);
  }

  flushPara();
  return html;
}

// ── CHAPTER NAVIGATION ────────────────────────────
function renderChapterNav(chapters) {
  const list = DOM.chapterNavList;
  if (!list) return;

  if (chapters.length === 0) {
    list.innerHTML = `<div class="chapter-nav-item" style="cursor:default;color:var(--text-dim)">No chapters detected</div>`;
    return;
  }

  list.innerHTML = chapters.map(ch => `
    <div class="chapter-nav-item" data-chapter-id="${ch.id}" onclick="scrollToChapter('${ch.id}')">
      ${escapeHtml(ch.title)}
    </div>
  `).join('');
}

function syncMobileChapterNav() {
  const desktop = DOM.chapterNavList;
  const mobile  = DOM.mobileChapterNavList;
  if (desktop && mobile) {
    mobile.innerHTML = desktop.innerHTML;
    mobile.querySelectorAll('.chapter-nav-item').forEach(el => {
      const id = el.dataset.chapterId;
      if (id) el.onclick = () => { scrollToChapter(id); closeMobileDrawers(); };
    });
  }
}

function scrollToChapter(chapterId) {
  const el = document.getElementById(chapterId);
  const panel = DOM.readerPanel;
  if (!el || !panel) return;
  const offset = 80;
  const panelRect = panel.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  panel.scrollTop += elRect.top - panelRect.top - offset;
}

// ── SCROLL TRACKING ───────────────────────────────
function setupScrollTracking() {
  const panel = DOM.readerPanel;
  if (!panel) return;

  panel.addEventListener('scroll', () => {
    const scrollTop = panel.scrollTop;
    const scrollHeight = panel.scrollHeight - panel.clientHeight;
    const pct = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;

    if (DOM.progressFill) DOM.progressFill.style.width = pct + '%';
    if (DOM.readingStatCurrent) DOM.readingStatCurrent.textContent = pct + '%';

    updateActiveChapter(scrollTop);
  });
}

function updateActiveChapter(scrollTop) {
  let activeId = null;
  const offset = 100;
  const panel = DOM.readerPanel;
  if (!panel) return;

  State.currentChapters.forEach(ch => {
    const el = document.getElementById(ch.id);
    if (!el) return;
    const panelRect = panel.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elTop = elRect.top - panelRect.top + panel.scrollTop;
    if (elTop <= scrollTop + offset) activeId = ch.id;
  });

  document.querySelectorAll('.chapter-nav-item').forEach(el => {
    el.classList.toggle('active-chapter', el.dataset.chapterId === activeId);
  });
}

// ── TOPBAR & NAV BUTTONS ──────────────────────────
function updateTopbarLocation(book) {
  if (!DOM.topbarLocation) return;
  const seriesTitle = State.series.title || '';
  DOM.topbarLocation.innerHTML = State.books.length > 1
    ? `<span>${escapeHtml(seriesTitle)}</span><span style="margin:0 8px;opacity:0.3">·</span><span class="current-book-label">${escapeHtml(book.title)}</span>`
    : `<span>${escapeHtml(book.title)}</span>`;
}

function setupNavButtons() {
  if (DOM.prevBtn) DOM.prevBtn.onclick = () => loadBook(State.currentBookIndex - 1);
  if (DOM.nextBtn) DOM.nextBtn.onclick = () => loadBook(State.currentBookIndex + 1);
  if (DOM.prevBookBtn) DOM.prevBookBtn.onclick = () => loadBook(State.currentBookIndex - 1);
  if (DOM.nextBookBtn) DOM.nextBookBtn.onclick = () => loadBook(State.currentBookIndex + 1);
}

function updateNavButtons() {
  const idx = State.currentBookIndex;
  const max = State.books.length - 1;
  const singleBook = State.books.length === 1;

  [DOM.prevBtn, DOM.prevBookBtn].forEach(b => {
    if (b) { b.style.visibility = (idx <= 0 || singleBook) ? 'hidden' : 'visible'; }
  });
  [DOM.nextBtn, DOM.nextBookBtn].forEach(b => {
    if (b) { b.style.visibility = (idx >= max || singleBook) ? 'hidden' : 'visible'; }
  });
}

// ── FONT SIZE ─────────────────────────────────────
function setupFontControls() {
  const sizes = ['font-sm', 'font-md', 'font-lg', 'font-xl'];
  let current = 1;

  const step = (delta) => {
    const next = current + delta;
    if (next < 0 || next >= sizes.length) return;
    document.body.classList.remove(sizes[current]);
    current = next;
    document.body.classList.add(sizes[current]);
  };

  if (DOM.fontDecrease) DOM.fontDecrease.addEventListener('click', () => step(-1));
  if (DOM.fontIncrease) DOM.fontIncrease.addEventListener('click', () => step(1));
}

// ── MOBILE ────────────────────────────────────────
function setupMobileControls() {
  if (DOM.mobileNavBtn) {
    DOM.mobileNavBtn.addEventListener('click', () => {
      const isOpen = DOM.mobileNavDrawer.classList.contains('open');
      closeMobileDrawers();
      if (!isOpen) {
        DOM.mobileNavDrawer.classList.add('open');
        DOM.drawerOverlay.classList.add('visible');
        DOM.mobileNavBtn.classList.add('active');
      }
    });
  }
  if (DOM.drawerOverlay) {
    DOM.drawerOverlay.addEventListener('click', closeMobileDrawers);
  }
}

function closeMobileDrawers() {
  if (DOM.mobileNavDrawer) DOM.mobileNavDrawer.classList.remove('open');
  if (DOM.drawerOverlay) DOM.drawerOverlay.classList.remove('visible');
  if (DOM.mobileNavBtn) DOM.mobileNavBtn.classList.remove('active');
}

// ── KEYBOARD ──────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'ArrowRight') loadBook(State.currentBookIndex + 1);
  if (e.altKey && e.key === 'ArrowLeft')  loadBook(State.currentBookIndex - 1);
  if (e.key === 'Escape') closeMobileDrawers();
});

// ── UI STATE ──────────────────────────────────────
function showLoading() {
  if (DOM.loadingState)  DOM.loadingState.style.display  = 'flex';
  if (DOM.welcomeScreen) DOM.welcomeScreen.style.display = 'none';
  if (DOM.bookContent)   DOM.bookContent.style.display   = 'none';
}
function showWelcome() {
  if (DOM.loadingState)  DOM.loadingState.style.display  = 'none';
  if (DOM.welcomeScreen) DOM.welcomeScreen.style.display = 'block';
  if (DOM.bookContent)   DOM.bookContent.style.display   = 'none';
}
function showBookContent() {
  if (DOM.loadingState)  DOM.loadingState.style.display  = 'none';
  if (DOM.welcomeScreen) DOM.welcomeScreen.style.display = 'none';
  if (DOM.bookContent) {
    DOM.bookContent.style.display = 'block';
    DOM.bookContent.classList.add('fade-in');
    setTimeout(() => DOM.bookContent.classList.remove('fade-in'), 400);
  }
}
function showError(msg) {
  if (DOM.loadingState) {
    DOM.loadingState.innerHTML = `<div class="loading-text" style="color:var(--status-red);max-width:300px;text-align:center;line-height:1.6">${msg}</div>`;
    DOM.loadingState.style.display = 'flex';
  }
}

// ── FETCH ─────────────────────────────────────────
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.json();
}
async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.text();
}

// ── UTILS ─────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function stripMarkdown(str) {
  return str.replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1').replace(/^#+\s*/,'').trim();
}

// ── GLOBALS & START ───────────────────────────────
window.loadBook       = loadBook;
window.scrollToChapter = scrollToChapter;

document.addEventListener('DOMContentLoaded', init);
