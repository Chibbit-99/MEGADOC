/* ═══════════════════════════════════════════════════════════════
   MegaDoc — all your notes in one document.
   Tabs → subtabs → subsubtabs (unlimited depth), each with its
   own rich-text page. Everything persists in localStorage.
   ═══════════════════════════════════════════════════════════════ */

const LS_KEY = 'megadoc-v2';
const GOOGLE_DOCS_SETTINGS_KEY = 'megadoc-google-docs-settings-v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ─────────────────────────── Seed data ───────────────────────────
   MegaDoc starts empty — no example tabs. Your first tab is yours. */
function seedState() {
  return {
    docTitle: 'MegaDoc',
    activeTabId: null,
    roots: [],
    tabs: {},
    expanded: [],
    margins: { left: 72, right: 72 },
    zoom: 100,
    people: [],
    profile: { name: 'MegaDoc user', color: '#4d5d85' },
    pageTheme: { dark: false, contrast: false },
  };
}

function normalizeState(s) {
  if (!s || typeof s !== 'object') return seedState();
  s.roots = Array.isArray(s.roots) ? s.roots : [];
  s.tabs = s.tabs && typeof s.tabs === 'object' ? s.tabs : {};
  s.expanded = Array.isArray(s.expanded) ? s.expanded : [];
  s.margins = s.margins || { left: 72, right: 72 };
  s.zoom = s.zoom || 100;
  s.people = Array.isArray(s.people) ? s.people : [];
  s.profile = s.profile || { name: 'MegaDoc user', color: '#4d5d85' };
  s.pageTheme = s.pageTheme || { dark: false, contrast: false };
  for (const t of Object.values(s.tabs)) {
    t.children = Array.isArray(t.children) ? t.children : [];
    t.history = Array.isArray(t.history) ? t.history : [];
    t.comments = Array.isArray(t.comments) ? t.comments : [];
    if (typeof t.content !== 'string') t.content = '<p>Start writing…</p>';
  }
  if (s.activeTabId && !s.tabs[s.activeTabId]) s.activeTabId = s.roots[0] || null;
  return s;
}

/* ─────────────────────────── Store ─────────────────────────── */
let state;
try {
  const raw = localStorage.getItem(LS_KEY);
  state = raw ? normalizeState(JSON.parse(raw)) : seedState();
} catch { state = seedState(); }

let saveTimer;
function save(immediate = false) {
  const status = $('#saveStatus');
  status.classList.add('saving');
  status.textContent = 'Saving…';
  const write = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (err) {
      status.classList.remove('saving');
      status.textContent = 'Save failed — storage full or unavailable';
      toast('Save failed. Export your document to avoid losing changes.', 'error');
      return;
    }
    status.classList.remove('saving');
    status.textContent = 'Saved locally';
  };
  clearTimeout(saveTimer);
  if (immediate) write(); else saveTimer = setTimeout(write, 400);
}

function getTab(id) { return state.tabs[id]; }
function siblingsOf(id) {
  const t = getTab(id);
  if (!t) return state.roots;
  return t.parentId ? getTab(t.parentId).children : state.roots;
}
function descendants(id, acc = []) {
  const t = getTab(id);
  if (!t) return acc;
  for (const c of t.children) { acc.push(c); descendants(c, acc); }
  return acc;
}
function pathTo(id) {
  const path = [];
  let cur = getTab(id);
  while (cur) { path.unshift(cur); cur = cur.parentId ? getTab(cur.parentId) : null; }
  return path;
}
function totalTabs() { return Object.keys(state.tabs).length; }

/* ─────────────────────────── Toasts ─────────────────────────── */
function toast(msg, icon = 'check_circle') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span>${esc(msg)}</span>`;
  $('#toastWrap').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 2600);
}

/* ─────────────────────────── Tabs tree ─────────────────────────── */
let searchQuery = '';
let dragIdGlobal = null;

function renderTree() {
  const tree = $('#tabsTree');
  tree.innerHTML = '';
  const q = searchQuery.trim().toLowerCase();

  const matches = id => {
    if (!q) return true;
    const t = getTab(id);
    if (t.title.toLowerCase().includes(q)) return true;
    return descendants(id).some(d => getTab(d).title.toLowerCase().includes(q));
  };

  const build = (ids, depth, container) => {
    for (const id of ids) {
      const t = getTab(id);
      if (!t || !matches(id)) continue;
      const hasKids = t.children.length > 0;
      const expanded = q ? true : state.expanded.includes(id);
      const row = document.createElement('div');
      row.className = 'tab-row' + (id === state.activeTabId ? ' active' : '');
      row.style.paddingLeft = (2 + depth * 16) + 'px';
      row.dataset.id = id;
      row.setAttribute('role', 'treeitem');
      row.draggable = true;
      const kidCount = descendants(id).length;
      row.innerHTML = `
        <button class="tab-chev ${hasKids ? '' : 'leaf'} ${expanded ? 'expanded' : ''}" data-act="toggle" title="${hasKids ? 'Expand/collapse' : ''}"><span class="material-symbols-outlined">chevron_right</span></button>
        ${typeof t.tabEmoji === 'string' && t.tabEmoji ? `<span class="tab-icon tab-emoji" aria-label="Tab icon">${esc(t.tabEmoji)}</span>` : `<span class="material-symbols-outlined tab-icon">${hasKids ? 'folder' : 'description'}</span>`}
        <span class="tab-title" title="${esc(t.title)}">${esc(t.title)}</span>
        ${kidCount ? `<span class="tab-badge" title="${kidCount} subtab${kidCount > 1 ? 's' : ''}">${kidCount}</span>` : ''}
        <button class="tab-add" data-act="add" title="Add tab at the same level" aria-label="Add tab at the same level"><span class="material-symbols-outlined">add</span></button>
        <button class="tab-dots" data-act="menu" title="Tab options"><span class="material-symbols-outlined">more_vert</span></button>`;
      row.addEventListener('click', e => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'toggle') { toggleExpand(id); return; }
        if (act === 'add') { e.stopPropagation(); addSiblingTab(id); return; }
        if (act === 'menu') { e.stopPropagation(); openTabMenu(id, e.currentTarget); return; }
        selectTab(id, true);
      });
      row.addEventListener('dblclick', e => {
        if (e.target.closest('[data-act]')) return;
        startRename(id, row);
      });
      row.addEventListener('contextmenu', e => { e.preventDefault(); openTabMenu(id, e.currentTarget); });
      // drag & drop
      row.addEventListener('dragstart', e => {
        dragIdGlobal = id;
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => { dragIdGlobal = null; row.classList.remove('dragging'); $$('.tab-row').forEach(r => r.classList.remove('drag-over', 'drag-over-after')); });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        const dragId = dragIdGlobal || e.dataTransfer.getData('text/plain');
        if (!dragId || dragId === id) return;
        const rect = row.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        row.classList.toggle('drag-over', !after);
        row.classList.toggle('drag-over-after', after);
        row.dataset.dropAfter = after ? '1' : '0';
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over', 'drag-over-after'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        const dragId = e.dataTransfer.getData('text/plain');
        if (!dragId || dragId === id) return;
        moveTab(dragId, id, row.dataset.dropAfter === '1');
      });
      container.appendChild(row);
      if (hasKids && expanded) {
        const kids = document.createElement('div');
        kids.className = 'tab-children';
        build(t.children, depth + 1, kids);
        container.appendChild(kids);
      }
    }
  };

  build(state.roots, 0, tree);
  if (!tree.children.length) {
    if (totalTabs() === 0) {
      tree.innerHTML = '<div class="empty-tree"><span class="material-symbols-outlined">folder_open</span>No tabs yet.<br><button class="btn primary" id="treeNewTab" style="margin-top:10px">+ New tab</button></div>';
      $('#treeNewTab').addEventListener('click', () => addTab(null));
    } else {
      tree.innerHTML = '<div class="empty-tree"><span class="material-symbols-outlined">search_off</span>No tabs match your search.</div>';
    }
  }
  $('#statusTabs').textContent = `${totalTabs()} tab${totalTabs() === 1 ? '' : 's'}`;
  renderCrumbs();
}

function toggleExpand(id) {
  const i = state.expanded.indexOf(id);
  if (i >= 0) state.expanded.splice(i, 1); else state.expanded.push(id);
  save(); renderTree();
}

function selectTab(id, preserveTree = false, keepPanelOpen = false) {
  if (!getTab(id) || (preserveTree && state.activeTabId === id)) return;
  saveCurrentContent();
  state.activeTabId = id;
  // auto-expand ancestors so the active tab is visible
  let cur = getTab(id);
  while (cur?.parentId) {
    if (!state.expanded.includes(cur.parentId)) state.expanded.push(cur.parentId);
    cur = getTab(cur.parentId);
  }
  editorRange = null; pendingFontSize = null;
  loadTabContent();
  syncFormatButtons();
  if ($('#findbar').classList.contains('open')) runFind();
  if (preserveTree) {
    $$('#tabsTree .tab-row').forEach(row => row.classList.toggle('active', row.dataset.id === id));
    renderCrumbs();
  } else renderTree();
  save();
  if (innerWidth <= 900 && !preserveTree && !keepPanelOpen) { $('#tabsPanel').classList.remove('open'); $('#panelReopen').setAttribute('aria-expanded', 'false'); }
}

function addTab(parentId = null, title = 'Untitled tab', afterId = null) {
  const id = uid();
  state.tabs[id] = { id, title, parentId, children: [], content: '', updatedAt: Date.now(), history: [], comments: [] };
  if (parentId && getTab(parentId)) {
    const siblings = getTab(parentId).children;
    const index = afterId ? siblings.indexOf(afterId) : -1;
    if (index >= 0) siblings.splice(index + 1, 0, id); else siblings.push(id);
    if (!state.expanded.includes(parentId)) state.expanded.push(parentId);
  } else {
    const index = afterId ? state.roots.indexOf(afterId) : -1;
    if (index >= 0) state.roots.splice(index + 1, 0, id); else state.roots.push(id);
  }
  save(); selectTab(id, false, true);
  if (innerWidth <= 900) { $('#tabsPanel').classList.add('open'); $('#panelReopen').setAttribute('aria-expanded', 'true'); }
  requestAnimationFrame(() => {
    const row = $(`.tab-row[data-id="${id}"]`);
    if (row) startRename(id, row);
  });
  toast(parentId ? 'Subtab created' : 'Tab created', 'add_circle');
}

function addSiblingTab(id) {
  const tab = getTab(id);
  if (tab) addTab(tab.parentId, 'Untitled tab', id);
}

function duplicateTab(id) {
  const src = getTab(id);
  if (!src) return;
  // Recursive copy that preserves structure:
  const clone = (sid, parentId) => {
    const s = getTab(sid);
    const nid = uid();
    state.tabs[nid] = { id: nid, title: parentId ? s.title : s.title + ' copy', parentId, children: [], content: s.content, updatedAt: Date.now(), history: [], comments: [], ...(typeof s.tabEmoji === 'string' ? { tabEmoji: s.tabEmoji } : {}), ...(Object.hasOwn(s, 'pageView') ? {pageView: structuredClone(s.pageView)} : {}) };
    state.tabs[nid].children = s.children.map(c => clone(c, nid));
    return nid;
  };
  const newId = clone(id, src.parentId);
  const sibs = siblingsOf(id);
  sibs.splice(sibs.indexOf(id) + 1, 0, newId);
  save(); selectTab(newId);
  toast('Tab duplicated', 'content_copy');
}

function deleteTab(id) {
  const t = getTab(id);
  if (!t) return;
  const count = 1 + descendants(id).length;
  confirmModal(
    'Delete tab?',
    `<p>Delete <b>${esc(t.title)}</b>${count > 1 ? ` and its ${count - 1} subtab${count - 1 > 1 ? 's' : ''}` : ''}? This cannot be undone.</p>`,
    'Delete', () => {
      const sibs = siblingsOf(id);
      sibs.splice(sibs.indexOf(id), 1);
      const remove = sid => { getTab(sid).children.forEach(remove); delete state.tabs[sid]; };
      remove(id);
      if (state.activeTabId === id || !getTab(state.activeTabId)) {
        state.activeTabId = state.roots[0] || null;
      }
      save(); loadTabContent(); renderTree();
      toast('Tab deleted', 'delete');
    }
  );
}

function moveTab(dragId, targetId, after) {
  const drag = getTab(dragId), target = getTab(targetId);
  if (!drag || !target) return;
  if (dragId === targetId) return;
  // prevent dropping a tab into its own subtree
  if (descendants(dragId).includes(targetId)) { toast('Cannot move a tab into itself', 'error'); return; }
  const fromSibs = siblingsOf(dragId);
  fromSibs.splice(fromSibs.indexOf(dragId), 1);
  const toSibs = siblingsOf(targetId);
  const idx = toSibs.indexOf(targetId) + (after ? 1 : 0);
  toSibs.splice(idx, 0, dragId);
  drag.parentId = target.parentId;
  save(); renderTree();
  toast('Tab moved', 'move_item');
}

function moveTabBy(id, dir) {
  const sibs = siblingsOf(id);
  const i = sibs.indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= sibs.length) return;
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
  save(); renderTree();
}

function startRename(id, row) {
  const t = getTab(id);
  const titleEl = row.querySelector('.tab-title');
  if (!t || !titleEl) return;
  const input = document.createElement('input');
  input.className = 'tab-rename';
  input.value = t.title;
  titleEl.replaceWith(input);
  input.focus(); input.select();
  const commit = () => {
    const v = input.value.trim() || t.title;
    t.title = v; t.updatedAt = Date.now();
    save(); renderTree();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = t.title; input.blur(); }
    e.stopPropagation();
  });
  input.addEventListener('click', e => e.stopPropagation());
}

/* ── Tab context menu ── */
function openTabMenu(id, anchor) {
  const t = getTab(id);
  const menu = $('#contextMenu');
  const depth = pathTo(id).length - 1;
  menu.innerHTML = `
    <div class="mi-label">${esc(t.title)} · depth ${depth + 1}</div>
    <button class="mi" data-a="rename"><span class="material-symbols-outlined">edit</span> Rename</button>
    <button class="mi" data-a="icon"><span class="material-symbols-outlined">mood</span> Change emoji icon</button>
    <button class="mi" data-a="addchild"><span class="material-symbols-outlined">add_circle</span> Add subtab</button>
    <button class="mi" data-a="addroot"><span class="material-symbols-outlined">note_add</span> Add top-level tab</button>
    <button class="mi" data-a="duplicate"><span class="material-symbols-outlined">content_copy</span> Duplicate</button>
    <div class="mi-sep"></div>
    <button class="mi" data-a="up"><span class="material-symbols-outlined">arrow_upward</span> Move up</button>
    <button class="mi" data-a="down"><span class="material-symbols-outlined">arrow_downward</span> Move down</button>
    <button class="mi" data-a="expand"><span class="material-symbols-outlined">unfold_more</span> Expand subtree</button>
    <div class="mi-sep"></div>
    <button class="mi danger" data-a="delete"><span class="material-symbols-outlined">delete</span> Delete</button>`;
  const rect = anchor.getBoundingClientRect();
  menu.classList.remove('hidden');
  const menuRect = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(rect.right + 4, innerWidth - menuRect.width - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(rect.bottom, innerHeight - menuRect.height - 8)) + 'px';
  menu.querySelectorAll('[data-a]').forEach(btn => btn.addEventListener('click', () => {
    closeMenus();
    const a = btn.dataset.a;
    if (a === 'icon') tabIconPicker(id);
    if (a === 'rename') { const row = $(`.tab-row[data-id="${id}"]`); if (row) startRename(id, row); }
    if (a === 'addchild') addTab(id);
    if (a === 'addroot') addTab(null);
    if (a === 'duplicate') duplicateTab(id);
    if (a === 'up') moveTabBy(id, -1);
    if (a === 'down') moveTabBy(id, 1);
    if (a === 'expand') { [id, ...descendants(id)].forEach(d => { if (!state.expanded.includes(d)) state.expanded.push(d); }); save(); renderTree(); }
    if (a === 'delete') deleteTab(id);
  }));
}

/* ─────────────────────────── Editor ─────────────────────────── */
const page = $('#page');
let selectedImage = null;
let activeImageResize = null;
let mode = 'editing';
let programmaticEdit = false;
let pendingClearRange = null;
let clearMarker = null;
let placingClearMarker = false;

function saveCurrentContent() {
  // Never serialize a transient resize preview as a completed edit.
  if (activeImageResize) cancelImageResize();
  const t = getTab(state.activeTabId);
  if (t && t.content !== page.innerHTML) {
    t.history ||= [];
    if (!t.history.length || t.history[t.history.length - 1].content !== t.content) {
      t.history.push({ t: t.updatedAt || Date.now(), content: t.content });
      if (t.history.length > 25) t.history.shift();
    }
    t.content = page.innerHTML; t.updatedAt = Date.now();
  }
}
function loadTabContent() {
  pendingClearRange = null; clearMarker = null;
  clearImageSelection();
  const t = getTab(state.activeTabId);
  applyTabView();
  if (!t) {
    page.contentEditable = 'false';
    page.innerHTML = `<div class="empty-state">
      <h1>Your MegaDoc is empty</h1>
      <p>Create a tab to start writing. You can add subtabs as you go.</p>
      <button class="btn primary" id="emptyNewTab">+ Create your first tab</button>
      <div class="es-tips">Use a tab’s menu to add a <b>subtab</b> · double-click to rename · <span class="kbd">Ctrl</span>+<span class="kbd">/</span> for commands</div>
    </div>`;
    $('#emptyNewTab').addEventListener('click', () => addTab(null));
    updateWordCount();
    $('#statusTab').textContent = 'No tab selected';
    return;
  }
  page.contentEditable = mode === 'viewing' ? 'false' : 'true';
  editorRange = null;
  page.innerHTML = t.content;
  updateWordCount();
  $('#statusTab').textContent = `Tab: ${t.title}`;
}
function updateWordCount() {
  let words = 0;
  if (getTab(state.activeTabId)) {
    const text = page.innerText.replace(/\s+/g, ' ').trim();
    words = text ? text.split(' ').length : 0;
  }
  $('#wordCount').textContent = `${words} word${words === 1 ? '' : 's'}`;
  $('#statusWords').textContent = `${words} words`;
}
page.addEventListener('input', e => {
  if (placingClearMarker) return;
  if (clearMarker) {
    const marker = clearMarker; clearMarker = null;
    if (marker.isConnected) { const i = marker.data.indexOf('\u200b'); if (i >= 0) marker.deleteData(i, 1); }
  }
  if (pendingFontSize) {
    page.querySelectorAll('font[size="7"]').forEach(font => {
      if (!pendingFontSize.existing.has(font)) { font.removeAttribute('size'); font.style.fontSize = `${pendingFontSize.size}pt`; }
    });
    pendingFontSize = null;
  }
  saveCurrentContent(); updateWordCount(); save(); syncFormatButtons();
  if ($('#findbar').classList.contains('open')) refreshFindCount();
  if (selectedImage) updateImageControls();
  if (!programmaticEdit && !e.isComposing && (e.inputType === 'insertText' || e.inputType === 'insertFromComposition') && e.data?.endsWith(' ')) queueMicrotask(maybeApplyMarkdownAfterInput);
});
page.addEventListener('compositionend', () => { setTimeout(maybeApplyMarkdownAfterInput, 0); });
// Browser copy/cut supplies both HTML and plain text. Sanitize rich paste before
// inserting it as one native edit; text-only and paste-without-formatting use
// the browser's normal path, including its own selection and undo behavior.
function insertClipboardContent(html, text) {
  if (!getTab(state.activeTabId) || mode === 'viewing') return false;
  let content = '', command = 'insertText';
  if (html) {
    if (html.length > 10 * 1024 * 1024) { toast('Clipboard content exceeds 10 MB', 'error'); return false; }
    try { content = sanitizeImportedHTML(html, true); command = 'insertHTML'; }
    catch { toast('Rich paste is unavailable; use paste without formatting', 'error'); return false; }
  }
  if (!content && text) { content = text; command = 'insertText'; }
  if (!content) { toast('There is no supported clipboard content to paste', 'info'); return false; }
  prepareClearTyping();
  programmaticEdit = true;
  let inserted;
  try { inserted = document.execCommand(command, false, content); } finally { programmaticEdit = false; }
  if (!inserted) toast('Could not paste here; place the caret in editable text', 'error');
  return inserted;
}
page.addEventListener('paste', e => {
  const html = e.clipboardData?.getData('text/html');
  if (!html) return;
  e.preventDefault();
  insertClipboardContent(html, e.clipboardData.getData('text/plain'));
});

/* Markdown shortcuts are deliberately local to the current plain-text run.
   This avoids rewriting existing formatting or anything inside code or tables. */
function markdownLineRange(sel) {
  const node = sel.anchorNode;
  const parent = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!parent || parent.closest('pre,code,a,td,th,li')) return null;
  const candidate = parent.closest('p,div,h1,h2,h3,h4,h5,h6,blockquote');
  const block = candidate && page.contains(candidate) ? candidate : page;
  const range = document.createRange(); range.selectNodeContents(block); range.setEnd(node, sel.anchorOffset);
  if (node.nodeType === Node.TEXT_NODE) {
    const newline = node.data.lastIndexOf('\n', sel.anchorOffset - 1);
    if (newline >= 0) range.setStart(node, newline + 1);
    else if (node.previousSibling?.nodeName === 'BR' || (node.parentNode === page && node.previousSibling && /^(P|DIV|H[1-6]|PRE|BLOCKQUOTE|UL|OL|TABLE|HR)$/.test(node.previousSibling.nodeName))) range.setStart(node, 0);
  }
  return range;
}
function applyMarkdownBlock(token, range, sel) {
  sel.removeAllRanges(); sel.addRange(range);
  document.execCommand('delete', false);
  if (token[0] === '#') document.execCommand('formatBlock', false, 'H' + token.length);
  else if (token === '>') document.execCommand('formatBlock', false, 'BLOCKQUOTE');
  else if (token === '```') document.execCommand('formatBlock', false, 'PRE');
  else if (token === '---') document.execCommand('insertHorizontalRule', false);
  else document.execCommand(token === '1.' ? 'insertOrderedList' : 'insertUnorderedList', false);
  if (sel.rangeCount && page.contains(sel.anchorNode)) { editorRange = sel.getRangeAt(0).cloneRange(); syncStyleLabel(sel.anchorNode); }
  saveCurrentContent(); updateWordCount(); save();
}
function maybeApplyMarkdownAfterInput() {
  if (!appearance.markdown || mode === 'viewing' || !getTab(state.activeTabId)) return;
  const sel = getSelection();
  if (!sel.rangeCount || !sel.isCollapsed || !page.contains(sel.anchorNode)) return;
  const range = markdownLineRange(sel);
  const match = range && /^(#{1,6}|[-*+]|1\.|>|```|---)[ \u00a0]$/.exec(range.toString());
  if (match) applyMarkdownBlock(match[1], range, sel);
}
function handleMarkdownKey(e) {
  if (!appearance.markdown || mode === 'viewing' || !getTab(state.activeTabId) || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || (e.key !== ' ' && e.key !== 'Enter')) return;
  const sel = getSelection();
  if (!sel.rangeCount || !sel.isCollapsed || !page.contains(sel.anchorNode)) return;
  const node = sel.anchorNode;
  const parent = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const pre = parent?.closest('pre');
  if (pre && e.key === 'Enter' && node.nodeType === Node.TEXT_NODE && node.parentNode === pre && node === pre.lastChild && sel.anchorOffset === node.length && node.data.endsWith('```')) {
    const start = sel.anchorOffset - 3;
    if ((start === 0 && (!node.previousSibling || node.previousSibling.nodeName === 'BR')) || node.data[start - 1] === '\n') {
      e.preventDefault();
      const content = document.createRange(); content.selectNodeContents(pre); content.setEnd(node, start);
      const copy = document.createElement('pre'); copy.appendChild(content.cloneContents());
      const paragraph = document.createElement('p'); paragraph.appendChild(document.createElement('br'));
      pre.replaceWith(copy, paragraph);
      const range = document.createRange(); range.selectNodeContents(paragraph); range.collapse(true);
      sel.removeAllRanges(); sel.addRange(range); editorRange = range.cloneRange();
      saveCurrentContent(); updateWordCount(); save();
      return;
    }
  }
  if (!parent || parent.closest('pre,code,a')) return;
  const before = markdownLineRange(sel);
  const prefix = before?.toString() || '';
  const blockMatch = before && (e.key === ' ' || (e.key === 'Enter' && prefix === '```')) && /^(#{1,6}|[-*+]|1\.|>|```|---)$/.exec(prefix);
  if (blockMatch) {
    e.preventDefault();
    applyMarkdownBlock(blockMatch[1], before, sel);
    return;
  }
  if (node.nodeType !== Node.TEXT_NODE) return;
  const text = node.data.slice(0, sel.anchorOffset);
  const patterns = [
    { re: /\*\*([^*\n]+)\*\*$/, tag: 'strong' },
    { re: /__([^_\n]+)__$/, tag: 'strong' },
    { re: /(?:^|[^*])\*([^*\n]+)\*$/, tag: 'em', prefix: true },
    { re: /(?:^|[^_\w])_([^_\n]+)_$/, tag: 'em', prefix: true },
    { re: /~~([^~\n]+)~~$/, tag: 's' },
    { re: /`([^`\n]+)`$/, tag: 'code' },
    { re: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)$/, tag: 'a' },
  ];
  for (const pattern of patterns) {
    const match = pattern.re.exec(text);
    if (!match) continue;
    const leading = pattern.prefix && match[0][0] !== '*' && match[0][0] !== '_' ? 1 : 0;
    const start = match.index + leading;
    if (start > 0 && text[start - 1] === '\\') continue;
    const range = document.createRange(); range.setStart(node, start); range.setEnd(node, sel.anchorOffset);
    sel.removeAllRanges(); sel.addRange(range);
    const value = esc(match[1]);
    const html = pattern.tag === 'a' ? `<a href="${esc(match[2])}" target="_blank" rel="noopener">${value}</a>` : `<${pattern.tag}>${value}</${pattern.tag}>`;
    if (e.key === ' ') e.preventDefault();
    document.execCommand('insertHTML', false, html + (e.key === ' ' ? '&nbsp;' : ''));
    if (sel.rangeCount && page.contains(sel.anchorNode)) editorRange = sel.getRangeAt(0).cloneRange();
    saveCurrentContent(); updateWordCount(); save();
    break;
  }
}
// Enter exits a heading or quote; Shift+Enter remains a soft line break.
function enterNormalParagraph() {
  const sel = getSelection();
  if (!sel.rangeCount || !page.contains(sel.anchorNode) || !page.contains(sel.focusNode)) return false;
  const el = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
  const block = el?.closest('h1,h2,h3,h4,h5,h6,blockquote');
  if (!block || !page.contains(block)) return false;
  pendingClearRange = null; pendingFontSize = null;
  programmaticEdit = true;
  try { document.execCommand('insertParagraph'); document.execCommand('formatBlock', false, 'P'); } finally { programmaticEdit = false; }
  if (sel.rangeCount && page.contains(sel.anchorNode)) { editorRange = sel.getRangeAt(0).cloneRange(); syncStyleLabel(sel.anchorNode); }
  saveCurrentContent(); updateWordCount(); save(); syncFormatButtons();
  return true;
}
page.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) pendingClearRange = null;
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && mode !== 'viewing' && enterNormalParagraph()) e.preventDefault();
});
page.addEventListener('keydown', e => { if (!e.defaultPrevented) handleMarkdownKey(e); });
page.addEventListener('keyup', syncFormatButtons);
// Mobile keyboards may not send meaningful keydown events; use beforeinput as a fallback.
let handlingMarkdownInput = false;
page.addEventListener('beforeinput', e => {
  if (handlingMarkdownInput || e.isComposing || e.defaultPrevented) return;
  if (e.inputType === 'insertParagraph' && mode !== 'viewing' && enterNormalParagraph()) { e.preventDefault(); return; }
  const key = e.inputType === 'insertText' && e.data === ' ' ? ' ' : e.inputType === 'insertParagraph' ? 'Enter' : null;
  if (!key) return;
  handlingMarkdownInput = true;
  try { handleMarkdownKey({ key, isComposing: false, preventDefault: () => e.preventDefault() }); }
  finally { handlingMarkdownInput = false; }
});

function renderCrumbs() {
  const wrap = $('#crumbs');
  const path = pathTo(state.activeTabId);
  if (!path.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = path.map((t, i) => {
    const last = i === path.length - 1;
    return `${i ? '<span class="material-symbols-outlined crumb-sep-icon">chevron_right</span>' : ''}
      <button class="crumb ${last ? 'current' : ''}" data-id="${t.id}" title="${esc(t.title)}">
        <span class="material-symbols-outlined">${t.children.length ? 'folder' : 'description'}</span>${esc(t.title)}
      </button>`;
  }).join('');
  wrap.querySelectorAll('.crumb').forEach(c => c.addEventListener('click', () => selectTab(c.dataset.id)));
}

/* ─────────────────────────── Formatting ─────────────────────────── */
let editorRange = null;
let pendingFontSize = null;
document.addEventListener('selectionchange', () => {
  const sel = getSelection();
  if (sel.rangeCount && page.contains(sel.anchorNode) && page.contains(sel.focusNode)) {
    const currentRange = sel.getRangeAt(0);
    if (pendingClearRange && (currentRange.compareBoundaryPoints(Range.START_TO_START, pendingClearRange) !== 0 || currentRange.compareBoundaryPoints(Range.END_TO_END, pendingClearRange) !== 0)) pendingClearRange = null;
    editorRange = currentRange.cloneRange();
    syncStyleLabel(sel.anchorNode);
    syncFormatButtons();
  }
});
function syncFormatButtons() {
  const sel = getSelection();
  const inPage = getTab(state.activeTabId) && mode !== 'viewing' && sel.rangeCount && page.contains(sel.anchorNode) && page.contains(sel.focusNode);
  for (const [name, command] of [['bold','bold'], ['italic','italic'], ['underline','underline'], ['strike','strikeThrough'], ['superscript','superscript'], ['subscript','subscript'], ['bullets','insertUnorderedList'], ['numbering','insertOrderedList']]) {
    const button = $(`#toolbar [data-cmd="${name}"]`);
    const active = !!inPage && !pendingClearRange && document.queryCommandState(command);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}
function syncStyleLabel(node) {
  let element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  while (element && element !== page && !/^(H[1-6]|P|BLOCKQUOTE|PRE|LI)$/.test(element.tagName)) element = element.parentElement;
  const name = element?.tagName;
  const style = /^H[1-6]$/.test(name || '') ? name.toLowerCase() : name === 'BLOCKQUOTE' ? 'blockquote' : name === 'PRE' ? 'code' : 'p';
  const labels = { p: 'Normal text', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6', blockquote: 'Quote', code: 'Code' };
  $('#styleLabel').textContent = labels[style];
  $$('#styleMenu button').forEach(b => b.classList.toggle('active', b.dataset.style === style));
}
function focusPage() {
  const sel = getSelection();
  const alreadyFocused = document.activeElement === page;
  const current = sel.rangeCount ? sel.getRangeAt(0) : null;
  const unchanged = alreadyFocused && current && editorRange &&
    current.compareBoundaryPoints(Range.START_TO_START, editorRange) === 0 &&
    current.compareBoundaryPoints(Range.END_TO_END, editorRange) === 0;
  page.focus();
  if (!unchanged && editorRange && page.contains(editorRange.commonAncestorContainer)) {
    sel.removeAllRanges(); sel.addRange(editorRange);
  }
}
function exec(cmd, val = null) {
  pendingClearRange = null;
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  const alignImage = /^justify(Left|Center|Right|Full)$/.test(cmd) && selectedImage && page.contains(selectedImage);
  const imageIndex = alignImage ? $$('#page img').indexOf(selectedImage) : -1;
  focusPage();
  if (alignImage) {
    const range = document.createRange(); range.selectNode(selectedImage);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  }
  programmaticEdit = true;
  try { document.execCommand(cmd, false, val); } finally { programmaticEdit = false; }
  const sel = getSelection();
  if (sel.rangeCount && page.contains(sel.anchorNode)) editorRange = sel.getRangeAt(0).cloneRange();
  if (alignImage) { selectedImage = $$('#page img')[imageIndex] || null; updateImageControls(); }
  else if (selectedImage && !page.contains(selectedImage)) clearImageSelection();
  saveCurrentContent(); updateWordCount(); save(); syncFormatButtons();
}
// removeFormat on a collapsed caret does not stop inheriting ancestor styles in
// Chromium. Defer a temporary plain-text anchor until the next input, then remove
// it immediately after insertion so saved content never contains the marker.
function prepareClearTyping() {
  if (!pendingClearRange) return;
  const sel = getSelection();
  if (!sel.rangeCount || !sel.isCollapsed || !page.contains(sel.anchorNode) || sel.getRangeAt(0).compareBoundaryPoints(Range.START_TO_START, pendingClearRange) !== 0) { pendingClearRange = null; return; }
  pendingClearRange = null;
  placingClearMarker = true;
  try {
    document.execCommand('insertText', false, '\u200b');
    const range = sel.getRangeAt(0).cloneRange();
    range.setStart(range.endContainer, range.endOffset - 1);
    sel.removeAllRanges(); sel.addRange(range);
    document.execCommand('removeFormat'); document.execCommand('unlink');
    sel.collapseToEnd();
    if (sel.anchorNode.nodeType === Node.TEXT_NODE) clearMarker = sel.anchorNode;
  } finally { placingClearMarker = false; }
}
page.addEventListener('beforeinput', e => {
  if (!placingClearMarker && pendingClearRange && /^(insertText|insertCompositionText|insertFromPaste|insertFromDrop)$/.test(e.inputType)) prepareClearTyping();
});
function clearFormatting() {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  focusPage(); pendingFontSize = null; pendingClearRange = null;
  const sel = getSelection();
  if (!sel.rangeCount || !page.contains(sel.anchorNode) || !page.contains(sel.focusNode)) return;
  // Reset a heading or quote only when the selection stays within that block.
  // Applying formatBlock to a multi-block selection can reorder tables/lists.
  const blockOf = node => (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest('h1,h2,h3,h4,h5,h6,blockquote,p,li,td,th');
  const block = blockOf(sel.anchorNode);
  if (block && block === blockOf(sel.focusNode) && /^(H[1-6]|BLOCKQUOTE)$/.test(block.tagName)) {
    programmaticEdit = true;
    try { document.execCommand('formatBlock', false, 'P'); } finally { programmaticEdit = false; }
  }
  if (sel.isCollapsed) {
    document.execCommand('removeFormat');
    for (const cmd of ['bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript']) {
      if (document.queryCommandState(cmd)) document.execCommand(cmd);
    }
    pendingClearRange = sel.getRangeAt(0).cloneRange();
  } else {
    programmaticEdit = true;
    try { document.execCommand('removeFormat'); document.execCommand('unlink'); } finally { programmaticEdit = false; }
  }
  if (sel.rangeCount && page.contains(sel.anchorNode)) editorRange = sel.getRangeAt(0).cloneRange();
  if (sel.rangeCount) syncStyleLabel(sel.anchorNode);
  saveCurrentContent(); updateWordCount(); save(); syncFormatButtons();
  toast('Formatting cleared', 'format_clear');
}

// Clone the selected range into a detached copy, edit its text nodes, then
// replace the editable page in one native undo step. This preserves surrounding
// formatting, tables, embedded images and data attributes across block ranges.
function cloneRangeInPage(range, copy) {
  const path = node => { const out = []; while (node !== page && node?.parentNode) { out.unshift([...node.parentNode.childNodes].indexOf(node)); node = node.parentNode; } return node === page ? out : null; };
  const locate = steps => steps?.reduce((node, i) => node?.childNodes[i], copy);
  const start = locate(path(range.startContainer)), end = locate(path(range.endContainer));
  if (!start || !end) return null;
  const mapped = document.createRange(); mapped.setStart(start, range.startOffset); mapped.setEnd(end, range.endOffset); return mapped;
}
function commitClonedPage(clone) {
  // Chromium can leave a ghost table when replacing all content ending in a table,
  // and attempting to undo that failed insertion can corrupt the undo history.
  let tail = page.lastChild;
  while (tail) { while (tail && tail.nodeType === Node.TEXT_NODE && !tail.data.trim()) tail = tail.previousSibling; if (!tail) break; if (tail.nodeType === Node.ELEMENT_NODE && tail.matches('table')) { toast('Add a paragraph after the final table before using this command', 'info'); return false; } if (tail.lastChild) tail = tail.lastChild; else break; }
  if (page.querySelector('script,style,iframe,object,embed,[contenteditable="false"]')) { toast('This page contains protected or embedded content that cannot be safely transformed', 'error'); return false; }
  const expected = clone.innerHTML, original = page.innerHTML;
  clearImageSelection();
  const all = document.createRange(); all.selectNodeContents(page); page.focus();
  const selection = getSelection(); selection.removeAllRanges(); selection.addRange(all);
  programmaticEdit = true; let ok;
  try { ok = document.execCommand('insertHTML', false, expected); } finally { programmaticEdit = false; }
  if (!ok || page.innerHTML !== expected) {
    if (ok) document.execCommand('undo');
    if (page.innerHTML !== original) page.innerHTML = original;
    saveCurrentContent(); save(); toast('Change could not be applied safely; the page was restored', 'error'); return false;
  }
  editorRange = selection.rangeCount && page.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
  saveCurrentContent(); updateWordCount(); save(); syncFormatButtons(); return true;
}
function textTransformModal() {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  focusPage();
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed || !page.contains(sel.anchorNode) || !page.contains(sel.focusNode)) { toast('Select text to change first', 'info'); return; }
  const range = sel.getRangeAt(0).cloneRange(), tabId = state.activeTabId;
  openModal('Capitalization & letter spacing', `<div class="field"><label for="textCase">Capitalization</label><select id="textCase"><option value="unchanged">Leave unchanged</option><option value="upper">UPPERCASE</option><option value="lower">lowercase</option><option value="title">Title Case</option></select></div><div class="field"><label for="letterSpacing">Letter spacing in pixels (leave blank to keep)</label><input id="letterSpacing" type="number" min="-5" max="20" step="0.1" placeholder="Unchanged"></div><p>Applies to selected text in the current tab; images and other non-text content are preserved.</p>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Apply</button>`);
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    if (state.activeTabId !== tabId || !page.contains(range.commonAncestorContainer) || mode === 'viewing') { closeModal(); toast('Select the text again', 'error'); return; }
    const choice = $('#textCase').value, spacingValue = $('#letterSpacing').value, spacing = Number(spacingValue);
    if (spacingValue !== '' && (!Number.isFinite(spacing) || spacing < -5 || spacing > 20)) { toast('Choose letter spacing from -5 to 20 pixels', 'error'); return; }
    if (choice === 'unchanged' && spacingValue === '') { closeModal(); return; }
    if (page.querySelector('script,style,iframe,object,embed,[contenteditable="false"]')) { toast('This page contains protected or embedded content that cannot be safely transformed', 'error'); return; }
    const clone = page.cloneNode(true), selected = cloneRangeInPage(range, clone);
    if (!selected) { closeModal(); toast('Select the text again', 'error'); return; }
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT), pieces = []; let node;
    while ((node = walker.nextNode())) {
      if (!selected.intersectsNode(node) || node.parentElement?.closest('script,style,button,[contenteditable="false"]')) continue;
      const start = node === selected.startContainer ? selected.startOffset : 0;
      const end = node === selected.endContainer ? selected.endOffset : node.length;
      if (end > start) pieces.push({node, start, end});
    }
    if (!pieces.length) { closeModal(); toast('Select editable text to change', 'info'); return; }
    let inWord = false, previousBlock = null;
    for (const piece of pieces) {
      const block = piece.node.parentElement?.closest('p,h1,h2,h3,h4,h5,h6,blockquote,pre,li,div,td,th') || clone;
      if (block !== previousBlock) inWord = false;
      previousBlock = block;
      let value = piece.node.data.slice(piece.start, piece.end);
      if (choice === 'upper') value = value.toLocaleUpperCase();
      else if (choice === 'lower') value = value.toLocaleLowerCase();
      else if (choice === 'title') {
        value = Array.from(value, char => {
          const word = /[\p{L}\p{N}]/u.test(char);
          const result = word ? (inWord ? char.toLocaleLowerCase() : char.toLocaleUpperCase()) : char;
          inWord = word; return result;
        }).join('');
      }
      piece.value = value;
    }
    // Process from the end to keep the captured node offsets valid.
    for (const piece of pieces.reverse()) {
      const {node, start, end, value} = piece;
      if (spacingValue === '') node.replaceData(start, end - start, value);
      else {
        if (end < node.length) node.splitText(end);
        const middle = start ? node.splitText(start) : node;
        middle.data = value;
        const span = document.createElement('span'); span.style.letterSpacing = `${spacing}px`;
        middle.parentNode.insertBefore(span, middle); span.appendChild(middle);
      }
    }
    closeModal(); commitClonedPage(clone);
  });
}

// Document-wide defaults are kept separately from individual inline formatting.
// Older versions retain the optional field even though they cannot display it.
const STYLE_FONTS = ['Arial','Roboto','Georgia','Times New Roman','Courier New','Verdana','Comic Sans MS'];
const STYLE_DEFAULTS = {p:11,h1:26,h2:20,h3:15,h4:13,h5:11,h6:10};
let paragraphStyleUndo = [], paragraphStyleRedo = [];
function normalizedParagraphStyle(value, key) {
  value = value && typeof value === 'object' ? value : {};
  const size = Number(value.size), weight = Number(value.weight);
  return {font:STYLE_FONTS.includes(value.font) ? value.font : 'Arial', size:Number.isFinite(size) && size >= 6 && size <= 96 ? size : STYLE_DEFAULTS[key], color:/^#[0-9a-f]{6}$/i.test(value.color || '') ? value.color : '#000000', weight:weight === 400 || weight === 700 ? weight : key === 'p' ? 400 : 700};
}
function applyParagraphStyles() {
  const styles = state.paragraphStyles;
  if (!styles || typeof styles !== 'object') { $('#paragraphStyleRules').textContent = ''; return; }
  const rules = [];
  for (const key of Object.keys(STYLE_DEFAULTS)) {
    if (!styles[key] || typeof styles[key] !== 'object' || !['font','size','weight','color'].some(prop => Object.hasOwn(styles[key],prop))) continue;
    const v = normalizedParagraphStyle(styles[key], key);
    const selector = key === 'p' ? '.page' : `.page ${key}`;
    rules.push(`${selector}{font-family:"${v.font}";font-size:${v.size}pt;font-weight:${v.weight};color:${v.color}}`);
  }
  $('#paragraphStyleRules').textContent = rules.join('\n');
}
function paragraphStylesModal() {
  openModal('Document paragraph styles', `<p>Set defaults for all tabs and new content. Inline formatting still takes priority. These are document settings; use Undo / Redo here rather than text undo.</p><div class="field"><label for="paragraphStyleName">Style</label><select id="paragraphStyleName"><option value="p">Normal text</option>${[1,2,3,4,5,6].map(n => `<option value="h${n}">Heading ${n}</option>`).join('')}</select></div><div class="field"><label for="paragraphStyleFont">Font</label><select id="paragraphStyleFont">${STYLE_FONTS.map(font => `<option value="${esc(font)}">${esc(font)}</option>`).join('')}</select></div><div class="table-fields"><div class="field"><label for="paragraphStyleSize">Size (pt)</label><input id="paragraphStyleSize" type="number" min="6" max="96" step="0.5"></div><div class="field"><label for="paragraphStyleColor">Color</label><input id="paragraphStyleColor" type="color"></div></div><div class="field"><label for="paragraphStyleWeight">Weight</label><select id="paragraphStyleWeight"><option value="400">Regular</option><option value="700">Bold</option></select></div><p>Dark-page appearance may override the text color for readability.</p>`, `<button class="btn text" id="styleUndo">Undo</button><button class="btn text" id="styleRedo">Redo</button><button class="btn text" id="styleReset">Reset style</button><button class="btn text" id="mCancel">Close</button><button class="btn primary" id="mOk">Apply</button>`);
  const kind = $('#paragraphStyleName');
  const refresh = () => {
    const v = normalizedParagraphStyle(state.paragraphStyles?.[kind.value], kind.value);
    $('#paragraphStyleFont').value = v.font; $('#paragraphStyleSize').value = v.size; $('#paragraphStyleColor').value = v.color; $('#paragraphStyleWeight').value = String(v.weight);
    $('#styleUndo').disabled = !paragraphStyleUndo.length; $('#styleRedo').disabled = !paragraphStyleRedo.length;
  };
  const snapshot = () => structuredClone(state.paragraphStyles ?? null);
  const change = next => { paragraphStyleUndo.push(snapshot()); if (paragraphStyleUndo.length > 50) paragraphStyleUndo.shift(); paragraphStyleRedo = []; state.paragraphStyles = next; applyParagraphStyles(); save(); refresh(); };
  kind.addEventListener('change', refresh); $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    const key = kind.value, size = Number($('#paragraphStyleSize').value), color = $('#paragraphStyleColor').value, font = $('#paragraphStyleFont').value, weight = Number($('#paragraphStyleWeight').value);
    if (!Object.hasOwn(STYLE_DEFAULTS,key) || !STYLE_FONTS.includes(font) || !Number.isFinite(size) || size < 6 || size > 96 || !/^#[0-9a-f]{6}$/i.test(color) || ![400,700].includes(weight)) { toast('Choose a valid font and size from 6 to 96 points', 'error'); return; }
    const all = state.paragraphStyles && typeof state.paragraphStyles === 'object' ? {...state.paragraphStyles} : {};
    all[key] = {...(all[key] && typeof all[key] === 'object' ? all[key] : {}), font,size,color,weight}; change(all); toast('Paragraph style updated', 'format_paint');
  });
  $('#styleReset').addEventListener('click', () => {
    const all = state.paragraphStyles && typeof state.paragraphStyles === 'object' ? {...state.paragraphStyles} : {};
    if (all[kind.value] && typeof all[kind.value] === 'object') { const retained = {...all[kind.value]}; for (const prop of ['font','size','weight','color']) delete retained[prop]; if (Object.keys(retained).length) all[kind.value] = retained; else delete all[kind.value]; }
    change(all); toast('Paragraph style reset', 'restart_alt');
  });
  $('#styleUndo').addEventListener('click', () => { if (!paragraphStyleUndo.length) return; paragraphStyleRedo.push(snapshot()); state.paragraphStyles = paragraphStyleUndo.pop(); applyParagraphStyles(); save(); refresh(); });
  $('#styleRedo').addEventListener('click', () => { if (!paragraphStyleRedo.length) return; paragraphStyleUndo.push(snapshot()); state.paragraphStyles = paragraphStyleRedo.pop(); applyParagraphStyles(); save(); refresh(); });
  refresh();
}

function paragraphOptionsModal() {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  focusPage(); const selection = getSelection();
  if (!selection.rangeCount || !page.contains(selection.anchorNode) || !page.contains(selection.focusNode)) return;
  const range = selection.getRangeAt(0).cloneRange(), tabId = state.activeTabId;
  openModal('Paragraph spacing & indents', `<p>Applies to paragraphs touched by the selection in the current tab. Leave a field blank to keep its current value.</p><div class="table-fields"><div class="field"><label for="paragraphBefore">Space before (px)</label><input id="paragraphBefore" type="number" min="0" max="200" placeholder="Unchanged"></div><div class="field"><label for="paragraphAfter">Space after (px)</label><input id="paragraphAfter" type="number" min="0" max="200" placeholder="Unchanged"></div></div><div class="field"><label for="paragraphIndentMode">First-line indentation</label><select id="paragraphIndentMode"><option value="keep">Keep current indentation</option><option value="none">None</option><option value="first">First line</option><option value="hanging">Hanging</option></select></div><div class="field"><label for="paragraphIndent">Indent amount (px)</label><input id="paragraphIndent" type="number" min="0" max="200" value="24"></div>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Apply</button>`);
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    if (state.activeTabId !== tabId || !page.contains(range.commonAncestorContainer) || mode === 'viewing') { closeModal(); toast('Select the paragraphs again', 'error'); return; }
    const before = $('#paragraphBefore').value, after = $('#paragraphAfter').value, type = $('#paragraphIndentMode').value, amount = Number($('#paragraphIndent').value);
    if ((before !== '' && (!Number.isFinite(Number(before)) || Number(before) < 0 || Number(before) > 200)) || (after !== '' && (!Number.isFinite(Number(after)) || Number(after) < 0 || Number(after) > 200)) || (type !== 'keep' && type !== 'none' && (!Number.isFinite(amount) || amount < 0 || amount > 200))) { toast('Choose sizes between 0 and 200 pixels', 'error'); return; }
    if (before === '' && after === '' && type === 'keep') { closeModal(); return; }
    const clone = page.cloneNode(true), selected = cloneRangeInPage(range, clone);
    if (!selected) { closeModal(); toast('Select the paragraphs again', 'error'); return; }
    const blockSelector = 'p,h1,h2,h3,h4,h5,h6,blockquote,pre,li,div,td,th';
    const targets = new Set(), bare = new Set();
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT); let node;
    while ((node = walker.nextNode())) {
      if (!selected.intersectsNode(node) || node.parentElement?.closest('script,style,button,[contenteditable="false"]')) continue;
      if (!selected.collapsed && ((node === selected.startContainer && selected.startOffset === node.length) || (node === selected.endContainer && selected.endOffset === 0))) continue;
      const block = node.parentElement?.closest(blockSelector);
      if (!block || block === clone || !clone.contains(block)) bare.add(node); else targets.add(block);
    }
    // A collapsed caret in an empty paragraph has no text node.
    if (selected.collapsed && !targets.size && !bare.size) {
      const at = selected.startContainer.nodeType === Node.ELEMENT_NODE ? selected.startContainer : selected.startContainer.parentElement;
      const block = at?.closest(blockSelector);
      if (block && block !== clone && clone.contains(block)) targets.add(block);
      else if (!clone.childNodes.length) { const p = document.createElement('p'); p.appendChild(document.createElement('br')); clone.appendChild(p); targets.add(p); }
      else { const first = clone.firstChild; if (first) bare.add(first); }
    }
    // Wrap bare inline content on the page in a block, preserving its nodes.
    for (const leaf of bare) {
      let top = leaf; while (top.parentNode && top.parentNode !== clone) top = top.parentNode;
      if (top.parentNode !== clone) continue;
      const isBlock = n => n.nodeType === Node.ELEMENT_NODE && /^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|UL|OL|TABLE|HR|SECTION|FIGURE)$/.test(n.tagName);
      let first = top; while (first.previousSibling && !isBlock(first.previousSibling)) first = first.previousSibling;
      let last = top; while (last.nextSibling && !isBlock(last.nextSibling)) last = last.nextSibling;
      const end = last.nextSibling, wrapper = document.createElement('div'); clone.insertBefore(wrapper, first);
      while (first && first !== end) { const next = first.nextSibling; wrapper.appendChild(first); first = next; }
      targets.add(wrapper);
    }
    if (!targets.size) { closeModal(); toast('No editable paragraphs in the selection', 'info'); return; }
    if ([...targets].some(block => /^(TD|TH)$/.test(block.tagName) && block.querySelector('table,ul,ol,p,div,blockquote,pre,h1,h2,h3,h4,h5,h6'))) { closeModal(); toast('Select a paragraph inside the cell instead', 'info'); return; }
    targets.forEach(originalBlock => {
      let block = originalBlock;
      if (/^(TD|TH)$/.test(block.tagName)) { const wrapper = document.createElement('div'); while (block.firstChild) wrapper.appendChild(block.firstChild); block.appendChild(wrapper); block = wrapper; }
      if (before !== '') block.style.marginTop = `${Number(before)}px`;
      if (after !== '') block.style.marginBottom = `${Number(after)}px`;
      if (type === 'none') { block.style.textIndent = '0px'; block.style.removeProperty('margin-left'); }
      else if (type === 'first') { block.style.textIndent = `${amount}px`; block.style.removeProperty('margin-left'); }
      else if (type === 'hanging') { block.style.textIndent = `${-amount}px`; block.style.marginLeft = `${amount}px`; }
    });
    closeModal(); commitClonedPage(clone);
  });
}

function listOptionsModal() {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  focusPage(); const selection = getSelection();
  if (!selection.rangeCount || !page.contains(selection.anchorNode)) return;
  const node = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
  const list = node?.closest('ol,ul');
  if (!list || !page.contains(list)) { toast('Place the caret in a list first', 'info'); return; }
  const range = selection.getRangeAt(0).cloneRange(), tabId = state.activeTabId, ordered = list.tagName === 'OL';
  const options = ordered ? [['decimal','1, 2, 3'],['lower-alpha','a, b, c'],['upper-alpha','A, B, C'],['lower-roman','i, ii, iii'],['upper-roman','I, II, III']] : [['disc','Disc'],['circle','Circle'],['square','Square']];
  openModal('List options', `<div class="field"><label for="listMarker">Marker style</label><select id="listMarker"><option value="">Keep current style</option>${options.map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>${ordered ? `<div class="field"><label for="listNumberMode">Numbering</label><select id="listNumberMode"><option value="keep">Keep current numbering</option><option value="start">Restart at a number</option><option value="continue">Continue previous list</option></select></div><div class="field"><label for="listStart">Start number</label><input type="number" id="listStart" min="-1000000" max="1000000" value="1"></div>` : ''}<p>Applies to the current list in this tab; nested lists retain their own styles.</p>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Apply</button>`);
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    if (state.activeTabId !== tabId || !page.contains(list) || !page.contains(range.commonAncestorContainer) || mode === 'viewing') { closeModal(); toast('Select the list again', 'error'); return; }
    const clone = page.cloneNode(true), mapped = cloneRangeInPage(range, clone);
    const n = mapped?.startContainer.nodeType === Node.ELEMENT_NODE ? mapped.startContainer : mapped?.startContainer.parentElement;
    const target = n?.closest('ol,ul'), marker = $('#listMarker').value;
    if (!target || !clone.contains(target)) { closeModal(); toast('Select the list again', 'error'); return; }
    if (marker && !options.some(([value]) => value === marker)) return;
    if (marker) target.style.listStyleType = marker;
    if (ordered) {
      const action = $('#listNumberMode').value;
      if (action === 'start') {
        const value = Number($('#listStart').value);
        if (!Number.isInteger(value) || value < -1000000 || value > 1000000) { toast('Choose a valid start number', 'error'); return; }
        target.setAttribute('start', String(value));
      } else if (action === 'continue') {
        let previous = target.previousElementSibling;
        while (previous && previous.tagName !== 'OL') previous = previous.previousElementSibling;
        if (!previous) { toast('No earlier numbered list in this section', 'info'); return; }
        const items = [...previous.children].filter(child => child.tagName === 'LI');
        const step = previous.hasAttribute('reversed') ? -1 : 1;
        let next = previous.hasAttribute('start') ? Number(previous.getAttribute('start')) : step < 0 ? items.length : 1;
        for (const item of items) { if (item.hasAttribute('value') && Number.isInteger(Number(item.getAttribute('value')))) next = Number(item.getAttribute('value')); next += step; }
        target.setAttribute('start', String(next));
      }
    }
    closeModal(); commitClonedPage(clone);
  });
}

function selectionBlock() {
  const sel = getSelection();
  if (!sel.rangeCount) return null;
  let n = sel.anchorNode;
  while (n && !['H1','H2','H3','H4','H5','H6','P','BLOCKQUOTE','PRE','LI'].includes(n.nodeName)) n = n.parentNode;
  return n;
}

const toolbarActions = {
  undo: () => exec('undo'),
  redo: () => exec('redo'),
  print: () => showPaginationPreview(),
  spellcheck: () => {
    const on = spellingEnabled;
    spellingEnabled = !on;
    page.spellcheck = spellingEnabled && !customSpellingActive;
    scheduleSpellHighlights();
    toast(on ? 'Spellcheck off' : (customSpellingActive ? 'Spellcheck on' : 'Browser spellcheck on; personal words may still be underlined'), 'spellcheck');
  },
  paint: paintFormat,
  bold: () => exec('bold'),
  italic: () => exec('italic'),
  underline: () => exec('underline'),
  strike: () => exec('strikeThrough'),
  superscript: () => exec('superscript'),
  subscript: () => exec('subscript'),
  link: linkModal,
  image: imageModal,
  checklist: () => exec('insertHTML', '<ul class="checklist"><li><input type="checkbox" contenteditable="false"> Task</li></ul><p><br></p>'),

  bullets: () => exec('insertUnorderedList'),
  numbering: () => exec('insertOrderedList'),
  indent: () => exec('indent'),
  outdent: () => exec('outdent'),
  clear: clearFormatting,
  'fontsize-inc': () => changeFontSize(1),
  'fontsize-dec': () => changeFontSize(-1),
};

function applyFontSize(size) {
  size = Math.min(72, Math.max(6, Math.round(Number(size) || 12)));
  $('#fontSizeInput').value = size;
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  focusPage();
  // execCommand preserves the browser's editing and undo behavior across blocks.
  // Convert only newly created size markers to the exact requested point size.
  const existing = new Set(page.querySelectorAll('font[size="7"]'));
  const collapsed = getSelection().isCollapsed;
  pendingFontSize = collapsed ? { size, existing } : null;
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  page.querySelectorAll('font[size="7"]').forEach(font => {
    if (!existing.has(font)) { font.removeAttribute('size'); font.style.fontSize = `${size}pt`; }
  });
  const sel = getSelection();
  if (sel.rangeCount && page.contains(sel.anchorNode)) editorRange = sel.getRangeAt(0).cloneRange();
  saveCurrentContent(); updateWordCount(); save();
}
function changeFontSize(delta) {
  applyFontSize((parseInt($('#fontSizeInput').value, 10) || 12) + delta);
}

function setZoom(z) {
  state.zoom = z;
  $('#zoomLabel').textContent = z + '%';
  const scale = z / 100;
  const wrap = $('#pageWrap');
  wrap.style.transform = `scale(${scale})`;
  wrap.style.setProperty('--view-scale', scale);
  wrap.style.marginBottom = `${(scale - 1) * page.offsetHeight}px`;
  $$('#zoomMenu button').forEach(b => b.classList.toggle('active', +b.dataset.zoom === z));
  buildRuler();
  save();
}

function setStyle(style) {
  const map = { p: 'P', h1: 'H1', h2: 'H2', h3: 'H3', h4: 'H4', h5: 'H5', h6: 'H6', blockquote: 'BLOCKQUOTE', code: 'PRE' };
  exec('formatBlock', map[style] || 'P');
  const labels = { p: 'Normal text', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6', blockquote: 'Quote', code: 'Code' };
  $('#styleLabel').textContent = labels[style] || 'Normal text';
  $$('#styleMenu button').forEach(b => b.classList.toggle('active', b.dataset.style === style));
}

function setFont(name) {
  exec('fontName', name);
  $('#fontLabel').textContent = name;
  $$('#fontMenu button').forEach(b => b.classList.toggle('active', b.dataset.font === name));
}

// A compact set of spectrum swatches plus a native picker for any RGB color.
function hsvHex(hue, saturation, value) {
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = value - chroma;
  const [r, g, b] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return '#' + [r, g, b].map(n => Math.round((n + m) * 255).toString(16).padStart(2, '0')).join('');
}
const PALETTE_COLORS = [
  ...Array.from({length: 10}, (_, i) => hsvHex(0, 0, 1 - i / 9)),
  ...[ [0.28, 1], [0.5, 1], [0.75, 1], [0.95, 0.9], [0.9, 0.65], [0.8, 0.4] ]
    .flatMap(([sat, val]) => Array.from({length: 10}, (_, i) => hsvHex(i * 36, sat, val)))
];
function buildPalettes() {
  for (const [menuId, command, barId, label, initial] of [
    ['colorMenu', 'foreColor', 'colorBar', 'Text color', '#000000'],
    ['highlightMenu', 'hiliteColor', 'highlightBar', 'Highlight color', '#fff59d'],
  ]) {
    const menu = $('#' + menuId);
    menu.innerHTML = `<div class="palette-title">${label}</div>
      <div class="color-grid">${PALETTE_COLORS.map(c => `<button type="button" class="swatch" data-color="${c}" style="background:${c}" title="${c.toUpperCase()}" aria-label="${label} ${c.toUpperCase()}"></button>`).join('')}</div>
      <div class="custom-color"><label for="${menuId}Picker">Custom</label><input id="${menuId}Picker" class="custom-color-picker" type="color" value="${initial}" aria-label="Choose custom ${label.toLowerCase()}"><input class="custom-color-hex" aria-label="${label} hex value" spellcheck="false" maxlength="7" value="${initial.toUpperCase()}"><button type="button" class="custom-color-apply">Apply</button></div>`;
    const picker = menu.querySelector('.custom-color-picker');
    const hex = menu.querySelector('.custom-color-hex');
    const apply = color => {
      if (!/^#[0-9a-f]{6}$/i.test(color)) { toast('Enter a six-digit hex color, such as #336699', 'error'); hex.focus(); return; }
      $('#' + barId).style.background = color;
      exec(command, color); closeMenus();
    };
    menu.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => apply(button.dataset.color)));
    picker.addEventListener('input', () => { hex.value = picker.value.toUpperCase(); });
    hex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) picker.value = hex.value; });
    hex.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(hex.value.trim()); } });
    menu.querySelector('.custom-color-apply').addEventListener('click', () => apply(hex.value.trim()));
  }
}

/* Image controls are separate from the editable document, so merely selecting
   an image never modifies stored HTML. Resizes are stored in the image style. */
function clearImageSelection() {
  cancelImageResize();
  selectedImage = null;
  $('#imageControls').classList.add('hidden');
}
function updateImageControls() {
  const controls = $('#imageControls');
  if (!selectedImage || !page.contains(selectedImage) || mode === 'viewing') { clearImageSelection(); return; }
  const rect = selectedImage.getBoundingClientRect();
  const view = $('#pageScroll').getBoundingClientRect();
  if (!rect.width || !rect.height || rect.right < view.left || rect.left > view.right || rect.bottom < view.top || rect.top > view.bottom) {
    controls.classList.add('hidden'); return;
  }
  controls.classList.remove('hidden');
  Object.assign(controls.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
  const top = Math.max(-18, view.top - rect.top), right = Math.max(-18, rect.right - view.right);
  const bottom = Math.max(-18, rect.bottom - view.bottom), left = Math.max(-Math.max(18, 122 - rect.width), view.left - rect.left);
  controls.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
}
// Preview changes only the DOM. At commit, restore the original, then replace
// the image (or its inline wrapper) through the browser's native undo stack.
function restoreImageStyle(image, style) {
  if (style === null) image.removeAttribute('style'); else image.setAttribute('style', style);
}
function cancelImageResize() {
  if (!activeImageResize) return;
  const { image, originalStyle } = activeImageResize;
  activeImageResize = null;
  restoreImageStyle(image, originalStyle);
  if (selectedImage === image && page.contains(image)) updateImageControls();
}
function beginImageResize() {
  if (activeImageResize || !selectedImage || !page.contains(selectedImage) || mode === 'viewing') return false;
  const bounds = selectedImage.getBoundingClientRect(), scale = pageGeometry()?.scale || 1, computed = getComputedStyle(selectedImage);
  if (!bounds.width || !bounds.height) return false;
  // CSS rotation changes the bounding rectangle but not the image's layout size.
  const width = parseFloat(computed.width) || bounds.width / scale, height = parseFloat(computed.height) || bounds.height / scale;
  activeImageResize = { image: selectedImage, originalStyle: selectedImage.getAttribute('style'), width, height, changed: false };
  return true;
}
function previewImageResize(width) {
  const edit = activeImageResize;
  if (!edit || selectedImage !== edit.image || !page.contains(edit.image)) return;
  const container = edit.image.closest('td,th,p,div,blockquote') || page;
  const computed = getComputedStyle(container);
  const available = container.clientWidth - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight);
  const maxWidth = Math.max(1, available);
  const newWidth = Math.min(maxWidth, Math.max(Math.min(24, maxWidth), width));
  if (!Number.isFinite(newWidth)) return;
  edit.changed = Math.abs(newWidth - edit.width) >= 0.01;
  if (!edit.changed) restoreImageStyle(edit.image, edit.originalStyle);
  else {
    edit.image.style.width = `${Math.round(newWidth * 100) / 100}px`;
    edit.image.style.height = 'auto';
    edit.image.style.aspectRatio = `${Math.round(edit.width * 100) / 100} / ${Math.round(edit.height * 100) / 100}`;
  }
  updateImageControls();
}
function commitImageResize() {
  const edit = activeImageResize;
  if (!edit) return;
  activeImageResize = null;
  if (!edit.changed || !page.contains(edit.image) || selectedImage !== edit.image || mode === 'viewing') {
    restoreImageStyle(edit.image, edit.originalStyle); updateImageControls(); return;
  }
  const imageIndex = $$('#page img').indexOf(edit.image);
  // Replacing an image alone can drop links or inline formatting in Chromium.
  // Include its outer inline wrapper while leaving paragraphs/tables intact.
  let target = edit.image;
  while (target.parentElement && target.parentElement !== page &&
      !/^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|LI|TD|TH|FIGURE|FIGCAPTION)$/.test(target.parentElement.tagName)) {
    target = target.parentElement;
  }
  const replacement = target.outerHTML;
  restoreImageStyle(edit.image, edit.originalStyle);
  const range = document.createRange(); range.selectNode(target);
  page.focus(); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  programmaticEdit = true;
  let inserted;
  try { inserted = document.execCommand('insertHTML', false, replacement); } finally { programmaticEdit = false; }
  if (!inserted) { clearImageSelection(); toast('Could not resize this image', 'error'); return; }
  selectedImage = $$('#page img')[imageIndex] || null;
  editorRange = selection.rangeCount && page.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
  saveCurrentContent(); updateWordCount(); save(); updateImageControls();
}
// Replacing an image's inline wrapper keeps links and attributes and uses the
// browser's undo history. Metadata changes never mutate stored HTML in place.
function updateImageMarkup(image, tabId, change) {
  if (state.activeTabId !== tabId || !page.contains(image) || mode === 'viewing') { toast('Select the image again', 'error'); return false; }
  let target = image;
  while (target.parentElement && target.parentElement !== page && !/^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|LI|TD|TH|FIGURE|FIGCAPTION)$/.test(target.parentElement.tagName)) target = target.parentElement;
  const index = $$('#page img').indexOf(image), nested = target === image ? 0 : [...target.querySelectorAll('img')].indexOf(image);
  const copy = target.cloneNode(true), copiedImage = target === image ? copy : copy.querySelectorAll('img')[nested];
  if (!copiedImage) return false;
  change(copiedImage);
  const range = document.createRange(); range.selectNode(target); page.focus();
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  programmaticEdit = true;
  let inserted;
  try { inserted = document.execCommand('insertHTML', false, copy.outerHTML); } finally { programmaticEdit = false; }
  if (!inserted) { toast('Could not update the image', 'error'); return false; }
  selectedImage = $$('#page img')[index] || null;
  editorRange = sel.rangeCount && page.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  saveCurrentContent(); save(); updateImageControls();
  return true;
}
function editImageAdjustments() {
  const image = selectedImage, tabId = state.activeTabId;
  if (!image || !page.contains(image) || mode === 'viewing') return;
  let crop = [0,0,0,0];
  try { const data = JSON.parse(image.dataset.megadocCrop || 'null'); if (Array.isArray(data?.insets) && data.insets.length === 4 && data.insets.every(Number.isFinite)) crop = data.insets; } catch {}
  openModal('Image adjustments', `<div class="field"><label for="imageRotation">Rotation</label><select id="imageRotation"><option value="keep">Keep current rotation</option><option value="0">0°</option><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">270° clockwise</option></select></div><p>Rotation does not rearrange surrounding text; rotated images may overlap nearby content.</p><div class="field"><label><input type="checkbox" id="imageCropApply"> Set crop from original image</label></div><div class="table-fields">${['Top','Right','Bottom','Left'].map((side,i)=>`<div class="field"><label for="crop${side}">${side} (%)</label><input id="crop${side}" type="number" min="0" max="99" step="0.1" value="${crop[i]}"></div>`).join('')}</div><p><label><input type="checkbox" id="imageCropReset"> Remove crop and restore previous proportions</label></p><p>Crop is non-destructive and requires browser support for CSS object-view-box. The original source is retained.</p><div class="field"><label><input type="checkbox" id="imageBorderApply"> Set border</label></div><div class="table-fields"><div class="field"><label for="imageBorderWidth">Border width (px; 0 removes)</label><input id="imageBorderWidth" type="number" min="0" max="20" step="1" value="1"></div><div class="field"><label for="imageBorderColor">Border color</label><input id="imageBorderColor" type="color" value="#000000"></div></div>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Apply</button>`);
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    if (state.activeTabId !== tabId || !page.contains(image) || mode === 'viewing') { closeModal(); toast('Select the image again', 'error'); return; }
    const rotate = $('#imageRotation').value, doCrop = $('#imageCropApply').checked, reset = $('#imageCropReset').checked, border = $('#imageBorderApply').checked;
    const insets = ['Top','Right','Bottom','Left'].map(side => Number($(`#crop${side}`).value)), borderWidth = Number($('#imageBorderWidth').value), borderColor = $('#imageBorderColor').value;
    if (!['keep','0','90','180','270'].includes(rotate) || (border && (!Number.isInteger(borderWidth) || borderWidth < 0 || borderWidth > 20 || !/^#[0-9a-f]{6}$/i.test(borderColor))) || (doCrop && (insets.some(n => !Number.isFinite(n) || n < 0 || n >= 100) || insets[0] + insets[2] >= 100 || insets[1] + insets[3] >= 100)) || (doCrop && reset)) { toast('Choose valid crop and border values', 'error'); return; }
    if (rotate !== 'keep' && !CSS.supports('rotate','90deg')) { toast('This browser does not support image rotation', 'info'); return; }
    if ((doCrop || reset) && !CSS.supports('object-view-box','inset(1%)')) { toast('This browser does not support non-destructive cropping', 'info'); return; }
    if (doCrop && (!image.naturalWidth || !image.naturalHeight)) { toast('Wait for the image to load before cropping', 'info'); return; }
    if (rotate === 'keep' && !doCrop && !reset && !border) { closeModal(); return; }
    let previous = null; try { previous = JSON.parse(image.dataset.megadocCrop || 'null'); } catch {}
    if (reset && (!previous || !previous.original || !Array.isArray(previous.insets))) { toast('This image does not have a MegaDoc crop to remove', 'info'); return; }
    const ratio = doCrop ? `${image.naturalWidth * (100-insets[1]-insets[3])} / ${image.naturalHeight * (100-insets[0]-insets[2])}` : '';
    const imageGeometry = getComputedStyle(image), currentWidth = parseFloat(imageGeometry.width), currentHeight = parseFloat(imageGeometry.height);
    closeModal();
    updateImageMarkup(image, tabId, copy => {
      if (rotate !== 'keep') copy.style.rotate = `${rotate}deg`;
      if (doCrop) {
        const original = previous?.original || {height:copy.style.height, aspectRatio:copy.style.aspectRatio, objectViewBox:copy.style.getPropertyValue('object-view-box'), widthAtCrop:currentWidth, heightAtCrop:currentHeight};
        copy.dataset.megadocCrop = JSON.stringify({insets,original});
        copy.style.setProperty('object-view-box', `inset(${insets.map(n=>`${n}%`).join(' ')})`); copy.style.height = 'auto'; copy.style.aspectRatio = ratio;
      } else if (reset) {
        const original = previous.original;
        copy.style.height = typeof original.height === 'string' ? original.height : '';
        copy.style.aspectRatio = typeof original.aspectRatio === 'string' ? original.aspectRatio : '';
        if (Number.isFinite(original.widthAtCrop) && Number.isFinite(original.heightAtCrop) && original.widthAtCrop > 0 && original.heightAtCrop > 0 && Math.abs(currentWidth - original.widthAtCrop) > .5) { copy.style.height = 'auto'; copy.style.aspectRatio = `${original.widthAtCrop} / ${original.heightAtCrop}`; }
        if (typeof original.objectViewBox === 'string' && original.objectViewBox) copy.style.setProperty('object-view-box',original.objectViewBox); else copy.style.removeProperty('object-view-box');
        delete copy.dataset.megadocCrop;
      }
      if (border) { copy.style.borderStyle = 'solid'; copy.style.borderWidth = `${borderWidth}px`; copy.style.borderColor = borderColor; }
    });
  });
}
function editImageAlt() {
  const image = selectedImage, tabId = state.activeTabId;
  if (!image || !page.contains(image) || mode === 'viewing') return;
  openModal('Image alt text', `<div class="field"><label for="imageDescription">Description</label><textarea id="imageDescription" rows="3">${esc(image.getAttribute('alt') || '')}</textarea></div><div class="field"><label for="imageTitle">Title (optional)</label><input id="imageTitle" value="${esc(image.getAttribute('title') || '')}"></div><p>Describe what the image conveys. Leave the description empty for a decorative image.</p>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Apply</button>`);
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    const alt = $('#imageDescription').value, title = $('#imageTitle').value;
    closeModal();
    updateImageMarkup(image, tabId, copy => { copy.setAttribute('alt', alt); if (title) copy.setAttribute('title', title); else copy.removeAttribute('title'); });
  });
}
function editImageLayout() {
  const image = selectedImage, tabId = state.activeTabId;
  if (!image || !page.contains(image) || mode === 'viewing') return;
  const style = image.style;
  const layout = style.float === 'left' ? 'left' : style.float === 'right' ? 'right' : style.display === 'block' ? 'break' : 'inline';
  const gap = Number.parseFloat(style.marginTop) || 0;
  openModal('Image text layout', `<div class="field"><label for="imageLayout">Layout</label><select id="imageLayout"><option value="inline">In line with text</option><option value="left">Wrap text, image on left</option><option value="right">Wrap text, image on right</option><option value="break">Break text</option></select></div><div class="field"><label for="imageGap">Space around image (pixels)</label><input type="number" id="imageGap" min="0" max="100" step="1" value="${Math.max(0, Math.min(100, Math.round(gap)))}"></div><p>Wrapped images move with the surrounding text. Use paragraph alignment to position inline or break-text images.</p>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Apply</button>`);
  $('#imageLayout').value = layout;
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    const choice = $('#imageLayout').value, margin = Number($('#imageGap').value);
    if (!Number.isFinite(margin) || margin < 0 || margin > 100) { toast('Choose a spacing from 0 to 100 pixels', 'error'); return; }
    closeModal();
    updateImageMarkup(image, tabId, copy => {
      const css = copy.style;
      css.display = choice === 'inline' ? 'inline' : 'block';
      css.float = choice === 'left' || choice === 'right' ? choice : 'none';
      css.clear = choice === 'break' ? 'both' : 'none';
      css.marginTop = css.marginBottom = `${margin}px`;
      if (choice === 'break') { css.removeProperty('margin-left'); css.removeProperty('margin-right'); }
      else css.marginLeft = css.marginRight = `${margin}px`;
    });
  });
}
function deleteSelectedImage() {
  if (!selectedImage || !page.contains(selectedImage) || mode === 'viewing') return;
  const range = document.createRange(); range.selectNode(selectedImage);
  page.focus(); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  programmaticEdit = true;
  try { document.execCommand('insertHTML', false, ''); } finally { programmaticEdit = false; }
  clearImageSelection();
  editorRange = selection.rangeCount && page.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
  saveCurrentContent(); updateWordCount(); save();
}
function wireImageControls() {
  const controls = $('#imageControls'), resize = $('#imageResize');
  page.addEventListener('click', e => {
    const img = e.target.closest('img');
    if (img && page.contains(img) && mode !== 'viewing') {
      e.preventDefault(); selectedImage = img; updateImageControls();
    } else clearImageSelection();
  });
  page.addEventListener('keydown', e => {
    if (!selectedImage) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); deleteSelectedImage(); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key) || (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1)) clearImageSelection();
  });
  document.addEventListener('click', e => {
    // Keep the image as the alignment target while using editor menus.
    if (selectedImage && !page.contains(e.target) && !controls.contains(e.target) &&
        !e.target.closest('#toolbar, #menubar, #menuDropdown')) clearImageSelection();
  });
  $('#imageDelete').addEventListener('click', deleteSelectedImage);
  $('#imageAlt').addEventListener('click', editImageAlt);
  $('#imageAdjust').addEventListener('click', editImageAdjustments);
  $('#imageLayoutButton').addEventListener('click', editImageLayout);
  resize.addEventListener('pointerdown', e => {
    if (!beginImageResize()) return;
    e.preventDefault(); e.stopPropagation();
    const edit = activeImageResize, scale = pageGeometry()?.scale || 1, startX = e.clientX;
    resize.setPointerCapture(e.pointerId);
    const move = ev => { if (activeImageResize === edit) previewImageResize(edit.width + (ev.clientX - startX) / scale); };
    const finish = ev => {
      resize.removeEventListener('pointermove', move); resize.removeEventListener('pointerup', finish); resize.removeEventListener('pointercancel', finish);
      if (activeImageResize !== edit) return;
      if (ev.type === 'pointercancel') cancelImageResize(); else commitImageResize();
    };
    resize.addEventListener('pointermove', move); resize.addEventListener('pointerup', finish); resize.addEventListener('pointercancel', finish);
  });
  resize.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || !beginImageResize()) return;
    e.preventDefault();
    const edit = activeImageResize;
    previewImageResize(edit.width + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 20 : 5));
    commitImageResize();
    if (selectedImage) resize.focus();
  });
  controls.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (mod && !e.altKey && (key === 'z' || key === 'y')) {
      e.preventDefault(); e.stopPropagation();
      exec(key === 'y' || e.shiftKey ? 'redo' : 'undo');
    }
  });
}

function setMode(m) {
  mode = m;
  scheduleSpellHighlights();
  if (m === 'viewing') clearImageSelection();
  syncFormatButtons();
  $('#modeLabel').textContent = m[0].toUpperCase() + m.slice(1);
  $$('#modeMenu button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  document.body.classList.toggle('viewing', m === 'viewing');
  page.contentEditable = m === 'viewing' || !getTab(state.activeTabId) ? 'false' : 'true';
  $('#modeBanner').classList.toggle('show', m === 'suggesting');
  toast(m === 'viewing' ? 'Viewing mode — editing disabled' : m === 'suggesting' ? 'Suggesting mode' : 'Editing mode', 'edit');
}

let paintedFormat = null;
function paintFormat() {
  if (!getTab(state.activeTabId)) { toast('Create a tab first', 'error'); return; }
  focusPage();
  paintedFormat = { bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline') };
  toast('Select text to apply the copied formatting', 'format_paint');
}
page.addEventListener('mouseup', () => {
  if (!paintedFormat || getSelection().isCollapsed || mode === 'viewing') return;
  for (const cmd of ['bold','italic','underline']) if (document.queryCommandState(cmd) !== paintedFormat[cmd]) document.execCommand(cmd);
  paintedFormat = null; saveCurrentContent(); save(); toast('Formatting applied', 'format_paint');
});
page.addEventListener('click', e => {
  if (e.target.matches('.checklist input[type=checkbox]') && mode !== 'viewing') {
    e.target.toggleAttribute('checked', e.target.checked); saveCurrentContent(); save();
  }
});
function clipboardCommand(command) {
  if (!getTab(state.activeTabId) || (command === 'cut' && mode === 'viewing')) { toast('Open an editable tab first', 'error'); return; }
  focusPage();
  if (!document.execCommand(command)) toast(`Browser blocked ${command}. Use your keyboard shortcut instead.`, 'content_copy');
  else if (command === 'cut') { saveCurrentContent(); updateWordCount(); save(); }
}
async function pasteAction() {
  const tab = getTab(state.activeTabId);
  if (!tab || mode === 'viewing') { toast('Open an editable tab first', 'error'); return; }
  focusPage();
  const selection = getSelection();
  if (!selection.rangeCount || !page.contains(selection.anchorNode) || !page.contains(selection.focusNode)) { toast('Place the caret in the document first', 'info'); return; }
  const id = state.activeTabId, range = selection.getRangeAt(0).cloneRange(), original = page.innerHTML;
  try {
    let html = '', text = '';
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (!html && item.types.includes('text/html')) html = await (await item.getType('text/html')).text();
        if (!text && item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text();
        if (html || text) break;
      }
    } else if (navigator.clipboard?.readText) text = await navigator.clipboard.readText();
    else throw new Error('Clipboard access unavailable');
    const current = getSelection();
    if (state.activeTabId !== id || getTab(id) !== tab || mode === 'viewing' || page.innerHTML !== original || !page.contains(range.commonAncestorContainer) || !current.rangeCount || current.getRangeAt(0).compareBoundaryPoints(Range.START_TO_START, range) !== 0 || current.getRangeAt(0).compareBoundaryPoints(Range.END_TO_END, range) !== 0) { toast('Document or selection changed; paste again', 'info'); return; }
    page.focus(); current.removeAllRanges(); current.addRange(range);
    insertClipboardContent(html, text);
  } catch { toast('Clipboard access unavailable. Use Ctrl+V or your browser paste shortcut.', 'content_paste'); }
}
/* ─────────────────────────── Menus ─────────────────────────── */
function closeMenus() {
  $('#contextMenu').classList.add('hidden');
  $('#menuDropdown').classList.add('hidden');
  $$('.tb-dropdown.open').forEach(d => d.classList.remove('open'));
  $$('.menu-item.open').forEach(m => m.classList.remove('open'));
}
document.addEventListener('click', e => {
  if (!e.target.closest('.context-menu,.menu-dropdown,.tb-dropdown,.menu-item,.tab-dots')) closeMenus();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });

const MENUS = [
  { label: 'File', items: [
    { icon: 'note_add', label: 'New tab', shortcut: 'Ctrl+Alt+N', fn: () => addTab(null) },
    { icon: 'add_circle', label: 'New subtab', fn: () => addTab(state.activeTabId) },
    { sep: true },
    { icon: 'download', label: 'Export as JSON', fn: exportJSON },
    { icon: 'upload', label: 'Import JSON…', fn: () => $('#importFile').click() },
    { icon: 'upload_file', label: 'Import text, HTML, DOCX or ODT as a new tab…', fn: localImportDialog },
    { icon: 'text_snippet', label: 'Export current tab as text', fn: () => exportLocalContent('text') },
    { icon: 'html', label: 'Export current tab as HTML', fn: () => exportLocalContent('html') },
    { icon: 'description', label: 'Export current tab as DOCX…', fn: () => exportOfficeDialog('docx') },
    { icon: 'description', label: 'Export current tab as ODT…', fn: () => exportOfficeDialog('odt') },
    { icon: 'cloud_upload', label: 'Export current tab to Google Docs…', fn: googleDocsExportDialog },
    { icon: 'restore', label: 'Restore previous local document…', fn: restoreLegacy },
    { sep: true },
    { icon: 'description', label: 'Page setup…', fn: showPageSetup },
    { icon: 'view_headline', label: 'Headers, footers & page numbers…', fn: printLayoutModal },
    { icon: 'print', label: 'Print', shortcut: 'Ctrl+P', fn: () => toolbarActions.print() },
    { icon: 'info', label: 'Document details', fn: showDetails },
    { sep: true },
    { icon: 'delete_forever', label: 'Reset MegaDoc (delete all)', danger: true, fn: resetAll },
  ]},
  { label: 'Settings', items: [
    { icon: 'palette', label: 'Appearance…', fn: showAppearance },
    { icon: 'edit_note', label: 'Writing preferences…', fn: showWritingSettings },
  ]},
  { label: 'Edit', items: [
    { icon: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', fn: () => exec('undo') },
    { icon: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', fn: () => exec('redo') },
    { sep: true },
    { icon: 'content_cut', label: 'Cut', shortcut: 'Ctrl+X', fn: () => clipboardCommand('cut') },
    { icon: 'content_copy', label: 'Copy', shortcut: 'Ctrl+C', fn: () => clipboardCommand('copy') },
    { icon: 'content_paste', label: 'Paste', shortcut: 'Ctrl+V', fn: pasteAction },
    { sep: true },
    { icon: 'select_all', label: 'Select all', shortcut: 'Ctrl+A', fn: () => exec('selectAll') },
    { icon: 'find_replace', label: 'Find in tab', shortcut: 'Ctrl+F', fn: findInTab },
  ]},
  { label: 'View', items: [
    { icon: 'view_sidebar', label: 'Toggle tabs panel', fn: () => togglePanel() },
    { icon: 'description', label: 'Page view / pageless…', fn: tabViewModal },
    { icon: 'picture_as_pdf', label: 'Paginated preview', fn: showPaginationPreview },
    { icon: 'zoom_in', label: 'Zoom in', shortcut: 'Ctrl++', fn: () => setZoom(Math.min(200, state.zoom + 25)) },
    { icon: 'zoom_out', label: 'Zoom out', shortcut: 'Ctrl+-', fn: () => setZoom(Math.max(50, state.zoom - 25)) },
    { icon: 'fullscreen', label: 'Toggle full screen', fn: async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('Full screen is unavailable in this browser', 'info'); } catch { toast('Full screen is unavailable here', 'info'); } } },
    { icon: 'keyboard_arrow_up', label: 'Hide toolbar', fn: () => document.body.classList.add('toolbar-hidden') },
  ]},
  { label: 'Insert', items: [
    { icon: 'image', label: 'Image (URL)…', fn: () => toolbarActions.image() },
    { icon: 'link', label: 'Link', shortcut: 'Ctrl+K', fn: () => toolbarActions.link() },
    { icon: 'bookmark_add', label: 'Bookmark…', fn: () => bookmarkModal() },
    { icon: 'footprint', label: 'Footnote…', fn: () => footnoteModal() },
    { icon: 'link', label: 'Link to tab, bookmark or heading…', fn: internalLinkModal },
    { icon: 'horizontal_rule', label: 'Horizontal line', fn: () => exec('insertHorizontalRule') },
    { icon: 'page-break-svg', label: 'Page break', fn: insertPageBreak },
    { icon: 'table', label: 'Table', fn: insertTable },
    { icon: 'merge', label: 'Merge table cells…', fn: () => tableCellAction('merge') },
    { icon: 'call_split', label: 'Split merged table cell', fn: () => tableCellAction('split') },
    { icon: 'functions', label: 'Equation…', fn: () => equationModal() },
    { icon: 'toc', label: 'Insert table of contents', fn: () => tocCommand('insert') },
    { icon: 'update', label: 'Update table of contents', fn: () => tocCommand('update') },
    { icon: 'delete', label: 'Remove table of contents', fn: () => tocCommand('remove') },
    { icon: 'emoji-svg', label: 'Emoji & special characters…', fn: emojiPicker },
    { icon: 'code', label: 'Code block', fn: () => setStyle('code') },
    { icon: 'note', label: 'Callout box', fn: () => exec('insertHTML', '<div class="callout">Callout text — edit me.</div><p><br></p>') },
  ]},
  { label: 'Format', items: [
    { icon: 'format_bold', label: 'Bold', shortcut: 'Ctrl+B', fn: () => exec('bold') },
    { icon: 'format_italic', label: 'Italic', shortcut: 'Ctrl+I', fn: () => exec('italic') },
    { icon: 'format_underlined', label: 'Underline', shortcut: 'Ctrl+U', fn: () => exec('underline') },
    { icon: 'format_strikethrough', label: 'Strikethrough', fn: () => exec('strikeThrough') },
    { icon: 'superscript', label: 'Superscript', shortcut: 'Ctrl+.', fn: () => exec('superscript') },
    { icon: 'subscript', label: 'Subscript', shortcut: 'Ctrl+,', fn: () => exec('subscript') },
    { sep: true },
    { icon: 'text_fields', label: 'Capitalization & letter spacing…', fn: textTransformModal },
    { icon: 'format_line_spacing', label: 'Paragraph spacing & indents…', fn: paragraphOptionsModal },
    { icon: 'format_paint', label: 'Document paragraph styles…', fn: paragraphStylesModal },
    { icon: 'format_clear', label: 'Clear formatting', fn: () => toolbarActions.clear() },
    { icon: 'format_align_left', label: 'Align left', fn: () => exec('justifyLeft') },
    { icon: 'format_align_center', label: 'Align center', fn: () => exec('justifyCenter') },
    { icon: 'format_align_right', label: 'Align right', fn: () => exec('justifyRight') },
    { icon: 'format_align_justify', label: 'Justify', fn: () => exec('justifyFull') },
    { sep: true },
    { icon: 'format_list_bulleted', label: 'Bulleted list', fn: () => exec('insertUnorderedList') },
    { icon: 'format_list_numbered', label: 'Numbered list', fn: () => exec('insertOrderedList') },
    { icon: 'format_list_numbered', label: 'List options…', fn: listOptionsModal },
  ]},
  { label: 'Tools', items: [
    { icon: 'fact_check', label: 'Word count', fn: showDetails },
    { icon: 'spellcheck', label: 'Toggle spellcheck', fn: () => toolbarActions.spellcheck() },
    { icon: 'list', label: 'Outline (all tabs)', fn: showOutline },
    { icon: 'search', label: 'Search menus', shortcut: 'Ctrl+/', fn: commandPalette },
  ]},
  { label: 'Extensions', items: [
    { icon: 'center_focus_strong', label: 'Focus mode', fn: () => { document.body.classList.toggle('focus-mode'); buildRuler(); toast(document.body.classList.contains('focus-mode') ? 'Focus mode on' : 'Focus mode off', 'center_focus_strong'); } },
    { icon: 'dark_mode', label: 'Dark page', fn: () => togglePageTheme('dark') },
  ]},
  { label: 'Help', items: [
    { icon: 'keyboard', label: 'Keyboard shortcuts', fn: showShortcuts },
    { icon: 'help', label: 'About MegaDoc', fn: showAbout },
  ]},
  { label: 'Accessibility', items: [
    { icon: 'format_size', label: 'Larger text', fn: () => setZoom(Math.min(200, state.zoom + 25)) },
    { icon: 'contrast', label: 'High contrast page', fn: () => togglePageTheme('contrast') },
  ]},
];

function buildMenubar() {
  const bar = $('#menubar');
  bar.innerHTML = MENUS.map((m, i) => `<button class="menu-item" data-menu="${i}">${m.label}</button>`).join('');
  bar.querySelectorAll('.menu-item').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = btn.classList.contains('open');
      closeMenus();
      if (!wasOpen) openMenu(+btn.dataset.menu, btn);
    });
    btn.addEventListener('mouseenter', () => {
      if ($$('.menu-item.open').length) { closeMenus(); openMenu(+btn.dataset.menu, btn); }
    });
  });
}

// Use drawn icons for symbols not present in the bundled icon font subset.
function menuIcon(icon) {
  if (icon === 'page-break-svg') return '<svg class="menu-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 15v6h12v-6M3 12h3m3 0h2m2 0h2m3 0h3"/></svg>';
  if (icon === 'emoji-svg') return '<svg class="menu-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14.5c1.1 1.5 2.4 2.2 4 2.2s2.9-.7 4-2.2M9 9.5h.01M15 9.5h.01" stroke-width="2"/></svg>';
  return `<span class="material-symbols-outlined" aria-hidden="true">${icon}</span>`;
}
function openMenu(i, anchor) {
  const menu = MENUS[i];
  const dd = $('#menuDropdown');
  dd.innerHTML = menu.items.map(it => it.sep
    ? '<div class="mi-sep"></div>'
    : `<button class="mi ${it.danger ? 'danger' : ''}" data-i="${menu.items.indexOf(it)}">${menuIcon(it.icon)}${it.label}${it.shortcut ? `<span class="shortcut">${it.shortcut}</span>` : ''}</button>`
  ).join('');
  const rect = anchor.getBoundingClientRect();
  dd.style.left = rect.left + 'px';
  dd.style.top = (rect.bottom + 2) + 'px';
  dd.classList.remove('hidden');
  anchor.classList.add('open');
  dd.querySelectorAll('.mi').forEach(b => b.addEventListener('click', () => { closeMenus(); menu.items[+b.dataset.i].fn(); }));
}

/* Suggestions use local English dictionaries because browser spellcheck does
   not expose its native suggestions to a custom context menu. */
// This dictionary belongs to MegaDoc on this browser/origin, not the browser's
// separate native spelling dictionary. Read each time so other tabs are seen.
const PERSONAL_DICTIONARY_KEY = 'megadoc-personal-dictionary-v1';
const PERSONAL_DICTIONARY_LIMIT = 5000;
function personalWordKey(word) { return word.replace(/’/g, "'").toLowerCase(); }
function personalDictionary() {
  let raw;
  try { raw = localStorage.getItem(PERSONAL_DICTIONARY_KEY); }
  catch (_) { throw new Error('Browser storage is unavailable.'); }
  if (raw === null) return new Set();
  let words;
  try { if (raw.length > 200000) throw new Error(); words=JSON.parse(raw); }
  catch (_) { throw new Error('Personal dictionary could not be read.'); }
  if (!Array.isArray(words) || words.length > PERSONAL_DICTIONARY_LIMIT || words.some(word => typeof word !== 'string' || word.length < 2 || word.length > 32 || !/^[A-Za-z]+(?:['’][A-Za-z]+)*$/.test(word))) throw new Error('Personal dictionary could not be read.');
  return new Set(words.map(personalWordKey));
}
function savePersonalWord(word, add) {
  const words=personalDictionary(), key=personalWordKey(word);
  if (add && !words.has(key) && words.size >= PERSONAL_DICTIONARY_LIMIT) throw new Error('Personal dictionary is full.');
  if (add) words.add(key); else words.delete(key);
  try { localStorage.setItem(PERSONAL_DICTIONARY_KEY,JSON.stringify([...words].sort())); }
  catch (_) { throw new Error('Could not save the personal dictionary in browser storage.'); }
}
function isPersonalWord(word) { try { return personalDictionary().has(personalWordKey(word)); } catch (_) { return false; } }
let spellingEnabled = true;
let customSpellingActive = typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined' && (!CSS.supports || CSS.supports('selector(::highlight(megadoc-spelling))'));
let spellGeneration = 0, spellTimer = null;
const spellCache = new Map();
const SPELL_HIGHLIGHT = 'megadoc-spelling';
const SPELL_EXCLUDED = '[spellcheck="false"],pre,code,[contenteditable="false"],a[data-megadoc-footnote],a[data-megadoc-bookmark]';
// The editor itself has native spellcheck disabled when custom highlights run.
function spellExcluded(element) { const found=element?.closest(SPELL_EXCLUDED); return !!found && found !== page; }
let spellWorker = null, spellSequence = 0;
const spellPending = new Map();
function stopSpellWorker(message) {
  spellWorker?.terminate(); spellWorker = null;
  for (const request of spellPending.values()) { clearTimeout(request.timer); request.reject(new Error(message)); }
  spellPending.clear();
}
function spellRequest(data) {
  return new Promise((resolve, reject) => {
    if (!spellWorker) {
      try { spellWorker = new Worker('js/spell-worker.js?v=2'); }
      catch { reject(new Error('Spelling worker unavailable')); return; }
      spellWorker.onmessage = ({data}) => {
        const pending = spellPending.get(data?.id); if (!pending) return;
        clearTimeout(pending.timer); spellPending.delete(data.id);
        if (data.error) pending.reject(new Error(data.error)); else pending.resolve(data);
      };
      spellWorker.onerror = event => { event?.preventDefault(); stopSpellWorker('Spelling worker unavailable'); };
    }
    const id = ++spellSequence;
    const timer = setTimeout(() => stopSpellWorker('Spelling suggestions timed out'), 12000);
    spellPending.set(id, {resolve,reject,timer});
    try { spellWorker.postMessage({id,...data}); } catch { stopSpellWorker('Spelling worker unavailable'); }
  });
}
function spellingSuggestions(word) {
  if (isPersonalWord(word)) return Promise.resolve({correct:true,personal:true});
  return spellRequest({word});
}
// CSS highlights are ephemeral ranges, never DOM wrappers: they cannot enter
// document content, clipboard, undo history or exports.
function clearSpellHighlights() { if (typeof CSS !== 'undefined' && CSS.highlights) CSS.highlights.delete(SPELL_HIGHLIGHT); }
function scheduleSpellHighlights() {
  spellGeneration++; clearTimeout(spellTimer); clearSpellHighlights();
  if (!spellingEnabled || !customSpellingActive || mode === 'viewing' || !getTab(state.activeTabId)) return;
  const generation=spellGeneration;
  spellTimer=setTimeout(()=>refreshSpellHighlights(generation),250);
}
function spellFallback(message) {
  customSpellingActive=false; spellGeneration++; clearTimeout(spellTimer); clearSpellHighlights();
  page.spellcheck=spellingEnabled;
  toast(message + ' Using browser spellcheck; personal words may still be underlined.', 'info');
}
async function refreshSpellHighlights(generation) {
  if (generation !== spellGeneration || !spellingEnabled || !customSpellingActive || mode === 'viewing') return;
  const tabId=state.activeTabId, tab=getTab(tabId), nodes=[], walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT);
  let node, chars=0, visited=0;
  while ((node=walker.nextNode())) {
    chars += node.data.length;
    if (++visited > 5000 || chars > 200000) { spellFallback('This tab is too large for MegaDoc spelling highlights.'); return; }
    if (!node.data.length) continue;
    nodes.push({node,source:node.data,block:node.parentElement?.closest('p,div,h1,h2,h3,h4,h5,h6,li,td,th,blockquote') || page});
  }
  let personal; try { personal=personalDictionary(); } catch (_) { spellFallback('The personal dictionary could not be read.'); return; }
  const occurrences=[], unique=new Set();
  for (let i=0;i<nodes.length;i++) {
    const entry=nodes[i], text=entry.source;
    if (spellExcluded(entry.node.parentElement)) continue;
    for (const match of text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)) {
      const word=match[0], start=match.index, end=start+word.length;
      if (word.length < 2 || word.length > 32 || personal.has(personalWordKey(word))) continue;
      let before=text[start-1] || '', after=text[end] || '';
      if (!before && i && nodes[i-1].block === entry.block) before=nodes[i-1].source.slice(-1);
      if (!after && i+1<nodes.length && nodes[i+1].block === entry.block) after=nodes[i+1].source.slice(0,1);
      if (/[\p{L}\p{M}\p{N}'’]/u.test(before) || /[\p{L}\p{M}\p{N}'’]/u.test(after)) continue;
      occurrences.push({node:entry.node,source:text,start,end,word}); unique.add(word);
      if (occurrences.length > 12000 || unique.size > 6000) { spellFallback('This tab has too many words for MegaDoc spelling highlights.'); return; }
    }
  }
  let missing=[...unique].filter(word=>!spellCache.has(word));
  if (spellCache.size + missing.length > 12000) { spellCache.clear(); missing=[...unique]; }
  try {
    for (let i=0;i<missing.length;i+=200) {
      const batch=missing.slice(i,i+200), response=await spellRequest({kind:'check',words:batch});
      if (generation !== spellGeneration) return;
      if (!Array.isArray(response.correct) || response.correct.length !== batch.length || response.correct.some(x=>typeof x !== 'boolean')) throw new Error('Invalid spellcheck response');
      batch.forEach((word,j)=>spellCache.set(word,response.correct[j]));
    }
    if (generation !== spellGeneration || state.activeTabId !== tabId || getTab(tabId) !== tab || mode === 'viewing') return;
    if (nodes.some(entry=>!page.contains(entry.node) || entry.node.data !== entry.source)) { scheduleSpellHighlights(); return; }
    const highlight=new Highlight();
    for (const item of occurrences) if (spellCache.get(item.word) === false) {
      const range=document.createRange(); range.setStart(item.node,item.start); range.setEnd(item.node,item.end); highlight.add(range);
    }
    CSS.highlights.set(SPELL_HIGHLIGHT,highlight);
  } catch (_) {
    if (generation === spellGeneration && customSpellingActive) spellFallback('MegaDoc spelling could not be loaded.');
  }
}
function initSpelling() {
  page.spellcheck=spellingEnabled && !customSpellingActive;
  new MutationObserver(scheduleSpellHighlights).observe(page,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['spellcheck','contenteditable','data-megadoc-footnote','data-megadoc-bookmark']});
  addEventListener('storage',event=>{ if (event.key === PERSONAL_DICTIONARY_KEY || event.key === null) scheduleSpellHighlights(); });
  scheduleSpellHighlights();
}
function wordAtContextPoint(event) {
  if (!spellingEnabled || spellExcluded(event.target)) return null;
  let node, offset;
  if (event.clientX || event.clientY) {
    const point = document.caretPositionFromPoint?.(event.clientX,event.clientY);
    if (point) { node=point.offsetNode; offset=point.offset; }
    else { const range=document.caretRangeFromPoint?.(event.clientX,event.clientY); node=range?.startContainer; offset=range?.startOffset; }
  } else {
    const selection=getSelection();
    if (selection.rangeCount && selection.isCollapsed) { node=selection.anchorNode; offset=selection.anchorOffset; }
  }
  if (node?.nodeType !== Node.TEXT_NODE || !page.contains(node) || spellExcluded(node.parentElement)) return null;
  const source = node.data;
  for (const match of source.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)) {
    const start = match.index, end = start + match[0].length;
    if (offset < start || offset > end || end-start < 2 || end-start > 32) continue;
    // Do not offer a correction for part of a Unicode or cross-format word.
    const block=node.parentElement.closest('p,div,h1,h2,h3,h4,h5,h6,li,td,th,blockquote') || page;
    let before=source[start-1] || '', after=source[end] || '';
    if (!before && start===0) { const r=document.createRange(); r.selectNodeContents(block); r.setEnd(node,0); before=r.toString().slice(-1); }
    if (!after && end===source.length) { const r=document.createRange(); r.selectNodeContents(block); r.setStart(node,source.length); after=r.toString().slice(0,1); }
    if (/[\p{L}\p{M}\p{N}'’]/u.test(before) || /[\p{L}\p{M}\p{N}'’]/u.test(after)) continue;
    const range = document.createRange(); range.setStart(node,start); range.setEnd(node,end);
    if ((event.clientX || event.clientY) && ![...range.getClientRects()].some(r=>event.clientX >= r.left-1 && event.clientX <= r.right+1 && event.clientY >= r.top-1 && event.clientY <= r.bottom+1)) continue;
    return {node,source,start,end,word:match[0],tab:getTab(state.activeTabId),tabId:state.activeTabId};
  }
  return null;
}
function spellingTargetValid(target) {
  return spellingEnabled && mode !== 'viewing' && getTab(target.tabId) === target.tab && state.activeTabId === target.tabId && page.contains(target.node) && target.node.data === target.source && !spellExcluded(target.node.parentElement);
}
function addSpellingSection(menu, target, reposition) {
  if (!target) return;
  const section=document.createElement('div'); section.className='spelling-section';
  const heading=document.createElement('div'); heading.className='mi-label'; heading.textContent='Spelling · English (US/AU)';
  const status=document.createElement('div'); status.className='mi-label spelling-status'; status.setAttribute('role','status'); status.textContent='Checking spelling…';
  const separator=document.createElement('div'); separator.className='mi-sep';
  section.append(heading,status,separator); menu.prepend(section); reposition();
  function dictionaryAction(saved) {
    const button=document.createElement('button'); button.type='button'; button.className='mi spelling-dictionary-action';
    button.textContent=saved ? 'Remove from personal dictionary' : 'Add to personal dictionary';
    button.addEventListener('click',()=>{
      closeMenus();
      if (!spellingTargetValid(target)) { toast('Text changed; right-click the word again', 'info'); return; }
      try {
        savePersonalWord(target.word,!saved);
        scheduleSpellHighlights();
        toast(saved ? 'Removed from MegaDoc personal dictionary' : (customSpellingActive ? 'Added to MegaDoc personal dictionary' : 'Added to MegaDoc dictionary; browser underlines may remain'), 'spellcheck');
      } catch (error) { toast(error.message, 'error'); }
    });
    section.insertBefore(button,separator);
  }
  spellingSuggestions(target.word).then(result => {
    if (!section.isConnected || menu.classList.contains('hidden')) return;
    if (!spellingTargetValid(target)) { section.remove(); reposition(); return; }
    // A different MegaDoc tab may have changed the personal dictionary while
    // the asynchronous worker was checking this word.
    if (isPersonalWord(target.word)) {
      status.textContent='In your personal dictionary'; dictionaryAction(true); reposition(); return;
    }
    // If a saved word was removed while this check was in flight, check it
    // again next time instead of treating the stale response as authoritative.
    if (result.personal) { section.remove(); reposition(); return; }
    if (result.correct) { status.textContent='Recognized by MegaDoc dictionaries'; dictionaryAction(false); reposition(); return; }
    status.remove();
    if (!result.suggestions?.length) { status.textContent='No suggestions'; section.insertBefore(status,separator); }
    else for (const suggestion of result.suggestions) {
      const button=document.createElement('button'); button.type='button'; button.className='mi spelling-suggestion'; button.textContent=suggestion;
      button.addEventListener('click',()=>{
        closeMenus();
        if (!spellingTargetValid(target)) { toast('Text changed; right-click the word again', 'info'); return; }
        const range=document.createRange(); range.setStart(target.node,target.start); range.setEnd(target.node,target.end);
        page.focus(); const selection=getSelection(); selection.removeAllRanges(); selection.addRange(range); editorRange=range.cloneRange();
        exec('insertText',suggestion);
      });
      section.insertBefore(button,separator);
    }
    dictionaryAction(false); reposition();
  }).catch(() => {
    if (!section.isConnected || menu.classList.contains('hidden')) return;
    if (!spellingTargetValid(target)) { section.remove(); reposition(); return; }
    if (isPersonalWord(target.word)) { status.textContent='In your personal dictionary'; dictionaryAction(true); }
    else { status.textContent='Suggestions unavailable'; dictionaryAction(false); }
    reposition();
  });
}

/* Editor context menu: native browser menus remain available outside the page. */
function hasHeaderRow(table) {
  const first = table?.rows[0];
  return !!first && (first.parentElement.tagName === 'THEAD' || (first.cells.length > 0 && [...first.cells].every(c => c.tagName === 'TH' && c.getAttribute('scope') !== 'row')));
}
function showEditorContext(e) {
  if (!getTab(state.activeTabId) || mode === 'viewing' || e.target.closest('input,textarea,select,button')) return;
  e.preventDefault();
  const selection = getSelection();
  if (selection.rangeCount && page.contains(selection.anchorNode) && page.contains(selection.focusNode)) editorRange = selection.getRangeAt(0).cloneRange();
  const cell = e.target.closest('td,th');
  const table = cell?.closest('table');
  const spellingTarget = wordAtContextPoint(e);
  closeMenus();
  const menu = $('#contextMenu');
  menu.innerHTML = (table && page.contains(table) ? `
    <div class="mi-label">Table</div>
    ${table.rows[0] && !hasHeaderRow(table) ? '<button class="mi" data-editor-action="header-add"><span class="material-symbols-outlined">view_headline</span> Add header row</button>' : ''}
    <button class="mi" data-editor-action="row-before"><span class="material-symbols-outlined">add</span> Insert row above</button>
    <button class="mi" data-editor-action="row-after"><span class="material-symbols-outlined">add</span> Insert row below</button>
    <button class="mi" data-editor-action="col-before"><span class="material-symbols-outlined">add</span> Insert column left</button>
    <button class="mi" data-editor-action="col-after"><span class="material-symbols-outlined">add</span> Insert column right</button>
    <button class="mi" data-editor-action="row-delete"><span class="material-symbols-outlined">remove</span> Delete row</button>
    <button class="mi" data-editor-action="col-delete"><span class="material-symbols-outlined">remove</span> Delete column</button>
    <button class="mi" data-editor-action="table-style"><span class="material-symbols-outlined">tune</span> Table size &amp; cell style…</button>
    <button class="mi" data-editor-action="cell-merge"><span class="material-symbols-outlined">merge</span> Merge cells…</button>
    <button class="mi" data-editor-action="cell-split"><span class="material-symbols-outlined">call_split</span> Split merged cell</button>
    <button class="mi" data-editor-action="row-up"><span class="material-symbols-outlined">arrow_upward</span> Move row up</button>
    <button class="mi" data-editor-action="row-down"><span class="material-symbols-outlined">arrow_downward</span> Move row down</button>
    <button class="mi" data-editor-action="col-left"><span class="material-symbols-outlined">arrow_back</span> Move column left</button>
    <button class="mi" data-editor-action="col-right"><span class="material-symbols-outlined">arrow_forward</span> Move column right</button>
    <button class="mi" data-editor-action="sort-ascending"><span class="material-symbols-outlined">sort_by_alpha</span> Sort rows A–Z by this column</button>
    <button class="mi" data-editor-action="sort-descending"><span class="material-symbols-outlined">sort_by_alpha</span> Sort rows Z–A by this column</button>
    <button class="mi danger" data-editor-action="table-delete"><span class="material-symbols-outlined">delete</span> Delete table</button>
    <div class="mi-sep"></div>` : '') + `
    <div class="mi-label">Edit</div>
    <button class="mi" data-editor-action="undo"><span class="material-symbols-outlined">undo</span> Undo</button>
    <button class="mi" data-editor-action="cut"><span class="material-symbols-outlined">content_cut</span> Cut</button>
    <button class="mi" data-editor-action="copy"><span class="material-symbols-outlined">content_copy</span> Copy</button>
    <button class="mi" data-editor-action="paste"><span class="material-symbols-outlined">content_paste</span> Paste</button>
    <button class="mi" data-editor-action="select-all"><span class="material-symbols-outlined">select_all</span> Select all</button>`;
  menu.classList.remove('hidden');
  const reposition = () => { const rect = menu.getBoundingClientRect(); menu.style.left = Math.max(8, Math.min(e.clientX, innerWidth - rect.width - 8)) + 'px'; menu.style.top = Math.max(8, Math.min(e.clientY, innerHeight - rect.height - 8)) + 'px'; };
  reposition(); addSpellingSection(menu, spellingTarget, reposition);
  menu.querySelectorAll('[data-editor-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.editorAction;
    closeMenus();
    if (action === 'table-style') editTableStyle(table, cell);
    else if (action === 'cell-merge') mergeCellsModal(table, cell);
    else if (action === 'cell-split') splitMergedCell(table, cell);
    else if (['header-add','row-before','row-after','col-before','col-after','row-delete','col-delete','row-up','row-down','col-left','col-right','sort-ascending','sort-descending','table-delete'].includes(action)) editTable(table, cell, action);
    else if (action === 'undo') exec('undo');
    else if (action === 'cut' || action === 'copy') clipboardCommand(action);
    else if (action === 'paste') pasteAction();
    else if (action === 'select-all') exec('selectAll');
  }));
}
page.addEventListener('contextmenu', showEditorContext);

// A logical grid maps row/column coordinates even when a MegaDoc cell spans
// rows. Invalid, overlapping or uneven imported structures are never changed.
function tableGrid(table) {
  const rows = [...table.rows], grid = rows.map(() => []), origins = new Map();
  for (let r = 0; r < rows.length; r++) {
    let c = 0;
    for (const cell of rows[r].cells) {
      while (grid[r][c]) c++;
      const h = cell.rowSpan, w = cell.colSpan;
      if (!h || h > rows.length - r || w < 1 || w > 100 || h > 100) return null;
      for (let y = r; y < r + h; y++) {
        if (rows[y].parentElement !== rows[r].parentElement) return null;
        for (let x = c; x < c + w; x++) { if (grid[y][x]) return null; grid[y][x] = cell; }
      }
      origins.set(cell, {row:r,col:c}); c += w;
    }
  }
  const width = grid[0]?.length || 0;
  if (!width || grid.some(row => row.length !== width || Array.from({length:width},(_,i)=>row[i]).some(cell=>!cell))) return null;
  return {rows,grid,origins,width};
}
function replaceEditedTable(table, clone) {
  const range = document.createRange(); range.selectNode(table); page.focus();
  const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  programmaticEdit = true; let ok; try { ok = document.execCommand('insertHTML', false, clone.outerHTML); } finally { programmaticEdit = false; }
  if (!ok) { toast('Could not update this table', 'error'); return; }
  editorRange = selection.rangeCount && page.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
  saveCurrentContent(); updateWordCount(); save();
}
function tableCellAction(action) {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  focusPage(); const node = getSelection().anchorNode;
  const cell = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)?.closest('td,th');
  const table = cell?.closest('table');
  if (!table || !page.contains(table)) { toast('Place the caret in a table cell first', 'info'); return; }
  if (action === 'merge') mergeCellsModal(table, cell); else splitMergedCell(table, cell);
}
function mergeCellsModal(table, cell) {
  if (!table || !cell || !page.contains(table) || mode === 'viewing') return;
  const model = tableGrid(table), pos = model?.origins.get(cell), tabId = state.activeTabId;
  if (!model || !pos || model.rows.some(row => [...row.cells].some(c => c.rowSpan !== 1 || c.colSpan !== 1)) || table.querySelector('table,[contenteditable="false"]')) { toast('Merging requires a regular table without protected or nested content', 'info'); return; }
  const maxRows = model.rows.length - pos.row, maxCols = model.width - pos.col;
  openModal('Merge cells', `<p>The selected cell is the top-left corner. Choose a rectangular area below and to the right; its contents are kept in order. Merging cannot cross table sections.</p><div class="table-fields"><div class="field"><label for="mergeRows">Rows</label><input id="mergeRows" type="number" min="1" max="${maxRows}" value="1"></div><div class="field"><label for="mergeCols">Columns</label><input id="mergeCols" type="number" min="1" max="${maxCols}" value="${Math.min(2,maxCols)}"></div></div>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Merge</button>`);
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    const height = Number($('#mergeRows').value), width = Number($('#mergeCols').value);
    if (!Number.isInteger(height) || !Number.isInteger(width) || height < 1 || width < 1 || height > maxRows || width > maxCols || height * width < 2) { toast('Choose at least two cells within the table', 'info'); return; }
    if (state.activeTabId !== tabId || !page.contains(table) || !page.contains(cell) || mode === 'viewing') { closeModal(); toast('Select the table again', 'error'); return; }
    const current = tableGrid(table);
    if (!current || current.rows.length !== model.rows.length || current.width !== model.width || current.origins.get(cell)?.row !== pos.row || current.origins.get(cell)?.col !== pos.col || current.rows.some(row => [...row.cells].some(c => c.rowSpan !== 1 || c.colSpan !== 1)) || table.querySelector('table,[contenteditable="false"]')) { closeModal(); toast('Select the table again', 'error'); return; }
    if (current.rows.slice(pos.row,pos.row + height).some(row => row.parentElement !== current.rows[pos.row].parentElement)) { toast('Cannot merge across table sections', 'info'); return; }
    const clone = table.cloneNode(true), mapped = tableGrid(clone), merged = mapped.grid[pos.row][pos.col];
    const originals = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) originals.push({cell:mapped.grid[pos.row+y][pos.col+x], y, x});
    const parts = originals.map(({cell:source,y,x}) => {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-megadoc-merge-cell', JSON.stringify({y,x,tag:source.tagName.toLowerCase(),attrs:[...source.attributes].map(a=>[a.name,a.value])}));
      while (source.firstChild) wrapper.appendChild(source.firstChild); return wrapper;
    });
    for (const {cell:source} of originals) if (source !== merged) source.remove();
    merged.colSpan = width; merged.rowSpan = height; merged.setAttribute('data-megadoc-merged','1'); parts.forEach(part => merged.appendChild(part));
    closeModal(); replaceEditedTable(table, clone);
  });
}
function splitMergedCell(table, cell) {
  if (!table || !cell || !page.contains(table) || mode === 'viewing') return;
  const model = tableGrid(table), pos = model?.origins.get(cell), height = cell.rowSpan, width = cell.colSpan;
  if (!model || !pos || cell.dataset.megadocMerged !== '1' || height * width < 2 || table.querySelector('table,[contenteditable="false"]')) { toast('Only safely preserved MegaDoc merged cells can be split', 'info'); return; }
  const parts = [...cell.children];
  let metadata;
  try { metadata = parts.map(part => JSON.parse(part.getAttribute('data-megadoc-merge-cell'))); } catch { metadata = null; }
  if (!metadata || parts.length !== height * width || cell.childNodes.length !== parts.length || metadata.some((m,i) => !m || m.y !== Math.floor(i / width) || m.x !== i % width || !['td','th'].includes(m.tag) || !Array.isArray(m.attrs) || m.attrs.some(a => !Array.isArray(a) || a.length !== 2 || typeof a[0] !== 'string' || typeof a[1] !== 'string'))) { toast('Cell contents changed in a way that cannot be split safely', 'info'); return; }
  const clone = table.cloneNode(true), copy = tableGrid(clone), merged = copy.grid[pos.row][pos.col], copyParts = [...merged.children];
  try {
    for (let y = 0; y < height; y++) {
      const row = copy.rows[pos.row+y];
      const reference = [...row.cells].find(existing => existing !== merged && copy.origins.get(existing)?.col >= pos.col + width) || null;
      for (let x = 0; x < width; x++) {
        const n = y * width + x, meta = metadata[n], restored = document.createElement(meta.tag);
        for (const [name,value] of meta.attrs) restored.setAttribute(name,value);
        while (copyParts[n].firstChild) restored.appendChild(copyParts[n].firstChild);
        row.insertBefore(restored, y === 0 ? merged : reference);
      }
    }
    merged.remove();
  } catch { toast('Cell attributes cannot be restored safely', 'error'); return; }
  replaceEditedTable(table, clone);
}

function editTableStyle(table, cell) {
  const tabId = state.activeTabId;
  if (!table || !cell || !page.contains(table) || mode === 'viewing') return;
  const rows = [...table.rows], rowIndex = rows.indexOf(cell.parentElement), colIndex = cell.cellIndex;
  const cols = rows[0]?.cells.length || 0;
  if (rowIndex < 0 || colIndex < 0 || rows.some(r => r.cells.length !== cols || [...r.cells].some(c => c.rowSpan !== 1 || c.colSpan !== 1))) { toast('Table styling currently requires an even grid without merged cells', 'info'); return; }
  const colorHex = (color, fallback) => {
    const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
    return m ? '#' + m.slice(1,4).map(x => Math.min(255, +x).toString(16).padStart(2,'0')).join('') : fallback;
  };
  const computed = getComputedStyle(cell), scale = pageGeometry()?.scale || 1;
  const width = Math.round(cell.getBoundingClientRect().width / scale), height = Math.round(cell.parentElement.getBoundingClientRect().height / scale);
  openModal('Table size & cell style', `<p>Sizes apply to the selected row or column; colors and borders apply to the selected cell.</p>
    <div class="table-fields"><div class="field"><label for="tableColumnWidth">Column width (px)</label><input id="tableColumnWidth" type="number" min="16" max="2000" placeholder="${width}"></div><div class="field"><label for="tableRowHeight">Row height (px, minimum)</label><input id="tableRowHeight" type="number" min="1" max="2000" placeholder="${height}"></div></div>
    <p><label><input id="distributeColumns" type="checkbox"> Distribute columns evenly</label><br><label><input id="distributeRows" type="checkbox"> Distribute rows evenly</label></p>
    <div class="table-fields"><div class="field"><label><input id="useCellFill" type="checkbox"> Set cell fill</label><input id="cellFill" type="color" value="${colorHex(computed.backgroundColor, '#ffffff')}"></div><div class="field"><label><input id="useCellBorder" type="checkbox"> Set cell border</label><input id="cellBorder" type="color" value="${colorHex(computed.borderTopColor, '#bdc1c6')}"><label for="cellBorderWidth">Border width (px)</label><input id="cellBorderWidth" type="number" min="0" max="10" value="1"></div></div>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Apply</button>`);
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    if (state.activeTabId !== tabId || !page.contains(table) || !page.contains(cell) || mode === 'viewing') { closeModal(); toast('Select the table again', 'error'); return; }
    const widthInput = $('#tableColumnWidth').value, heightInput = $('#tableRowHeight').value;
    const w = Number(widthInput), h = Number(heightInput), borderWidth = Number($('#cellBorderWidth').value);
    const distributeCols = $('#distributeColumns').checked, distributeRows = $('#distributeRows').checked;
    const fill = $('#useCellFill').checked, border = $('#useCellBorder').checked;
    if ((widthInput && (!Number.isFinite(w) || w < 16 || w > 2000)) || (heightInput && (!Number.isFinite(h) || h < 1 || h > 2000)) || (border && (!Number.isFinite(borderWidth) || borderWidth < 0 || borderWidth > 10))) { toast('Enter valid sizes within the indicated ranges', 'error'); return; }
    if ((widthInput || distributeCols) && table.querySelector(':scope > colgroup, :scope > col')) { toast('Column sizing with column-group styling is not supported', 'info'); return; }
    if (!widthInput && !heightInput && !distributeCols && !distributeRows && !fill && !border) { closeModal(); return; }
    const clone = table.cloneNode(true), clonedRows = [...clone.rows], clonedCell = clonedRows[rowIndex].cells[colIndex];
    if (widthInput || distributeCols) {
      clone.style.tableLayout = 'fixed';
      clonedRows.forEach(row => [...row.cells].forEach((c, index) => {
        if (distributeCols) c.style.width = `${100 / cols}%`;
        else if (index === colIndex) c.style.width = `${w}px`;
      }));
    }
    if (distributeRows) {
      const average = table.getBoundingClientRect().height / scale / rows.length;
      clonedRows.forEach(row => { row.style.height = `${Math.round(average * 100) / 100}px`; });
    } else if (heightInput) clonedRows[rowIndex].style.height = `${h}px`;
    if (fill) clonedCell.style.backgroundColor = $('#cellFill').value;
    if (border) clonedCell.style.border = `${borderWidth}px solid ${$('#cellBorder').value}`;
    closeModal();
    const range = document.createRange(); range.selectNode(table); page.focus();
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    programmaticEdit = true;
    let inserted; try { inserted = document.execCommand('insertHTML', false, clone.outerHTML); } finally { programmaticEdit = false; }
    if (!inserted) { toast('Could not update table', 'error'); return; }
    editorRange = sel.rangeCount && page.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    saveCurrentContent(); updateWordCount(); save();
  });
}

function editTable(table, cell, action) {
  if (!table || !cell || !page.contains(table) || mode === 'viewing') return;
  const rows = [...table.rows];
  const rowIndex = rows.indexOf(cell.parentElement), colIndex = cell.cellIndex;
  if (rowIndex < 0 || colIndex < 0) return;
  const columns = rows[0]?.cells.length || 0;
  if (action !== 'table-delete' && rows.some(row => row.cells.length !== columns || [...row.cells].some(c => c.rowSpan !== 1 || c.colSpan !== 1))) {
    toast('Row and column editing is not supported for merged or uneven cells', 'info'); return;
  }
  if (action === 'header-add' && hasHeaderRow(table)) { toast('This table already has a header row', 'info'); return; }
  if (action === 'row-delete' && rows.length === 1) { toast('Use Delete table to remove the last row', 'info'); return; }
  if (action === 'col-delete' && columns === 1) { toast('Use Delete table to remove the last column', 'info'); return; }
  if (['col-left','col-right'].includes(action) && table.querySelector(':scope > colgroup, :scope > col')) { toast('Moving columns with column-group styling is not supported', 'info'); return; }
  const clone = table.cloneNode(true);
  const cloneRows = [...clone.rows];
  const cloneRow = cloneRows[rowIndex];
  const emptyCell = tag => { const el = document.createElement(tag); el.appendChild(document.createElement('br')); return el; };
  if (action === 'header-add') {
    const row = document.createElement('tr');
    for (let i = 0; i < columns; i++) { const header = emptyCell('th'); header.scope = 'col'; row.appendChild(header); }
    if (clone.tHead) clone.tHead.appendChild(row);
    else cloneRows[0].parentElement.insertBefore(row, cloneRows[0]);
  } else if (action === 'row-before' || action === 'row-after') {
    const row = document.createElement('tr');
    for (const existing of cloneRow.cells) {
      const afterHeader = action === 'row-after' && cloneRow.parentElement.tagName !== 'THEAD' && [...cloneRow.cells].every(c => c.tagName === 'TH') && (!cloneRow.nextElementSibling || cloneRow.nextElementSibling.cells[0]?.tagName === 'TD');
      row.appendChild(emptyCell(afterHeader ? 'td' : existing.tagName.toLowerCase()));
    }
    cloneRow.parentElement.insertBefore(row, action === 'row-before' ? cloneRow : cloneRow.nextSibling);
  } else if (action === 'row-up' || action === 'row-down') {
    const sibling = action === 'row-up' ? cloneRow.previousElementSibling : cloneRow.nextElementSibling;
    // Keep headers in place and do not move between table sections.
    if (!sibling || (hasHeaderRow(clone) && (cloneRow === clone.rows[0] || sibling === clone.rows[0]))) { toast('Cannot move this row further', 'info'); return; }
    cloneRow.parentElement.insertBefore(cloneRow, action === 'row-up' ? sibling : sibling.nextSibling);
  } else if (action === 'col-left' || action === 'col-right') {
    const other = colIndex + (action === 'col-left' ? -1 : 1);
    if (other < 0 || other >= columns) { toast('Cannot move this column further', 'info'); return; }
    cloneRows.forEach(row => {
      const moving = row.cells[colIndex], sibling = row.cells[other];
      row.insertBefore(moving, action === 'col-left' ? sibling : sibling.nextSibling);
    });
  } else if (action === 'sort-ascending' || action === 'sort-descending') {
    const section = cloneRow.parentElement;
    if (section.tagName === 'THEAD' || section.tagName === 'TFOOT') { toast('Select a body row to sort', 'info'); return; }
    const body = [...section.children].filter(row => row.tagName === 'TR' && !(hasHeaderRow(clone) && row === clone.rows[0]));
    if (body.length < 2) { toast('At least two body rows are needed to sort', 'info'); return; }
    const collator = new Intl.Collator(undefined, { numeric:true, sensitivity:'base' });
    const sorted = body.map((row, index) => ({row, index, value:row.cells[colIndex].textContent.trim()}));
    sorted.sort((a, b) => (action === 'sort-ascending' ? 1 : -1) * collator.compare(a.value, b.value) || a.index - b.index);
    const last = body[body.length - 1], next = last.nextSibling;
    sorted.forEach(({row}) => section.insertBefore(row, next));
  } else if (action === 'row-delete') cloneRow.remove();
  else if (action === 'col-delete') cloneRows.forEach(row => row.cells[colIndex].remove());
  else if (action === 'col-before' || action === 'col-after') cloneRows.forEach(row => {
    const reference = row.cells[colIndex];
    row.insertBefore(emptyCell(reference.tagName.toLowerCase()), action === 'col-before' ? reference : reference.nextSibling);
  });
  // Replacing through the editing engine makes the operation undoable and autosaved.
  const range = document.createRange(); range.selectNode(table);
  page.focus(); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  document.execCommand('insertHTML', false, action === 'table-delete' ? '' : clone.outerHTML);
  editorRange = selection.rangeCount && page.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
  saveCurrentContent(); updateWordCount(); save();
}

// Tab and Shift+Tab navigate cells while editing a table.
page.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey || mode === 'viewing') return;
  const selection = getSelection();
  const node = selection.anchorNode;
  const cell = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)?.closest('td,th');
  const table = cell?.closest('table');
  if (!table || !page.contains(table)) return;
  const cells = [...table.rows].flatMap(row => [...row.cells]);
  const next = cells[cells.indexOf(cell) + (e.shiftKey ? -1 : 1)];
  if (!next) return;
  e.preventDefault();
  const range = document.createRange(); range.selectNodeContents(next); range.collapse(true);
  selection.removeAllRanges(); selection.addRange(range); editorRange = range.cloneRange();
});

function insertPageBreak() {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  if (getTab(state.activeTabId)?.pageView === 'pageless') { toast('Switch to page view to insert a page break', 'info'); return; }
  focusPage(); const sel = getSelection();
  if (!sel.rangeCount || !sel.isCollapsed || !page.contains(sel.anchorNode)) { toast('Place the caret where the break should go', 'info'); return; }
  const node = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
  if (node?.closest('table,ul,ol,a,[contenteditable="false"]')) { toast('Place page breaks outside tables, lists and links', 'info'); return; }
  exec('insertHTML', '<hr class="megadoc-page-break" data-megadoc-page-break="true" role="button" tabindex="0" aria-label="Page break; activate to remove">');
}
function removePageBreak(marker) {
  if (!page.contains(marker) || mode === 'viewing') return;
  openModal('Page break', '<p>Remove this explicit page break? The editor remains a continuous page, while printing starts a new page at this marker.</p>', '<button class="btn text" id="mCancel">Cancel</button><button class="btn danger" id="mOk">Remove</button>');
  $('#mCancel').addEventListener('click', closeModal);
  const tab = state.activeTabId;
  $('#mOk').addEventListener('click', () => {
    if (tab !== state.activeTabId || !page.contains(marker) || mode === 'viewing') { closeModal(); return; }
    closeModal(); const r = document.createRange(); r.selectNode(marker); page.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); editorRange = r.cloneRange(); exec('insertHTML', '');
  });
}
page.addEventListener('click', e => { const marker = e.target.closest('[data-megadoc-page-break]'); if (marker && page.contains(marker) && mode !== 'viewing') { e.preventDefault(); removePageBreak(marker); } });
page.addEventListener('keydown', e => { const marker = e.target.closest?.('[data-megadoc-page-break]'); if (marker && page.contains(marker) && mode !== 'viewing' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); removePageBreak(marker); } });

function insertTable() {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'error'); return; }
  openModal('Insert table', `<div class="table-fields">
    <div class="field"><label for="tableRows">Rows</label><input type="number" id="tableRows" min="1" max="20" value="3"></div>
    <div class="field"><label for="tableCols">Columns</label><input type="number" id="tableCols" min="1" max="20" value="3"></div>
  </div><label class="table-header-option"><input type="checkbox" id="tableHeader" checked> First row is a header</label>
  <p class="appearance-note">Right-click a cell to add or remove rows and columns.</p>`,
  `<button class="btn text" id="tableCancel">Cancel</button><button class="btn primary" id="tableInsert">Insert table</button>`);
  $('#tableCancel').addEventListener('click', closeModal);
  $('#tableInsert').addEventListener('click', () => {
    const rows = Number($('#tableRows').value), cols = Number($('#tableCols').value);
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || rows > 20 || cols < 1 || cols > 20) { toast('Choose 1–20 rows and columns', 'error'); return; }
    const header = $('#tableHeader').checked;
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      const tag = header && r === 0 ? 'th' : 'td';
      const cell = tag === 'th' ? '<th scope="col"><br></th>' : '<td><br></td>';
      html += '<tr>' + cell.repeat(cols) + '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    closeModal(); exec('insertHTML', html); toast('Table inserted', 'table');
  });
}
let findIndex = -1;
let findError = '';
function findInTab() {
  if (!getTab(state.activeTabId)) { toast('Create a tab first', 'search_off'); return; }
  $('#findbar').classList.add('open'); $('#findInput').focus(); $('#findInput').select(); runFind();
}
function findRanges(q) {
  findError = '';
  if (!q) return [];
  let pattern;
  try {
    const slash = String.fromCharCode(92);
    const source = $('#findRegex').checked ? q : Array.from(q, c => '.*+?^${}()|[]'.includes(c) || c === slash ? slash + c : c).join('');
    pattern = new RegExp(source, $('#findCase').checked ? 'gu' : 'giu');
  } catch { findError = 'Invalid regular expression'; return []; }
  // Search within each text block, including inline formatting, but never across
  // paragraphs, table cells, or non-editable controls (which could destroy them).
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const groups = []; let node, previous;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.matches('br,img,input,hr,canvas,svg,video,audio,iframe,button,[contenteditable="false"]')) previous = null;
      continue;
    }
    const parent = node.parentElement;
    if (!parent || parent.closest('script,style,[contenteditable="false"],button')) { previous = null; continue; }
    const block = parent.closest('p,div,h1,h2,h3,h4,h5,h6,blockquote,pre,li,td,th') || page;
    if (!previous || previous.block !== block) { previous = {block, text:'', nodes:[]}; groups.push(previous); }
    previous.nodes.push({node, start:previous.text.length}); previous.text += node.data;
  }
  const ranges = [];
  for (const group of groups) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(group.text))) {
      if (!match[0].length) { pattern.lastIndex += pattern.unicode && group.text.codePointAt(pattern.lastIndex) > 0xffff ? 2 : 1; continue; }
      const hit = match.index, endOffset = hit + match[0].length;
      const start = group.nodes.find(n => hit >= n.start && hit < n.start + n.node.length);
      const end = group.nodes.find(n => endOffset > n.start && endOffset <= n.start + n.node.length);
      if (start && end) { const range = document.createRange(); range.setStart(start.node, hit - start.start); range.setEnd(end.node, endOffset - end.start); ranges.push(range); }
    }
  }
  return ranges;
}
function refreshFindCount() {
  const ranges = findRanges($('#findInput').value);
  findIndex = ranges.length ? Math.max(0, Math.min(findIndex, ranges.length - 1)) : -1;
  $('#findCount').textContent = findError || (ranges.length ? `${findIndex + 1} / ${ranges.length}` : ($('#findInput').value ? 'No matches' : ''));
}
function showFindResult(ranges) {
  $('#findCount').textContent = findError || (ranges.length ? `${findIndex + 1} / ${ranges.length}` : ($('#findInput').value ? 'No matches' : ''));
  if (ranges.length) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(ranges[findIndex]); ranges[findIndex].startContainer.parentElement?.scrollIntoView({block:'nearest'}); }
}
function runFind() { const ranges = findRanges($('#findInput').value); findIndex = ranges.length ? 0 : -1; showFindResult(ranges); }
function findStep(dir) { const ranges = findRanges($('#findInput').value); if (!ranges.length) { showFindResult(ranges); return; } findIndex = (Math.max(0, findIndex) + dir + ranges.length) % ranges.length; showFindResult(ranges); }
function replaceFind(all = false) {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  let ranges = findRanges($('#findInput').value);
  if (!ranges.length) { findIndex = -1; showFindResult(ranges); return; }
  const text = $('#replaceInput').value;
  const total = all ? ranges.length : 1;
  let index = all ? ranges.length - 1 : Math.max(0, Math.min(findIndex, ranges.length - 1));
  let changed = 0;
  // Work backwards so replacements cannot shift earlier matches. Each native
  // insertion is undoable; regular-expression replacement text is literal.
  for (let remaining = total; remaining > 0 && index >= 0; remaining--, index--) {
    ranges = findRanges($('#findInput').value);
    const range = ranges[index]; if (!range || !page.contains(range.commonAncestorContainer)) break;
    page.focus(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    programmaticEdit = true;
    let ok; try { ok = document.execCommand('insertText', false, text); } finally { programmaticEdit = false; }
    if (!ok) break;
    changed++;
  }
  const sel = getSelection(); if (sel.rangeCount && page.contains(sel.anchorNode)) editorRange = sel.getRangeAt(0).cloneRange();
  saveCurrentContent(); updateWordCount(); save();
  ranges = findRanges($('#findInput').value); findIndex = ranges.length ? Math.min(Math.max(index + 1, 0), ranges.length - 1) : -1; showFindResult(ranges);
  toast(`${changed} replacement${changed === 1 ? '' : 's'}`, 'find_replace');
}
function closeFind() { $('#findbar').classList.remove('open'); }


function exportJSON() {
  saveCurrentContent();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.docTitle || 'megadoc'}.megadoc.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Exported as JSON', 'download');
}
// Local formats intentionally operate on one tab; JSON remains the full backup.
function exportLocalContent(format) {
  const tab = getTab(state.activeTabId);
  if (!tab) { toast('Create a tab first', 'info'); return; }
  if (format === 'html' && !window.DOMPurify) { toast('HTML sanitizer is unavailable', 'error'); return; }
  saveCurrentContent();
  let output, type, extension;
  if (format === 'text') { const notes = footnoteEntries(); output = page.innerText + (notes.length ? '\n\nFootnotes (end of tab):\n' + notes.map(n => `[${n.number}] ${n.text}`).join('\n') : ''); type = 'text/plain;charset=utf-8'; extension = 'txt'; }
  else {
    // Export is a sanitized copy: executable markup is never written as a page.
    const safe = DOMPurify.sanitize(page.innerHTML, {USE_PROFILES:{html:true,mathMl:true}});
    output = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(tab.title || 'MegaDoc tab')}</title><style>${$('#paragraphStyleRules').textContent.replace(/\.page/g, 'body')} @media print{hr[data-megadoc-page-break]{break-before:page;page-break-before:always;border:0;height:0;margin:0}} @supports not (object-view-box:inset(1%)){img[data-megadoc-crop]{object-fit:contain;aspect-ratio:auto!important;height:auto!important}}</style></head><body>\n${safe}\n${makeFootnotesSection()?.outerHTML || ''}\n</body></html>\n`;
    type = 'text/html;charset=utf-8'; extension = 'html';
  }
  const file = new Blob([output], {type}); const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = `${(tab.title || 'MegaDoc tab').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')}.${extension}`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast(`Current tab exported as ${extension.toUpperCase()}`, 'download');
}
// The deployment is public configuration, never a credential. URLs with extra
// parameters are rejected so the export controls exactly what is sent.
function googleDocsDeploymentUrl(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter the deployed Apps Script web app URL.'); }
  const standard = /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname);
  const workspace = /^\/a\/macros\/([^/]+)\/s\/[A-Za-z0-9_-]+\/exec$/.exec(url.pathname);
  const domain = workspace && workspace[1];
  const validDomain = domain && domain.length <= 253 && domain.includes('.') && domain.split('.').every(label => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label));
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || url.port || url.username || url.password || url.search || url.hash || !(standard || validDomain)) throw new Error('Use an HTTPS script.google.com web app /exec URL, without parameters. Standard and Google Workspace deployment links are supported.');
  return url;
}
function googleDocsScriptOrigin(value) {
  let url; try { url = new URL(value); } catch { return ''; }
  return url.protocol === 'https:' && /^[a-z0-9-]+-script\.googleusercontent\.com$/.test(url.hostname) && !url.port && !url.username && !url.password && url.origin === value ? url.origin : '';
}
function googleDocsSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(GOOGLE_DOCS_SETTINGS_KEY) || '{}');
    const url = googleDocsDeploymentUrl(data.url || '').href;
    return {url, origin:googleDocsScriptOrigin(data.origin || '')};
  } catch (_) { return {url:'', origin:''}; }
}
function saveGoogleDocsSettings(settings) {
  try { localStorage.setItem(GOOGLE_DOCS_SETTINGS_KEY,JSON.stringify(settings)); return true; } catch (_) { return false; }
}
// Convert the live editor DOM into a constrained Docs model; never execute or
// forward HTML. Lengths in the model and Docs ranges are UTF-16 code units.
function googleDocsPayload(tab, root, context = null) {
  const title = (tab.title || 'MegaDoc tab').trim();
  if (!title || title.length > 120 || /[\x00-\x1f\x7f-\x9f]/.test(title)) throw new Error('The tab title must be 1–120 characters without control characters.');
  const blocks = [], warnings = new Set(); let current = null;
  const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max ? Math.round(value * 100) / 100 : undefined;
  function points(value) {
    const match = /^(-?\d+(?:\.\d+)?)(px|pt)$/i.exec((value || '').trim());
    return match ? Number(match[1]) * (match[2].toLowerCase() === 'px' ? 0.75 : 1) : undefined;
  }
  function color(value, element, background = false) {
    if (!value) return;
    let str = value.trim();
    if (/^#[\da-f]{3}$/i.test(str)) return '#' + [...str.slice(1)].map(x=>x+x).join('').toLowerCase();
    if (/^#[\da-f]{6}$/i.test(str)) return str.toLowerCase();
    if (!/^rgba?\(/i.test(str)) { try { str = background ? getComputedStyle(element).backgroundColor : getComputedStyle(element).color; } catch (_) { return; } }
    const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(str);
    if (!m || (m[4] !== undefined && Number(m[4]) < 1) || [m[1],m[2],m[3]].some(v => Number(v) > 255)) return;
    return '#' + [m[1],m[2],m[3]].map(v=>Number(v).toString(16).padStart(2,'0')).join('');
  }
  function inlineStyle(el, inherited) {
    const result = {...inherited}, tag = el.tagName, css = el.style;
    if (tag === 'B' || tag === 'STRONG') result.bold = true;
    if (tag === 'I' || tag === 'EM') result.italic = true;
    if (tag === 'U') result.underline = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') result.strikethrough = true;
    if (tag === 'SUP') result.baselineOffset = 'SUPERSCRIPT';
    if (tag === 'SUB') result.baselineOffset = 'SUBSCRIPT';
    if (tag === 'MARK') result.backgroundColor = '#ffff00';
    if (tag === 'CODE' || tag === 'PRE') { result.fontFamily = 'Roboto Mono'; result.fontSize = 10; }
    if (tag === 'BLOCKQUOTE') { result.italic = true; result.foregroundColor = '#333333'; }
    if (tag === 'A') { result.underline = true; result.foregroundColor = '#1155cc'; }
    if (css.fontWeight) { const w = css.fontWeight.toLowerCase(); result.bold = w === 'bold' || w === 'bolder' || Number(w) >= 600; }
    if (css.fontStyle) result.italic = /^(italic|oblique)/i.test(css.fontStyle);
    const decoration = css.textDecorationLine || css.textDecoration;
    if (decoration) { if (/underline/i.test(decoration)) result.underline = true; if (/line-through/i.test(decoration)) result.strikethrough = true; }
    const family = (css.fontFamily || (tag === 'FONT' ? el.getAttribute('face') : '') || '').split(',')[0].trim().replace(/^["']|["']$/g,'');
    if (/^[\w .-]{1,80}$/.test(family)) result.fontFamily = family;
    let size = points(css.fontSize);
    if (size === undefined && tag === 'FONT' && /^[1-7]$/.test(el.getAttribute('size') || '')) size = [0,8,10,12,14,18,24,36][Number(el.getAttribute('size'))];
    size = number(size,6,96); if (size !== undefined) result.fontSize = size;
    const foreground = color(css.color || (tag === 'FONT' ? el.getAttribute('color') : ''),el);
    if (foreground) result.foregroundColor = foreground;
    const background = color(css.backgroundColor,el,true); if (background) result.backgroundColor = background;
    if (tag === 'A') {
      const href = el.getAttribute('href') || '';
      if (/^https?:\/\/[^\s<>"']{1,2000}$/i.test(href)) result.link = href;
      else if (href) warnings.add('Internal links cannot be converted.');
    }
    return result;
  }
  function paragraphStyle(el, inherited) {
    const result = {...inherited}, css = el.style;
    // Mirror editor CSS defaults before applying user-set inline overrides.
    const defaults = {P:{spaceBelow:7.5}, H1:{spaceAbove:0,spaceBelow:9,lineSpacing:125}, H2:{spaceAbove:13.5,spaceBelow:6,lineSpacing:130}, H3:{spaceAbove:10.5,spaceBelow:4.5}, BLOCKQUOTE:{spaceAbove:7.5,spaceBelow:7.5,indentStart:10.5,indentFirstLine:10.5}, PRE:{spaceAbove:7.5,spaceBelow:7.5}};
    Object.assign(result,defaults[el.tagName] || {});
    const alignment = (css.textAlign || el.getAttribute('align') || '').toLowerCase();
    if ({left:'START',start:'START',center:'CENTER',right:'END',end:'END',justify:'JUSTIFIED'}[alignment]) result.alignment = {left:'START',start:'START',center:'CENTER',right:'END',end:'END',justify:'JUSTIFIED'}[alignment];
    if (/^(?:\d+(?:\.\d+)?%?|\.\d+)$/.test(css.lineHeight)) { const value = Number.parseFloat(css.lineHeight) * (css.lineHeight.endsWith('%') ? 1 : 100); const v = number(value,50,400); if (v !== undefined) result.lineSpacing = v; }
    let left = points(css.marginLeft); if (left === undefined && el.tagName === 'BLOCKQUOTE') left = 10.5;
    const right = points(css.marginRight), first = points(css.textIndent), above = points(css.marginTop), below = points(css.marginBottom);
    if (left !== undefined) { const v = number(left,0,400); if (v !== undefined) result.indentStart = v; }
    if (first !== undefined || left !== undefined) { const v = number((result.indentStart || 0) + (first || 0),-200,400); if (v !== undefined) result.indentFirstLine = v; }
    for (const [key,value] of [['indentEnd',right],['spaceAbove',above],['spaceBelow',below]]) { const v = number(value,0,400); if (v !== undefined) result[key] = v; }
    return result;
  }
  function flush(force) { if (current && (force || current.runs.length)) blocks.push(current); current = null; }
  function createBlock(kind,paragraph,list) { return {kind,paragraph:{...paragraph},...(list ? {list:{...list}} : {}),runs:[]}; }
  function append(text,style,para,list) {
    const pieces = text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n');
    for (let i=0; i<pieces.length; i++) {
      if (!current) current = createBlock('NORMAL_TEXT',para,list);
      const part=pieces[i];
      if (part) {
        if (/[\x00-\x1f\x7f-\x9f\ue000-\uf8ff]/.test(part) || /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(part)) throw new Error('This tab contains unsupported text characters.');
        const last = current.runs[current.runs.length-1];
        if (last && JSON.stringify(last.style) === JSON.stringify(style)) last.text += part; else current.runs.push({text:part,style:{...style}});
      }
      if (i < pieces.length-1) { const prior=current; flush(true); current=createBlock(prior.kind,prior.paragraph,prior.list); }
    }
  }
  function walk(node, style, para, list, depth, preserve) {
    if (depth > 100) throw new Error('This tab is too deeply nested to export.');
    if (node.nodeType === Node.TEXT_NODE) {
      let text = node.data;
      if (!preserve) {
        text = text.replace(/[\t\n\r\f ]+/g,' ');
        const last = current?.runs[current.runs.length-1];
        if (!last) text = text.replace(/^ /,'');
        else if (last.text.endsWith(' ') && text.startsWith(' ')) text = text.slice(1);
      }
      if (text) append(text,style,para,list); return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag=node.tagName;
    if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG'].includes(tag)) { warnings.add('Some embedded content was omitted.'); return; }
    if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS') { warnings.add('Images and media are not exported.'); return; }
    if (tag === 'HR') { warnings.add('Page breaks and rules are not exported.'); return; }
    if (tag === 'TABLE') {
      if (context?.inTable || list || node.querySelector('table')) throw new Error('Nested tables or tables inside lists are not supported. Export them separately or simplify the layout.');
      const rows = [...node.rows];
      const columns = rows[0]?.cells.length || 0;
      if (!rows.length || rows.length > 20 || !columns || columns > 20 || rows.length * columns > 200 || rows.some(row => row.cells.length !== columns || [...row.cells].some(cell => cell.rowSpan !== 1 || cell.colSpan !== 1))) throw new Error('Google Docs export currently requires rectangular tables without merged cells (maximum 20 rows, 20 columns and 200 cells).');
      flush(false);
      warnings.add('Tables are supported only when creating a new Google Doc; spacing, padding and borders may differ.');
      const tableStyle=inlineStyle(node,style), tablePara=paragraphStyle(node,para);
      const widths=[];
      for (let c=0;c<columns;c++) {
        const width=number(points(rows[0].cells[c].style.width),12,1500);
        widths.push(width === undefined ? null : width);
      }
      const heights=rows.map(row=>number(points(row.style.height),0.75,1500) ?? null);
      if (node.querySelector('colgroup,col') || rows.some(row=>(row.style.height && points(row.style.height) === undefined) || [...row.cells].some(cell=>cell.style.border || (cell.style.width && points(cell.style.width) === undefined)))) warnings.add('Some table sizing or border styles may differ.');
      const outputRows=rows.map(row => [...row.cells].map(cell => {
        if (cell.querySelector('table')) throw new Error('Nested tables are not supported by Google Docs export.');
        let cellTextStyle=inlineStyle(cell,{...tableStyle,fontSize:10.5});
        if (cell.tagName === 'TH' && !cell.style.fontWeight) cellTextStyle.bold=true;
        const background=color(cell.style.backgroundColor,cell,true) || (cell.tagName === 'TH' ? '#f1f3f4' : undefined);
        // Cell fill is applied to the cell itself, not copied as text highlight.
        if (cell.style.backgroundColor) { cellTextStyle={...cellTextStyle}; delete cellTextStyle.backgroundColor; }
        const converted=googleDocsPayload(tab,cell,{inTable:true,style:cellTextStyle,paragraph:paragraphStyle(cell,tablePara)});
        for (const warning of converted.warnings) warnings.add(warning);
        return {blocks:converted.blocks,...(background ? {backgroundColor:background} : {})};
      }));
      blocks.push({kind:'TABLE',rows:outputRows,widths,heights});
      return;
    }
    if (node.hasAttribute('data-megadoc-equation')) { warnings.add('Equations are exported as source text.'); append(node.getAttribute('data-megadoc-equation') || '',style,para,list); return; }
    if (node.hasAttribute('data-megadoc-footnote')) warnings.add('Footnote text is not exported.');
    if (tag === 'INPUT') { warnings.add('Interactive controls are not exported.'); return; }
    if (tag === 'BR') {
      if (!current) current = createBlock('NORMAL_TEXT',para,list);
      // A sole or trailing BR is the browser's empty-paragraph placeholder.
      if (!node.nextSibling) return;
      if (list) warnings.add('Line breaks inside list items may become separate list items.');
      const prior=current; flush(true); current=createBlock(prior.kind,prior.paragraph,prior.list); return;
    }
    const nextStyle=inlineStyle(node,style), nextPara=paragraphStyle(node,para);
    const nextPreserve = node.style.whiteSpace ? /^(pre|pre-wrap|break-spaces)$/i.test(node.style.whiteSpace) : preserve || tag === 'PRE';
    if (tag === 'UL' || tag === 'OL') {
      if (node.hasAttribute('start') || node.hasAttribute('reversed') || node.style.listStyleType || (list && (list.level >= 8 || list.type !== (tag === 'OL' ? 'NUMBER' : 'BULLET')))) warnings.add('Some list markers, numbering or nesting may change.');
      flush(false); const nextList={type:tag === 'OL' ? 'NUMBER' : 'BULLET',level:list ? Math.min(8,list.level+1) : 0};
      for (const child of node.childNodes) walk(child,nextStyle,nextPara,nextList,depth+1,nextPreserve);
      flush(false); return;
    }
    if (tag === 'LI' && node.hasAttribute('value')) warnings.add('Some list markers, numbering or nesting may change.');
    const block = /^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|LI|TR|TD|TH)$/.test(tag);
    if (block) {
      const blockList = list && (tag === 'LI' || (current && current.list && !current.runs.length)) ? list : null;
      flush(false); const before=blocks.length, kind=/^H[1-6]$/.test(tag) ? 'HEADING_'+tag.slice(1) : 'NORMAL_TEXT';
      let blockStyle=nextStyle;
      if (/^H[1-6]$/.test(tag)) {
        const key=tag.toLowerCase(), custom=state.paragraphStyles?.[key];
        blockStyle={...nextStyle, bold:custom?.weight === 400 ? false : true, fontSize:custom?.size || ({h1:26,h2:20,h3:15,h4:13,h5:11,h6:10}[key])};
        if (custom?.font && /^[\w .-]{1,80}$/.test(custom.font)) blockStyle.fontFamily=custom.font;
        if (custom?.color && /^#[\da-f]{6}$/i.test(custom.color)) blockStyle.foregroundColor=custom.color;
        // Explicit inline styles on the heading still take precedence.
        blockStyle=inlineStyle(node,blockStyle);
      }
      current=createBlock(kind,nextPara,blockList);
      for (const child of node.childNodes) walk(child,blockStyle,nextPara,blockList,depth+1,nextPreserve);
      flush(true);
      if (blocks.length === before) blocks.push(createBlock(kind,nextPara,blockList));
      return;
    }
    for (const child of node.childNodes) walk(child,nextStyle,nextPara,list,depth+1,nextPreserve);
  }
  const base = state.paragraphStyles?.p || {}, baseStyle=context?.style ? {...context.style} : {fontFamily:'Arial',fontSize:11};
  if (!context && base.font && /^[\w .-]{1,80}$/.test(base.font)) baseStyle.fontFamily=base.font;
  if (!context && typeof base.size === 'number' && number(base.size,6,96) !== undefined) baseStyle.fontSize=base.size;
  if (!context && base.weight === 700) baseStyle.bold=true;
  if (!context && typeof base.color === 'string' && /^#[\da-f]{6}$/i.test(base.color)) baseStyle.foregroundColor=base.color;
  for (const node of root.childNodes) walk(node,baseStyle,context?.paragraph || {lineSpacing:150},null,0,false);
  flush(false); if (!blocks.length) blocks.push(createBlock('NORMAL_TEXT',{},null));
  const allParagraphs=blocks.flatMap(b=>b.kind === 'TABLE' ? b.rows.flatMap(row=>row.flatMap(cell=>cell.blocks)) : [b]);
  const tables=blocks.filter(b=>b.kind === 'TABLE');
  const runs=allParagraphs.reduce((n,b)=>n+b.runs.length,0), length=allParagraphs.reduce((n,b)=>n+1+(b.list?.level||0)+b.runs.reduce((sum,r)=>sum+r.text.length,0),0);
  if (tables.length > 10 || tables.reduce((n,t)=>n+t.rows.length*t.rows[0].length,0)>200 || allParagraphs.length > 500 || runs > 1000 || length > 100000) throw new Error('This tab exceeds the Google Docs export limits.');
  return {version:1,title,blocks,warnings:[...warnings]};
}
// Google can nest the HTML-service window inside multiple cross-origin frames.
// Window.parent is cross-origin-readable; never inspect their documents.
function googleDocsIsDescendant(source, root) {
  try {
    for (let current = source, depth = 0; current && depth < 10; depth++) {
      if (current === root) return true;
      const parent = current.parent;
      if (!parent || parent === current) break;
      current = parent;
    }
  } catch (_) { /* Fail closed if a browser denies access. */ }
  return false;
}
let googleDocsCleanup = null;
function googleDocsExportDialog() {
  const tab = getTab(state.activeTabId);
  if (!tab) { toast('Create a tab first', 'info'); return; }
  const id = state.activeTabId, saved = googleDocsSettings();
  openModal('Export current tab to Google Docs', `<p>Paste the <b>/exec</b> web app link for your trusted Apps Script deployment. MegaDoc remembers the link in this browser. <a href="google-apps-script/README.md" target="_blank" rel="noopener noreferrer">Setup instructions</a>.</p><div class="field"><label for="googleDocsUrl">Apps Script deployment URL</label><input id="googleDocsUrl" type="url" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></div><p>After you continue, this tab’s text and supported formatting are sent to the deployment, not in the URL. Images, comments, history and other tabs are not exported; some formatting may change. Tables can be exported to a new Google Doc. Keep a JSON backup.</p><p>Only use a deployment you trust. Google sign-in is required. Custom MegaDoc hosts need to be allowed in the script. The embedded app is experimental and can be clickjacked.</p><p id="googleDocsError" role="alert"></p>`, `<button class="btn text" id="googleDocsForget">Forget saved link</button><button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Open exporter</button>`);
  const input = $('#googleDocsUrl'); input.value = saved.url;
  let edited = false;
  input.addEventListener('input',() => { edited = true; });
  $('#googleDocsForget').addEventListener('click',() => { try { localStorage.removeItem(GOOGLE_DOCS_SETTINGS_KEY); } catch (_) {} input.value=''; edited=true; $('#googleDocsError').textContent='Saved link forgotten in this browser.'; });
  fetch('google-docs.config.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null).then(config => {
    if (input.isConnected && !input.value && !edited && typeof config?.appsScriptUrl === 'string') input.value = config.appsScriptUrl;
  }).catch(() => {});
  $('#mCancel').addEventListener('click',closeModal);
  $('#mOk').addEventListener('click', () => {
    try {
      if (state.activeTabId !== id || !getTab(id)) throw new Error('Select the tab again before exporting.');
      if (window.top !== window) throw new Error('Open MegaDoc directly in a top-level browser tab to use the iframe exporter.');
      const url = googleDocsDeploymentUrl(input.value);
      if (!window.crypto?.getRandomValues) throw new Error('This browser cannot create a secure export request.');
      saveCurrentContent();
      let payload = googleDocsPayload(tab, page);
      const request = [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2,'0')).join('');
      const directUrl = url.href, previous = googleDocsSettings();
      const settings = {url:directUrl, origin:previous.url === directUrl ? previous.origin : ''};
      const savedLocally = saveGoogleDocsSettings(settings);
      url.searchParams.set('request', request); // Correlation only, never document data or credentials.
      openModal('Google Docs exporter', `<p>Waiting for your exporter. If it cannot connect, check the script’s allowed MegaDoc origins, sign in, or open it directly and paste a text export.</p><p id="googleDocsWarnings"></p><p id="googleDocsTransferStatus" role="status" aria-live="polite">Waiting for the iframe…</p><button id="googleDocsTrust" class="btn text hidden" type="button">Trust changed connection and send</button><p><a id="googleDocsTop" target="_blank" rel="noopener noreferrer">Open exporter directly</a></p><iframe id="googleDocsFrame" title="Google Docs exporter" referrerpolicy="no-referrer" style="width:100%;height:min(65vh,650px);border:1px solid #aaa;background:white"></iframe>`, `<button class="btn text" id="mCancel">Close</button>`);
      const frame = $('#googleDocsFrame'), status = $('#googleDocsTransferStatus'), trust = $('#googleDocsTrust');
      $('#googleDocsWarnings').textContent = payload.warnings.join(' ');
      let peer = null, origin = '', candidate = null, done = false, timer;
      function cleanup() { if (done) return; done = true; payload = null; candidate = null; clearTimeout(timer); window.removeEventListener('message',onMessage); if (googleDocsCleanup === cleanup) googleDocsCleanup = null; }
      function send(source, destination) {
        peer = source; origin = destination; candidate = null; trust.classList.add('hidden');
        status.textContent = 'Connected. Sending tab to the exporter…';
        try { peer.postMessage({type:'megadoc-export-payload',version:1,request,payload},origin); }
        catch (_) { status.textContent = 'Transfer failed. Open the exporter directly and paste a text export.'; cleanup(); }
      }
      trust.addEventListener('click',() => { if (candidate && googleDocsIsDescendant(candidate.source,frame.contentWindow)) send(candidate.source,candidate.origin); });
      function onMessage(event) {
        const msg = event.data;
        if (!msg || msg.version !== 1 || msg.request !== request || !event.source || !googleDocsScriptOrigin(event.origin) || !googleDocsIsDescendant(event.source, frame.contentWindow)) return;
        if (msg.type === 'megadoc-export-ready' && !peer) {
          if (settings.origin && settings.origin !== event.origin) {
            candidate = {source:event.source,origin:event.origin};
            status.textContent = 'The exporter connection changed. This can happen after redeployment or an account change. Confirm that you trust the deployment before sending your tab.';
            trust.classList.remove('hidden');
          } else send(event.source,event.origin);
        } else if (msg.type === 'megadoc-export-received' && peer && event.source === peer && event.origin === origin) {
          settings.origin = origin; const stored = saveGoogleDocsSettings(settings);
          status.textContent = 'Tab received. Review it in the exporter before choosing an action.' + (!stored || !savedLocally ? ' Browser storage is unavailable, so the link may not be remembered.' : ''); cleanup();
        }
      }
      googleDocsCleanup = cleanup;
      window.addEventListener('message',onMessage);
      timer = setTimeout(() => { status.textContent = 'Could not confirm transfer. Check the deployment, sign-in and allowed origin. Redeploy the latest Apps Script files to accept formatted exports, or use the direct exporter.'; trust.classList.add('hidden'); cleanup(); },30000);
      $('#googleDocsTop').href=directUrl; frame.src=url.href;
      $('#mCancel').addEventListener('click', closeModal);
    } catch (error) { const errorElement = $('#googleDocsError'); if (errorElement) errorElement.textContent = error.message; }
  });
}

function localImportDialog() {
  openModal('Import text, HTML, DOCX or ODT', `<p>Choose a plain text, HTML, Word .docx or OpenDocument .odt file to create a <b>new root tab</b>. Existing tabs are not replaced.</p><p>HTML, Word and OpenDocument files are converted and sanitized; unsupported formatting, embedded objects, scripts and document features may be lost. Images with external URLs may contact their host. Text loses formatting; JSON is the complete MegaDoc backup format.</p><p>Only import files you trust. Maximum file size: 10 MB.</p>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Choose file</button>`);
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => { closeModal(); $('#localContentFile').click(); });
}
function sanitizeImportedHTML(source, clipboard = false) {
  if (!window.DOMPurify) throw new Error('HTML sanitizer is unavailable');
  // Keep basic rich text, not embedded executable or interactive documents.
  const safe = DOMPurify.sanitize(source, {
    ALLOWED_TAGS:['p','div','br','b','strong','i','em','u','s','strike','span','h1','h2','h3','h4','h5','h6','a','ul','ol','li','blockquote','pre','code','table','thead','tbody','tfoot','tr','td','th','img','hr','sup','sub', ...(clipboard ? ['font','mark','small','big'] : [])],
    ALLOWED_ATTR:['href','src','style','alt','title','width','height','colspan','rowspan','start','value','reversed', ...(clipboard ? ['face','color','size','dir','lang'] : [])],
    ALLOW_DATA_ATTR:false, ALLOW_ARIA_ATTR:false
  });
  const doc = new DOMParser().parseFromString(safe, 'text/html');
  const allowedStyles = new Set(['color','background-color','font-family','font-size','font-weight','font-style','text-decoration','text-align','line-height','letter-spacing','text-indent','margin-left','margin-right','margin-top','margin-bottom','padding','padding-left','padding-right','border','border-color','border-width','border-style','width','height','max-width','vertical-align','list-style-type','white-space', ...(clipboard ? ['background','margin','padding-top','padding-bottom','border-top','border-bottom','border-left','border-right','text-decoration-line','text-decoration-style','text-decoration-color','text-transform','word-spacing'] : [])]);
  for (const el of doc.body.querySelectorAll('*')) {
    if (el.hasAttribute('style')) {
      const original = el.style, keep = [];
      for (let i = 0; i < original.length; i++) { const key = original[i], value = original.getPropertyValue(key); if (allowedStyles.has(key) && !/url\s*\(|expression\s*\(|var\s*\(|image-set\s*\(|@|\\/i.test(value) && (key !== 'background' || CSS.supports('color', value))) keep.push(`${key}: ${value}`); }
      if (keep.length) el.setAttribute('style', keep.join('; ')); else el.removeAttribute('style');
    }
    if (el.hasAttribute('dir') && !/^(ltr|rtl|auto)$/i.test(el.getAttribute('dir'))) el.removeAttribute('dir');
    if (el.hasAttribute('href') && !/^(https?:|mailto:|#)/i.test(el.getAttribute('href').trim())) el.removeAttribute('href');
    if (el.hasAttribute('src') && !/^(https?:|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(el.getAttribute('src').trim())) el.removeAttribute('src');
    if (el.tagName === 'A' && el.hasAttribute('href') && !el.getAttribute('href').startsWith('#')) { el.setAttribute('target','_blank'); el.setAttribute('rel','noopener noreferrer'); }
  }
  return doc.body.innerHTML;
}
function convertDocxLocally(buffer) {
  return new Promise((resolve,reject) => {
    let worker;
    try { worker = new Worker('js/docx-import-worker.js'); }
    catch { reject(new Error('Word import requires a local web server and worker support')); return; }
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Word conversion timed out')); }, 30000);
    worker.onmessage = event => { clearTimeout(timer); worker.terminate(); if (event.data?.error) reject(new Error(event.data.error)); else if (typeof event.data?.html !== 'string') reject(new Error('Invalid Word conversion result')); else resolve(event.data.html); };
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error('Word converter could not start')); };
    worker.postMessage(buffer, [buffer]);
  });
}
function runOfficeWorker(path, payload, transfer = []) {
  return new Promise((resolve,reject) => {
    let worker; try { worker = new Worker(path); } catch { reject(new Error('This operation requires worker support and a local web server')); return; }
    const timer = setTimeout(()=>{worker.terminate();reject(new Error('Conversion timed out'));},30000);
    worker.onmessage = event => { clearTimeout(timer); worker.terminate(); if (event.data?.error) reject(new Error(event.data.error)); else resolve(event.data); };
    worker.onerror = () => {clearTimeout(timer);worker.terminate();reject(new Error('Converter could not start'));};
    try { worker.postMessage(payload,transfer); } catch (err) { clearTimeout(timer);worker.terminate();reject(err); }
  });
}
function officeExportHTML(format) {
  const template = document.createElement('template'); template.innerHTML = DOMPurify.sanitize(page.innerHTML,{USE_PROFILES:{html:true,mathMl:true}});
  for (const marker of template.content.querySelectorAll('[data-megadoc-page-break]')) { const next = marker.nextElementSibling; if (next) next.style.breakBefore = 'page'; marker.remove(); }
  const notes = makeFootnotesSection();
  if (notes) {
    if (format === 'docx') { notes.setAttribute('role','doc-footnotes'); notes.querySelectorAll('li').forEach(li=>li.setAttribute('role','doc-footnote')); template.content.querySelectorAll('[data-megadoc-footnote]').forEach(ref=>ref.setAttribute('role','doc-noteref')); }
    template.content.append(notes);
  }
  const wrap = document.createElement('div'); wrap.append(template.content); return wrap.innerHTML;
}
function exportOfficeDialog(format) {
  const tab = getTab(state.activeTabId); if (!tab) { toast('Create a tab first','info'); return; }
  if (!window.DOMPurify) { toast('The HTML sanitizer is unavailable','error'); return; }
  const id = state.activeTabId;
  openModal(`Export current tab as ${format.toUpperCase()}`, `<p>Exports only this tab. Other tabs, comments, history and MegaDoc-specific settings are not included. Basic text, headings, lists and tables are converted; some formatting, equations, images, links, footnotes and page layout may change or be omitted. Remote images are not downloaded.</p><p>Export JSON for a complete MegaDoc backup.</p>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Export</button>`);
  $('#mCancel').addEventListener('click',closeModal);
  $('#mOk').addEventListener('click',async()=>{
    if (state.activeTabId !== id || !getTab(id)) {closeModal();toast('Select the tab again','info');return;}
    saveCurrentContent(); const html=officeExportHTML(format), title=tab.title || 'MegaDoc tab', setup=pageSetupValues(), dim=PAPER_SIZES[setup.paper], width=setup.orientation === 'landscape' ? dim[1] : dim[0], height=setup.orientation === 'landscape' ? dim[0] : dim[1];
    closeModal(); toast(`Exporting ${format.toUpperCase()} locally…`,'download');
    try {
      const response = format === 'docx' ? await runOfficeWorker('js/docx-export-worker.js',{html,setup:{width,height,orientation:setup.orientation,left:marginValue('left'),right:marginValue('right')}}) : await runOfficeWorker('js/odf-worker.js',{operation:'export',html,options:{pageFormat:setup.paper === 'a4' ? 'A4' : setup.paper,orientation:setup.orientation,metadata:{title},marginTop:'0.75in',marginBottom:'0.75in',marginLeft:`${marginValue('left')/96}in`,marginRight:`${marginValue('right')/96}in`}});
      const blob = format === 'docx' ? response.blob : new Blob([response.buffer],{type:'application/vnd.oasis.opendocument.text'});
      if (!(blob instanceof Blob) || !blob.size) throw new Error('Converter returned an empty file');
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${title.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_')}.${format}`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      if (response.warnings?.length) toast(`Exported with ${response.warnings.length} conversion warning(s); check the file`,'info'); else toast(`Exported ${format.toUpperCase()}; check formatting in the destination app`,'download');
    } catch (err) {toast(`Export failed: ${err.message}`,'error');}
  });
}
$('#localContentFile').addEventListener('change', async e => {
  const file = e.target.files?.[0]; e.target.value = '';
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { toast('File exceeds 10 MB', 'error'); return; }
  const isHtml = /\.html?$/i.test(file.name), isText = /\.txt$/i.test(file.name), isDocx = /\.docx$/i.test(file.name), isOdt = /\.odt$/i.test(file.name);
  if (!isHtml && !isText && !isDocx && !isOdt) { toast('Choose a .txt, .html, .docx or .odt file', 'error'); return; }
  try {
    let html;
    if (isDocx) { toast('Converting Word document locally…', 'upload_file'); html = sanitizeImportedHTML(await convertDocxLocally(await file.arrayBuffer())); }
    else if (isOdt) { toast('Converting OpenDocument locally…','upload_file'); const buffer = await file.arrayBuffer(); const result = await runOfficeWorker('js/odf-worker.js',{operation:'import',buffer},[buffer]); html = sanitizeImportedHTML(result.html); }
    else if (isHtml) html = sanitizeImportedHTML(await file.text());
    else { const text = await file.text(); const div = document.createElement('div'); div.style.whiteSpace = 'pre-wrap'; div.textContent = text.replace(/\r\n?/g, '\n'); html = div.outerHTML; }
    const name = file.name.replace(/\.(?:txt|html?|docx|odt)$/i, '').slice(0, 120) || 'Imported tab';
    addTab(null, name); page.innerHTML = html; saveCurrentContent(); updateWordCount(); save();
    toast(isDocx || isOdt ? 'Imported into a new tab; some document formatting may be lost' : 'Imported into a new tab', 'upload_file');
  } catch (err) { toast(`Import failed: ${err.message}`, 'error'); }
});
function restoreLegacy() {
  let old;
  try { old = JSON.parse(localStorage.getItem('megadoc-v1')); } catch {}
  if (!old || !old.tabs || !Array.isArray(old.roots)) { toast('No previous local document found', 'info'); return; }
  confirmModal('Restore previous document?', '<p>This replaces your current document with the previous locally saved version, which may include the old example tabs. Export your current document first if needed.</p>', 'Restore', () => {
    state = normalizeState(old); paragraphStyleUndo = []; paragraphStyleRedo = []; applyParagraphStyles(); $('#docTitle').value = state.docTitle || 'MegaDoc';
    updateAvatar(); applyPageTheme(); applyPageSetup(); loadTabContent(); renderTree(); setZoom(state.zoom || 100); save(true);
    toast('Previous document restored', 'restore');
  });
}
function resetAll() {
  confirmModal('Reset MegaDoc?', '<p>This deletes <b>all tabs and content</b> stored in this browser and starts a new empty document. Export a backup first if you need it.</p>', 'Reset everything', () => {
    localStorage.removeItem(LS_KEY);
    state = seedState(); paragraphStyleUndo = []; paragraphStyleRedo = []; applyParagraphStyles();
    $('#docTitle').value = state.docTitle; document.title = 'MegaDoc — MegaDoc';
    updateAvatar(); applyPageTheme();
    save(true); applyPageSetup(); loadTabContent(); renderTree(); setZoom(state.zoom || 100);
    toast('MegaDoc reset', 'restart_alt');
  });
}

/* ─────────────────────────── Modals ─────────────────────────── */
function openModal(title, bodyHTML, footHTML = '') {
  if (googleDocsCleanup) googleDocsCleanup();
  $('#modal').innerHTML = `
    <div class="modal-head"><span class="modal-title">${esc(title)}</span>
      <button class="icon-btn sm" id="modalClose" aria-label="Close"><span class="material-symbols-outlined">close</span></button></div>
    <div class="modal-body">${bodyHTML}</div>
    ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}`;
  $('#modalBackdrop').classList.remove('hidden');
  $('#modalClose').addEventListener('click', closeModal);
}
function closeModal() { if (googleDocsCleanup) googleDocsCleanup(); $('#modalBackdrop').classList.add('hidden'); const frame = $('#googleDocsFrame'); if (frame) { frame.remove(); $('#googleDocsTop')?.removeAttribute('href'); } }
$('#modalBackdrop').addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeModal(); });

function confirmModal(title, bodyHTML, confirmLabel, onConfirm) {
  openModal(title, bodyHTML, `<button class="btn text" id="mCancel">Cancel</button><button class="btn danger" id="mOk">${esc(confirmLabel)}</button>`);
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => { closeModal(); onConfirm(); });
}

function showShare() {
  openModal('Share your MegaDoc', `<p>Your document is stored only in this browser. Live sharing and invitations are not available.</p><p>Export a JSON copy to share or move your document. The recipient can import it into MegaDoc.</p>`,
    `<button class="btn text" id="mDone">Done</button><button class="btn primary" id="mExport">Export JSON</button>`);
  $('#mDone').addEventListener('click', closeModal);
  $('#mExport').addEventListener('click', () => { closeModal(); exportJSON(); });
}

function showDetails() {
  saveCurrentContent();
  const allText = Object.values(state.tabs).map(t => t.content.replace(/<[^>]+>/g, ' ')).join(' ');
  const words = allText.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  const chars = allText.replace(/\s+/g, '').length;
  openModal('Document details', `
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${totalTabs()}</div><div class="lbl">Tabs (incl. subtabs)</div></div>
      <div class="stat-box"><div class="num">${words.toLocaleString()}</div><div class="lbl">Words (all tabs)</div></div>
      <div class="stat-box"><div class="num">${chars.toLocaleString()}</div><div class="lbl">Characters</div></div>
      <div class="stat-box"><div class="num">${Math.max(1, Math.round(words / 200))}</div><div class="lbl">Reading time (min)</div></div>
    </div>
    <h3>Current tab</h3><p>${esc(getTab(state.activeTabId)?.title || '—')} · ${descendants(state.activeTabId).length} subtab${descendants(state.activeTabId).length === 1 ? '' : 's'} inside</p>`,
    `<button class="btn text" id="mDone">Done</button>`);
  $('#mDone').addEventListener('click', closeModal);
}

function showOutline() {
  const rows = [];
  const walk = (ids, depth) => ids.forEach(id => {
    const t = getTab(id);
    rows.push(`<button class="outline-item" data-id="${id}" style="padding-left:${8 + depth * 18}px"><span class="material-symbols-outlined">${t.children.length ? 'folder' : 'description'}</span>${esc(t.title)}</button>`);
    walk(t.children, depth + 1);
  });
  walk(state.roots, 0);
  const headings = getTab(state.activeTabId) ? [...page.querySelectorAll('h1,h2,h3,h4,h5,h6')] : [];
  const headingRows = headings.map((h, i) => `<button class="outline-item heading-outline-item" data-heading="${i}" style="padding-left:${8 + (Number(h.tagName[1]) - 1) * 12}px"><span class="heading-level">H${h.tagName[1]}</span>${esc(h.textContent.trim() || '(Untitled heading)')}</button>`).join('');
  openModal('Outline', `<h3>Current tab headings</h3><div>${headingRows || '<p>No headings in the current tab.</p>'}</div><h3>All tabs</h3><div>${rows.join('') || '<p>No tabs yet.</p>'}</div>`, `<button class="btn text" id="mDone">Done</button>`);
  $('#modal').querySelectorAll('[data-heading]').forEach(button => button.addEventListener('click', () => {
    const heading = headings[Number(button.dataset.heading)]; closeModal();
    if (heading && page.contains(heading)) navigateToHeading(heading);
  }));
  $('#modal').querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => { closeModal(); selectTab(b.dataset.id); }));
  $('#mDone').addEventListener('click', closeModal);
}
function navigateToHeading(heading) {
  if (!heading || !page.contains(heading)) return;
  const range = document.createRange(); range.selectNodeContents(heading); range.collapse(true);
  page.focus(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  editorRange = range.cloneRange(); heading.scrollIntoView({block: 'center', behavior: 'auto'});
  syncStyleLabel(sel.anchorNode); syncFormatButtons();
}
function navigateHeading(direction) {
  const headings = [...page.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  if (!headings.length) { toast('No headings in this tab', 'info'); return; }
  const sel = getSelection();
  const range = sel.rangeCount && page.contains(sel.anchorNode) ? sel.getRangeAt(0) : null;
  const candidates = range ? headings.filter(h => {
    const r = document.createRange(); r.selectNodeContents(h); r.collapse(true);
    return direction > 0 ? r.compareBoundaryPoints(Range.START_TO_START, range) > 0 : r.compareBoundaryPoints(Range.START_TO_START, range) < 0;
  }) : headings;
  const target = direction > 0 ? candidates[0] : candidates[candidates.length - 1];
  if (target) navigateToHeading(target); else toast('No more headings in this direction', 'info');
}

function showShortcuts() {
  openModal('Keyboard shortcuts', `
    <table>
      <tr><td><kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd></td><td>Bold / Italic / Underline</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>.</kbd> / <kbd>,</kbd></td><td>Superscript / Subscript</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>0–6</kbd></td><td>Normal / Heading style</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L/E/R/J</kbd></td><td>Align left / center / right / justify</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>7/8</kbd></td><td>Numbered / bulleted list</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>↑/↓</kbd></td><td>Previous / next heading</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>K</kbd></td><td>Insert link</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>F</kbd></td><td>Find in tab</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>P</kbd></td><td>Print</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd></td><td>Undo / Redo</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>/</kbd></td><td>Search menus &amp; commands</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd></td><td>New tab</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>Save now</td></tr>
      <tr><td><kbd>Double-click tab</kbd></td><td>Rename tab</td></tr>
      <tr><td><kbd>Right-click tab</kbd></td><td>Tab options menu</td></tr>
    </table>`, `<button class="btn text" id="mDone">Done</button>`);
  $('#mDone').addEventListener('click', closeModal);
}

function showAbout() {
  openModal('About MegaDoc', `
    <p><b>MegaDoc</b> — <i>“a software for putting all your notes in one document when you are too lazy to manage 15 billion of them.”</i></p>
    <h3>One document, infinite nesting</h3>
    <p>Tabs, subtabs and subsubtabs — as deep as you need. Every tab is its own page, but everything lives in one searchable document that saves automatically in your browser.</p>
    <h3>Built with</h3>
    <p>Vanilla HTML, CSS and JavaScript. No build step, no backend. Export JSON to back up or move your MegaDoc anywhere.</p>`,
    `<button class="btn text" id="mDone">Done</button>`);
  $('#mDone').addEventListener('click', closeModal);
}

const EMOJIS = ['😀','😂','😍','🤔','👍','👎','🔥','✨','💡','📝','📌','⭐','❤️','🎉','🚀','💻','🔑','📚','🎯','✅','⚠️','🔐','🌐','🧠','📁','🗂️','🔍','💾','🗑️','➕','📎','🖼️','🔗','📊','🧪','🎨','🏠'];
function tabIconPicker(id) {
  if (!getTab(id)) return;
  openModal('Tab emoji icon', `<p>Choose an emoji, or enter one of your own.</p>
    <div class="emoji-grid tab-emoji-grid">${EMOJIS.map(e => `<button type="button" data-tab-emoji="${e}" aria-label="Use ${e}">${e}</button>`).join('')}</div>
    <div class="tab-emoji-custom"><label for="tabEmojiInput">Your emoji</label><input id="tabEmojiInput" placeholder="Type or paste an emoji" maxlength="64" autocomplete="off"><button type="button" class="btn primary" id="tabEmojiApply">Apply</button></div>
    <p id="tabEmojiError" class="tab-emoji-error" role="alert"></p>`,
    `<button type="button" class="btn text" id="tabEmojiRemove">Remove icon</button><button type="button" class="btn text" id="tabEmojiCancel">Cancel</button>`);
  const apply = emoji => {
    const tab = getTab(id); if (!tab) { closeModal(); return; }
    if (emoji) tab.tabEmoji = emoji; else delete tab.tabEmoji;
    tab.updatedAt = Date.now(); save(); renderTree(); closeModal();
  };
  $('#modal').querySelectorAll('[data-tab-emoji]').forEach(b => b.addEventListener('click', () => apply(b.dataset.tabEmoji)));
  const submit = () => {
    const emoji = $('#tabEmojiInput').value.trim();
    const graphemes = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(emoji)] : [emoji];
    if (!emoji || emoji.length > 64 || graphemes.length !== 1 || !/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(emoji)) {
      $('#tabEmojiError').textContent = 'Enter one emoji.'; $('#tabEmojiInput').focus(); return;
    }
    apply(emoji);
  };
  $('#tabEmojiApply').addEventListener('click', submit);
  $('#tabEmojiInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  $('#tabEmojiRemove').addEventListener('click', () => apply(''));
  $('#tabEmojiCancel').addEventListener('click', closeModal);
}

const SYMBOLS = {
  Math: [['±','plus minus'],['×','multiply'],['÷','divide'],['≠','not equal'],['≤','less than or equal'],['≥','greater than or equal'],['∞','infinity'],['√','square root'],['∑','sum'],['∫','integral'],['∂','partial differential'],['π','pi'],['α','alpha'],['β','beta'],['θ','theta'],['Δ','delta']],
  Arrows: [['←','left arrow'],['↑','up arrow'],['→','right arrow'],['↓','down arrow'],['↔','left right arrow'],['⇒','right double arrow'],['⇐','left double arrow']],
  Punctuation: [['—','em dash'],['–','en dash'],['…','ellipsis'],['“','left quotation mark'],['”','right quotation mark'],['‘','left single quotation mark'],['’','right single quotation mark'],['•','bullet'],['©','copyright'],['®','registered'],['™','trademark'],['§','section'],['¶','paragraph']],
  Currency: [['$','dollar'],['€','euro'],['£','pound'],['¥','yen'],['₹','rupee'],['₩','won'],['¢','cent']],
  Emoji: EMOJIS.map(e => [e, 'emoji']),
};
function emojiPicker() {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  openModal('Emoji & special characters', `<div class="field"><label for="symbolSearch">Search by name or Unicode (for example U+2192)</label><input id="symbolSearch" autocomplete="off" placeholder="Search symbols…"></div><div class="field"><label for="symbolCategory">Category</label><select id="symbolCategory"><option>All</option>${Object.keys(SYMBOLS).map(k => `<option>${k}</option>`).join('')}</select></div><div class="emoji-grid" id="symbolGrid"></div><p id="symbolStatus" aria-live="polite"></p>`, `<button class="btn text" id="mDone">Done</button>`);
  const search = $('#symbolSearch'), category = $('#symbolCategory'), grid = $('#symbolGrid');
  function draw() {
    const q = search.value.trim().toLowerCase();
    let entries = Object.entries(SYMBOLS).filter(([name]) => category.value === 'All' || category.value === name).flatMap(([name, values]) => values.map(([char, description]) => ({char, description, name})));
    entries = entries.filter(({char, description, name}) => !q || char.includes(q) || description.includes(q) || name.toLowerCase().includes(q) || ('u+' + char.codePointAt(0).toString(16)).includes(q));
    const match = /^(?:u\+|0x)([0-9a-f]{1,6})$/i.exec(q);
    if (match) {
      const code = parseInt(match[1], 16);
      if (code >= 0x20 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) && !entries.some(e => e.char === String.fromCodePoint(code))) entries.unshift({ char: String.fromCodePoint(code), description: 'Unicode ' + q.toUpperCase(), name: 'Unicode' });
    }
    grid.innerHTML = entries.map(({char, description}) => `<button type="button" data-symbol="${esc(char)}" title="${esc(description)}" aria-label="${esc(description)} ${esc(char)}">${esc(char)}</button>`).join('');
    $('#symbolStatus').textContent = entries.length ? '' : 'No matching characters.';
    grid.querySelectorAll('[data-symbol]').forEach(button => button.addEventListener('click', () => { const value = button.dataset.symbol; closeModal(); exec('insertText', value); }));
  }
  search.addEventListener('input', draw); category.addEventListener('change', draw); $('#mDone').addEventListener('click', closeModal); draw();
}

function commandPalette() {
  const cmds = [];
  MENUS.forEach(m => m.items.forEach(it => { if (!it.sep) cmds.push({ label: `${m.label} → ${it.label}`, icon: it.icon, shortcut: it.shortcut || '', fn: it.fn }); }));
  openModal('Search menus', `
    <div class="cmd-search"><span class="material-symbols-outlined">search</span><input id="cmdInput" placeholder="Type a command…" /></div>
    <div class="cmd-list" id="cmdList"></div>`);
  const input = $('#cmdInput'), list = $('#cmdList');
  const draw = q => {
    const filtered = cmds.filter(c => c.label.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
    list.innerHTML = filtered.map((c, i) => `<button class="cmd-item ${i === 0 ? 'sel' : ''}" data-i="${cmds.indexOf(c)}">${menuIcon(c.icon)}${esc(c.label)}${c.shortcut ? `<span class="shortcut">${c.shortcut}</span>` : ''}</button>`).join('') || '<p style="padding:12px;color:var(--ink-3)">No commands found.</p>';
    list.querySelectorAll('.cmd-item').forEach(b => b.addEventListener('click', () => { closeModal(); cmds[+b.dataset.i].fn(); }));
  };
  draw('');
  input.focus();
  input.addEventListener('input', () => draw(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = list.querySelector('.cmd-item'); if (first) { closeModal(); cmds[+first.dataset.i].fn(); } }
  });
}

/* ─────────────────────────── Appearance ─────────────────────────── */
const APPEARANCE_KEY = 'megadoc-appearance-v1';
const ACCENTS = [
  { id: 'indigo', label: 'Indigo', color: '#4c50c5' },
  { id: 'ocean', label: 'Ocean', color: '#1168ad' },
  { id: 'teal', label: 'Teal', color: '#08766b' },
  { id: 'violet', label: 'Violet', color: '#744bb3' },
  { id: 'berry', label: 'Berry', color: '#a13f63' },
  { id: 'amber', label: 'Amber', color: '#895c00' },
];
let appearance = { theme: 'light', accent: 'indigo', markdown: true };
try {
  const saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY));
  if (saved && ['light', 'dark'].includes(saved.theme)) appearance.theme = saved.theme;
  if (saved && ACCENTS.some(a => a.id === saved.accent)) appearance.accent = saved.accent;
  if (saved && typeof saved.markdown === 'boolean') appearance.markdown = saved.markdown;
} catch { /* defaults when local storage is unavailable or invalid */ }
function applyAppearance() {
  document.documentElement.dataset.uiTheme = appearance.theme;
  document.documentElement.dataset.accent = appearance.accent;
}
function saveAppearance() {
  applyAppearance();
  try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance)); }
  catch { toast('Appearance could not be saved in this browser', 'error'); }
}
function showAppearance() {
  openModal('Appearance', `
    <div class="appearance-group">
      <h3>Interface theme</h3>
      <div class="theme-choices">
        <label class="theme-choice"><input type="radio" name="uiTheme" value="light" ${appearance.theme === 'light' ? 'checked' : ''}><span class="material-symbols-outlined">light_mode</span><span>Light</span></label>
        <label class="theme-choice"><input type="radio" name="uiTheme" value="dark" ${appearance.theme === 'dark' ? 'checked' : ''}><span class="material-symbols-outlined">dark_mode</span><span>Dark</span></label>
      </div>
    </div>
    <div class="appearance-group">
      <h3>Accent color</h3>
      <div class="accent-choices">${ACCENTS.map(a => `<label class="accent-choice"><input type="radio" name="accentColor" value="${a.id}" ${appearance.accent === a.id ? 'checked' : ''}><span class="accent-dot" style="--swatch:${a.color}"></span><span>${a.label}</span></label>`).join('')}</div>
    </div>
    <p class="appearance-note">Appearance is saved on this device and does not change your document’s formatting.</p>`,
    `<button class="btn primary" id="appearanceDone">Done</button>`);
  $$('#modal [name="uiTheme"]').forEach(input => input.addEventListener('change', () => { appearance.theme = input.value; saveAppearance(); }));
  $$('#modal [name="accentColor"]').forEach(input => input.addEventListener('change', () => { appearance.accent = input.value; saveAppearance(); }));
  $('#appearanceDone').addEventListener('click', closeModal);
}

function showWritingSettings() {
  openModal('Writing preferences', `
    <label class="setting-toggle"><input type="checkbox" id="markdownEnabled" ${appearance.markdown ? 'checked' : ''}>
      <span><strong>Markdown shortcuts</strong><small>Automatically format headings, lists, quotes, code and inline text as you type.</small></span>
    </label>
    <p class="appearance-note">Type a marker such as #, -, 1., &gt; or three backticks followed by a space. Finish inline Markdown, then type a space or press Enter.</p>`,
    `<button class="btn primary" id="writingDone">Done</button>`);
  $('#markdownEnabled').addEventListener('change', e => { appearance.markdown = e.target.checked; saveAppearance(); });
  $('#writingDone').addEventListener('click', closeModal);
}

/* ─────────────────────────── View / theme helpers ─────────────────────────── */
function togglePanel() {
  if (innerWidth <= 900) {
    if (document.body.classList.contains('panel-collapsed')) { document.body.classList.remove('panel-collapsed'); $('#tabsPanel').classList.add('open'); }
    else $('#tabsPanel').classList.toggle('open');
    $('#panelReopen').setAttribute('aria-expanded', String($('#tabsPanel').classList.contains('open')));
    return;
  }
  document.body.classList.toggle('panel-collapsed');
  $('#panelReopen').setAttribute('aria-expanded', String(!document.body.classList.contains('panel-collapsed')));
  buildRuler();
}
function togglePageTheme(kind) {
  state.pageTheme[kind] = !state.pageTheme[kind];
  applyPageTheme();
  save();
  toast(kind === 'dark' ? (state.pageTheme.dark ? 'Dark page on' : 'Dark page off') : (state.pageTheme.contrast ? 'High contrast on' : 'High contrast off'), kind === 'dark' ? 'dark_mode' : 'contrast');
}
function applyPageTheme() {
  page.classList.toggle('dark-page', !!state.pageTheme.dark);
  page.classList.toggle('high-contrast', !!state.pageTheme.contrast);
}

/* ─────────────────────────── Insert modals ─────────────────────────── */
function linkModal() {
  if (!getTab(state.activeTabId)) { toast('Create a tab first', 'link_off'); return; }
  const sel = getSelection();
  const selected = sel.rangeCount ? sel.toString() : '';
  openModal('Insert link', `
    <div class="field"><label>Link text</label><input id="linkText" value="${esc(selected)}" placeholder="Text to display" /></div>
    <div class="field"><label>URL</label><input id="linkUrl" placeholder="https://…" /></div>`,
    `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Insert link</button>`);
  $('#linkUrl').focus();
  $('#mCancel').addEventListener('click', closeModal);
  const doInsert = () => {
    const url = $('#linkUrl').value.trim();
    const text = $('#linkText').value.trim();
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) { toast('Enter an http, https, or mailto URL', 'error'); return; }
    closeModal();
    if (!selected || (text && text !== selected)) exec('insertHTML', `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text || url)}</a>`);
    else exec('createLink', url);
    toast('Link inserted', 'link');
  };
  $('#mOk').addEventListener('click', doInsert);
  $('#linkUrl').addEventListener('keydown', e => { if (e.key === 'Enter') doInsert(); });
}
// Internal links use tab IDs and bookmark IDs, scoped to their tab. Heading
// links keep an index and title snapshot and fail safely if headings change.
function bookmarkModal(existing = null) {
  const tabId = state.activeTabId;
  if (!getTab(tabId) || mode === 'viewing' || (existing && !page.contains(existing))) { toast('Open an editable tab first', 'edit_off'); return; }
  if (!existing) { focusPage(); const sel = getSelection(); if (!sel.rangeCount || !page.contains(sel.anchorNode)) return; if (!sel.isCollapsed) { toast('Place the caret where the bookmark should go', 'info'); return; } const at = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement; if (at?.closest('a,[contenteditable="false"]')) { toast('Place the bookmark outside a link or protected object', 'info'); return; } }
  const key = existing?.dataset.megadocBookmark || `b-${uid()}-${uid()}`;
  openModal(existing ? 'Edit bookmark' : 'Insert bookmark', `<div class="field"><label for="bookmarkName">Name</label><input id="bookmarkName" maxlength="100" value="${esc(existing?.dataset.bookmarkName || '')}" placeholder="Bookmark name"></div><p>Bookmarks belong to the current tab. Link to them from any tab using Insert → Link to tab, bookmark or heading.</p>`, `<button class="btn text" id="mCancel">Cancel</button>${existing ? '<button class="btn text" id="bookmarkRemove">Remove</button>' : ''}<button class="btn primary" id="mOk">${existing ? 'Save' : 'Insert'}</button>`);
  $('#mCancel').addEventListener('click', closeModal); $('#bookmarkName').focus();
  const apply = remove => {
    const name = $('#bookmarkName').value.trim();
    if (!remove && (!name || name.length > 100)) { toast('Enter a bookmark name', 'error'); return; }
    if (state.activeTabId !== tabId || mode === 'viewing' || (existing && !page.contains(existing))) { closeModal(); toast('Select the location again', 'error'); return; }
    const html = remove ? '' : `<a href="#" class="megadoc-bookmark" data-megadoc-bookmark="${esc(key)}" data-bookmark-name="${esc(name)}" title="${esc('Bookmark: ' + name)}" role="button" tabindex="0" aria-label="${esc('Edit bookmark: ' + name)}">🔖</a>`;
    closeModal();
    if (existing) { const range = document.createRange(); range.selectNode(existing); page.focus(); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); editorRange = range.cloneRange(); }
    exec('insertHTML', html);
  };
  $('#mOk').addEventListener('click', () => apply(false)); $('#bookmarkRemove')?.addEventListener('click', () => apply(true));
}
function internalLinkModal() {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  focusPage(); const selection = getSelection(); const selected = selection.rangeCount && page.contains(selection.anchorNode) ? selection.toString() : '';
  if (!selection.rangeCount || !page.contains(selection.anchorNode) || !page.contains(selection.focusNode)) { toast('Select a location in the page first', 'info'); return; }
  const selectedRange = selection.getRangeAt(0), parent = node => node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const start = parent(selectedRange.startContainer), end = parent(selectedRange.endContainer), blockSelector = 'p,div,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,pre';
  if (start?.closest('a,[contenteditable="false"]') || end?.closest('a,[contenteditable="false"]') || (start?.closest(blockSelector) || page) !== (end?.closest(blockSelector) || page) || [...page.querySelectorAll('a,[contenteditable="false"]')].some(el => selectedRange.intersectsNode(el))) { toast('Choose text within one block and outside links or protected objects', 'info'); return; }
  const sourceTab = state.activeTabId;
  saveCurrentContent();
  const targets = [];
  const walk = ids => { for (const id of ids) { const tab = getTab(id); if (!tab) continue; targets.push({tab:id,type:'tab',name:pathTo(id).map(t=>t.title).join(' / ')}); const template = document.createElement('template'); template.innerHTML = tab.content; const nodes = [...template.content.querySelectorAll('h1,h2,h3,h4,h5,h6,[data-megadoc-bookmark]')].filter(n => !n.closest('[contenteditable="false"]')); let headingIndex = 0; for (const node of nodes) { if (node.hasAttribute('data-megadoc-bookmark')) targets.push({tab:id,type:'bookmark',key:node.dataset.megadocBookmark,name:`${tab.title} · Bookmark: ${node.dataset.bookmarkName || 'Unnamed'}`}); else { const text = node.textContent.trim() || '(Untitled heading)'; targets.push({tab:id,type:'heading',index:headingIndex++,text,headingId:node.id || '',name:`${tab.title} · ${node.tagName}: ${text}`}); } } walk(tab.children); } };
  walk(state.roots);
  openModal('Link to tab, bookmark or heading', `<div class="field"><label for="internalLinkText">Link text</label><input id="internalLinkText" value="${esc(selected)}" placeholder="Text to display"></div><div class="field"><label for="internalLinkTarget">Destination</label><select id="internalLinkTarget">${targets.map((t,i) => `<option value="${i}">${esc(t.name)}</option>`).join('')}</select></div><p>Links navigate within this MegaDoc. Update heading links if headings are renamed or reordered. Inserting a link replaces selected text with the text above.</p>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Insert link</button>`);
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    const target = targets[Number($('#internalLinkTarget').value)], text = $('#internalLinkText').value.trim();
    if (!target || !getTab(target.tab) || state.activeTabId !== sourceTab || mode === 'viewing') { closeModal(); toast('Select the link location again', 'error'); return; }
    if (!text) { toast('Enter link text', 'error'); return; }
    const data = target.type === 'bookmark' ? ` data-megadoc-bookmark-target="${esc(target.key)}"` : target.type === 'heading' ? ` data-megadoc-heading-index="${target.index}" data-megadoc-heading-text="${esc(target.text)}"${target.headingId ? ` data-megadoc-heading-id="${esc(target.headingId)}"` : ''}` : '';
    closeModal(); exec('insertHTML', `<a href="#" data-megadoc-tab-target="${esc(target.tab)}"${data}>${esc(text)}</a>`);
  });
}
function followInternalLink(link) {
  const id = link.dataset.megadocTabTarget, key = link.dataset.megadocBookmarkTarget, index = link.dataset.megadocHeadingIndex, text = link.dataset.megadocHeadingText, headingId = link.dataset.megadocHeadingId;
  if (!getTab(id)) { toast('The target tab no longer exists', 'info'); return; }
  if (state.activeTabId !== id) selectTab(id);
  let target;
  if (key) { const matches = [...page.querySelectorAll('[data-megadoc-bookmark]')].filter(n => n.dataset.megadocBookmark === key); target = matches.length === 1 ? matches[0] : null; }
  else if (index !== undefined) { const headings = [...page.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(n => !n.closest('[contenteditable="false"]'));
    if (headingId) { const matches = headings.filter(n => n.id === headingId); target = matches.length === 1 ? matches[0] : null; }
    else { const matches = headings.filter(n => (n.textContent.trim() || '(Untitled heading)') === text); target = matches.length === 1 ? matches[0] : null; }
  }
  else target = page;
  if (!target) { toast('The bookmark or heading changed, is ambiguous, or no longer exists', 'info'); return; }
  target.scrollIntoView({block:'center', behavior:'smooth'});
  if (mode !== 'viewing') { page.focus(); const range = document.createRange(); if (target === page) { range.selectNodeContents(page); range.collapse(true); } else { range.selectNode(target); range.collapse(true); } const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); }
}
page.addEventListener('click', e => {
  const link = e.target.closest('a[data-megadoc-tab-target]');
  if (link && page.contains(link)) { e.preventDefault(); followInternalLink(link); return; }
  const mark = e.target.closest('[data-megadoc-bookmark]');
  if (mark && page.contains(mark) && mode !== 'viewing') { e.preventDefault(); bookmarkModal(mark); }
});
page.addEventListener('keydown', e => {
  const mark = e.target.closest?.('[data-megadoc-bookmark]');
  if (mark && page.contains(mark) && mode !== 'viewing' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); bookmarkModal(mark); }
});

// Notes live on their reference anchors. Printable/end-of-tab notes are derived
// outside the editor so saving, undo and older versions retain the source data.
function footnoteEntries() {
  const seen = new Set(), result = [];
  for (const anchor of page.querySelectorAll('a[data-megadoc-footnote]')) {
    const key = anchor.dataset.megadocFootnote, number = Number(anchor.dataset.footnoteNumber), text = anchor.dataset.footnoteText;
    if (!key || seen.has(key) || !Number.isSafeInteger(number) || number < 1 || typeof text !== 'string') continue;
    seen.add(key); result.push({key,number,text});
  }
  return result;
}
function makeFootnotesSection() {
  const notes = footnoteEntries(); if (!notes.length) return null;
  const section = document.createElement('section'), title = document.createElement('h2'), list = document.createElement('ol');
  section.className = 'megadoc-footnotes'; title.textContent = 'Footnotes (end of tab)'; section.append(title);
  for (const note of notes) {
    const li = document.createElement('li'); li.value = note.number; li.id = `md-note-${note.key}`;
    const text = document.createElement('span'); text.style.whiteSpace = 'pre-wrap'; text.textContent = note.text; li.append(text, ' ');
    const back = document.createElement('a'); back.href = `#md-ref-${note.key}`; back.textContent = '↩'; back.setAttribute('aria-label', `Back to reference ${note.number}`); li.append(back); list.append(li);
  }
  section.append(list); return section;
}
addEventListener('beforeprint', () => { const out = $('#footnotesPrint'); out.replaceChildren(); const section = makeFootnotesSection(); if (section) out.append(section); });
addEventListener('afterprint', () => $('#footnotesPrint').replaceChildren());
function footnoteModal(existing = null) {
  const tabId = state.activeTabId;
  if (!getTab(tabId) || (existing && !page.contains(existing)) || (!existing && mode === 'viewing')) { toast('Open an editable tab first', 'edit_off'); return; }
  if (!existing) {
    focusPage(); const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed || !page.contains(sel.anchorNode)) { toast('Place the caret where the reference should go', 'info'); return; }
    const at = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
    if (at?.closest('a,[contenteditable="false"]')) { toast('Place the reference outside a link or protected object', 'info'); return; }
  }
  const readonly = mode === 'viewing', text = existing?.dataset.footnoteText || '';
  openModal(readonly ? 'Footnote' : existing ? 'Edit footnote' : 'Insert footnote', `<div class="field"><label for="footnoteText">Note text</label><textarea id="footnoteText" rows="5" maxlength="5000" ${readonly ? 'readonly' : ''}>${esc(text)}</textarea></div><p>Notes are numbered within this tab. Paginated preview and its print option place notes at the bottom of the page; HTML and text exports keep linked or numbered endnotes. Numbers may have gaps after removal.</p>`, `<button class="btn text" id="mCancel">${readonly ? 'Close' : 'Cancel'}</button>${!readonly && existing ? '<button class="btn text" id="footnoteRemove">Remove</button>' : ''}${!readonly ? `<button class="btn primary" id="mOk">${existing ? 'Save' : 'Insert'}</button>` : ''}`);
  $('#mCancel').addEventListener('click', closeModal); if (!readonly) $('#footnoteText').focus();
  if (readonly) return;
  const apply = remove => {
    const value = $('#footnoteText').value.trim();
    if (!remove && (!value || value.length > 5000)) { toast('Enter note text (up to 5000 characters)', 'info'); return; }
    if (state.activeTabId !== tabId || mode === 'viewing' || (existing && !page.contains(existing))) { closeModal(); toast('Select the reference again', 'error'); return; }
    if (!remove && existing && [...page.querySelectorAll('a[data-megadoc-footnote]')].filter(a => a.dataset.megadocFootnote === existing.dataset.megadocFootnote).length !== 1) { toast('Copied references share an ID; delete the duplicate before editing', 'info'); return; }
    let anchor;
    if (!remove) {
      if (existing) anchor = existing.cloneNode(true);
      else {
        const entries = footnoteEntries(); let number = 1; for (const entry of entries) number = Math.max(number, entry.number + 1);
        const key = `f-${uid()}-${uid()}`; anchor = document.createElement('a'); anchor.dataset.megadocFootnote = key; anchor.dataset.footnoteNumber = String(number); anchor.id = `md-ref-${key}`; anchor.href = `#md-note-${key}`;
        const sup = document.createElement('sup'); sup.textContent = `[${number}]`; anchor.append(sup);
      }
      anchor.classList.add('megadoc-footnote-ref'); anchor.dataset.footnoteText = value; anchor.title = `Footnote ${anchor.dataset.footnoteNumber}: ${value}`; anchor.setAttribute('aria-label', `Footnote ${anchor.dataset.footnoteNumber}: ${value}`);
    }
    closeModal();
    if (existing) { const r = document.createRange(); r.selectNode(existing); page.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); editorRange = r.cloneRange(); }
    exec('insertHTML', remove ? '' : anchor.outerHTML);
  };
  $('#mOk').addEventListener('click', () => apply(false)); $('#footnoteRemove')?.addEventListener('click', () => apply(true));
}
page.addEventListener('click', e => { const ref = e.target.closest('a[data-megadoc-footnote]'); if (ref && page.contains(ref)) { e.preventDefault(); footnoteModal(ref); } });

// Contents is saved as an ordinary table and a snapshot of heading targets.
// It does not mutate headings or other tabs when generated.
function contentsHeadings() { return [...page.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => !h.closest('[contenteditable="false"],table[data-megadoc-toc]')); }
function makeContentsTable() {
  const headings = contentsHeadings(); if (!headings.length) return null;
  const table = document.createElement('table'); table.className = 'megadoc-toc'; table.dataset.megadocToc = '1';
  const body = table.createTBody(), header = body.insertRow().insertCell(); header.textContent = 'Contents'; header.className = 'megadoc-toc-title';
  headings.forEach((heading,index) => {
    const row = body.insertRow(), cell = row.insertCell(); cell.className = `toc-level-${heading.tagName[1]}`;
    const a = document.createElement('a'); a.href = heading.id ? `#${heading.id}` : '#'; a.dataset.megadocTocIndex = String(index); a.dataset.megadocTocText = heading.textContent.trim() || '(Untitled heading)'; if (heading.id) a.dataset.megadocTocId = heading.id; a.textContent = a.dataset.megadocTocText;
    cell.append(a);
  });
  return table;
}
function tocCommand(action) {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  focusPage(); const sel = getSelection();
  if (!sel.rangeCount || !page.contains(sel.anchorNode) || !page.contains(sel.focusNode)) { toast('Place the caret in the page first', 'info'); return; }
  const node = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
  if (action === 'insert') {
    if (!sel.isCollapsed || node?.closest('table,ul,ol,a,[contenteditable="false"]')) { toast('Place the caret outside tables, lists and links', 'info'); return; }
    const table = makeContentsTable(); if (!table) { toast('Add a heading to this tab first', 'info'); return; }
    exec('insertHTML', table.outerHTML); return;
  }
  const table = node?.closest('table[data-megadoc-toc]');
  if (!table || !page.contains(table)) { toast('Place the caret inside the table of contents first', 'info'); return; }
  if (action === 'update') {
    const replacement = makeContentsTable(); if (!replacement) { toast('Add a heading to this tab first', 'info'); return; }
    replaceEditedTable(table,replacement);
  } else {
    const r = document.createRange(); r.selectNode(table); page.focus(); sel.removeAllRanges(); sel.addRange(r); editorRange = r.cloneRange(); exec('insertHTML','');
  }
}
page.addEventListener('click', e => {
  const link = e.target.closest('a[data-megadoc-toc-index]');
  if (!link || !page.contains(link)) return;
  e.preventDefault();
  const headings = contentsHeadings(), id = link.dataset.megadocTocId, text = link.dataset.megadocTocText; let target;
  if (id) { const matches = headings.filter(h => h.id === id); target = matches.length === 1 ? matches[0] : null; }
  else { const matches = headings.filter(h => (h.textContent.trim() || '(Untitled heading)') === text); target = matches.length === 1 ? matches[0] : null; }
  if (!target) { toast('Headings changed or are ambiguous; update the table of contents', 'info'); return; }
  target.scrollIntoView({block:'center',behavior:'smooth'});
  if (mode !== 'viewing') { page.focus(); const r = document.createRange(); r.selectNodeContents(target); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
});

// Equations are stored as MathML plus the source. Both are ordinary HTML, so
// an older reader can preserve and display them without loading a renderer.
function equationMarkup(latex) {
  if (!window.katex) throw new Error('Equation renderer is unavailable');
  if (!latex.trim() || latex.length > 4000) throw new Error('Enter an equation of at most 4000 characters');
  const math = window.katex.renderToString(latex, {output:'mathml', throwOnError:true, trust:false, strict:'error', maxExpand:100});
  return `<span class="document-equation" data-megadoc-equation="${esc(latex)}" contenteditable="false" role="button" tabindex="0" aria-label="Edit equation">${math}</span>`;
}
function equationModal(existing = null) {
  const tabId = state.activeTabId;
  if (!getTab(tabId) || mode === 'viewing' || (existing && !page.contains(existing))) { toast('Open an editable tab first', 'edit_off'); return; }
  const original = existing?.getAttribute('data-megadoc-equation') || '';
  openModal(existing ? 'Edit equation' : 'Insert equation', `<div class="field"><label for="equationSource">Equation (TeX syntax)</label><textarea id="equationSource" rows="3" placeholder="For example: \\frac{a}{b} + x^2">${esc(original)}</textarea></div><p>Supports fractions, superscripts, subscripts, Greek letters and common mathematical symbols. All rendering stays on this device.</p><div class="equation-preview" id="equationPreview" aria-label="Equation preview"></div><p class="equation-error" id="equationError" role="alert"></p>`, `<button class="btn text" id="mCancel">Cancel</button>${existing ? '<button class="btn text" id="equationRemove">Remove</button>' : ''}<button class="btn primary" id="mOk">${existing ? 'Apply' : 'Insert'}</button>`);
  const input = $('#equationSource'), preview = $('#equationPreview'), error = $('#equationError');
  const update = () => {
    if (!input.value.trim()) { preview.innerHTML = ''; error.textContent = ''; return false; }
    try { preview.innerHTML = equationMarkup(input.value); error.textContent = ''; return true; }
    catch (e) { preview.innerHTML = ''; error.textContent = e.message; return false; }
  };
  input.addEventListener('input', update); update(); input.focus();
  $('#mCancel').addEventListener('click', closeModal);
  const replace = html => {
    if (!existing || state.activeTabId !== tabId || !page.contains(existing) || mode === 'viewing') { toast('Select the equation again', 'error'); return; }
    // Include enclosing inline markup so replacing the equation does not strip links or styles.
    let target = existing;
    while (target.parentElement && target.parentElement !== page && !/^(P|DIV|H[1-6]|BLOCKQUOTE|PRE|LI|TD|TH|FIGURE|FIGCAPTION)$/.test(target.parentElement.tagName)) target = target.parentElement;
    const copy = target.cloneNode(true);
    if (target === existing) html = html || '';
    else {
      const all = [...target.querySelectorAll('[data-megadoc-equation]')], index = all.indexOf(existing);
      const item = copy.querySelectorAll('[data-megadoc-equation]')[index];
      if (!item) return;
      if (html) { const template = document.createElement('template'); template.innerHTML = html; item.replaceWith(template.content); } else item.remove();
      html = copy.outerHTML;
    }
    const range = document.createRange(); range.selectNode(target); page.focus();
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    programmaticEdit = true; let ok;
    try { ok = document.execCommand('insertHTML', false, html); } finally { programmaticEdit = false; }
    if (!ok) { toast('Could not update equation', 'error'); return; }
    editorRange = selection.rangeCount && page.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
    saveCurrentContent(); updateWordCount(); save();
  };
  $('#mOk').addEventListener('click', () => {
    if (!update()) { if (!input.value.trim()) error.textContent = 'Enter an equation.'; return; }
    const html = equationMarkup(input.value); closeModal();
    if (existing) replace(html); else if (state.activeTabId === tabId) exec('insertHTML', html);
  });
  if (existing) $('#equationRemove').addEventListener('click', () => { closeModal(); replace(''); });
}
page.addEventListener('click', e => {
  const equation = e.target.closest('[data-megadoc-equation]');
  if (equation && page.contains(equation) && mode !== 'viewing') { e.preventDefault(); equationModal(equation); }
});
page.addEventListener('keydown', e => {
  const equation = e.target.closest('[data-megadoc-equation]');
  if (equation && mode !== 'viewing' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); equationModal(equation); }
});

function imageModal() {
  if (!getTab(state.activeTabId)) { toast('Create a tab first', 'image_not_supported'); return; }
  openModal('Insert image', `
    <div class="field"><label>Image URL</label><input id="imgUrl" placeholder="https://…" /></div>
    <div class="field"><label>…or upload a file</label><input type="file" id="imgFile" accept="image/*" /></div>`,
    `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Insert image</button>`);
  $('#imgUrl').focus();
  $('#mCancel').addEventListener('click', closeModal);
  const doInsert = () => {
    const url = $('#imgUrl').value.trim();
    const file = $('#imgFile').files[0];
    const insert = src => { closeModal(); exec('insertImage', src); toast('Image inserted', 'image'); };
    if (file) {
      const reader = new FileReader();
      reader.onload = () => insert(reader.result);
      reader.readAsDataURL(file);
    } else if (/^https?:\/\//i.test(url)) insert(url);
    else toast('Enter an http or https URL, or choose a file', 'error');
  };
  $('#mOk').addEventListener('click', doInsert);
}

/* ─────────────────────────── History / comments / profile / move ─────────────────────────── */
function showHistory() {
  const t = getTab(state.activeTabId);
  if (!t) { toast('Create a tab first', 'history'); return; }
  const items = [...t.history].reverse().map((h, i) => {
    const idx = t.history.length - 1 - i;
    const preview = h.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '(empty)';
    return `<div class="history-item"><span class="h-avatar"><span class="material-symbols-outlined" style="font-size:16px">history</span></span>
      <div class="h-body"><div class="h-meta">${new Date(h.t).toLocaleString()}</div><div class="h-preview">${esc(preview)}</div></div>
      <button class="btn text" data-restore="${idx}">Restore</button></div>`;
  }).join('');
  openModal(`Version history — ${t.title}`, `
    <p>Last edited ${new Date(t.updatedAt).toLocaleString()}. MegaDoc keeps the last 25 saved versions of this tab.</p>
    ${items || '<p style="color:var(--ink-3)">No saved versions yet — keep editing and versions will appear here.</p>'}`,
    `<button class="btn text" id="mDone">Done</button>`);
  $('#modal').querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => {
    const h = t.history[+b.dataset.restore];
    if (!h) return;
    t.history.push({ t: Date.now(), content: t.content });
    if (t.history.length > 25) t.history.shift();
    t.content = h.content; t.updatedAt = Date.now();
    loadTabContent(); save();
    closeModal();
    toast('Version restored', 'history');
  }));
  $('#mDone').addEventListener('click', closeModal);
}

function showComments() {
  const t = getTab(state.activeTabId);
  if (!t) { toast('Create a tab first', 'comment'); return; }
  const items = t.comments.map(c => `<div class="comment-item"><span class="c-avatar">${esc((c.author || 'M')[0].toUpperCase())}</span>
    <div class="c-body"><div class="c-meta">${esc(c.author)} · ${new Date(c.t).toLocaleString()}</div><div class="c-text">${esc(c.text)}</div></div>
    <button class="icon-btn sm" data-del="${c.id}" title="Delete comment"><span class="material-symbols-outlined">delete</span></button></div>`).join('');
  openModal(`Comments — ${t.title} (${t.comments.length})`, `
    ${items || '<p style="color:var(--ink-3)">No comments yet. Add the first one below.</p>'}
    <div class="field" style="margin-top:12px"><label>New comment</label><textarea id="commentText" rows="3" placeholder="Write a comment…"></textarea></div>`,
    `<button class="btn text" id="mDone">Done</button><button class="btn primary" id="addComment">Add comment</button>`);
  $('#addComment').addEventListener('click', () => {
    const text = $('#commentText').value.trim();
    if (!text) { toast('Write something first', 'error'); return; }
    t.comments.push({ id: uid(), text, t: Date.now(), author: state.profile.name });
    save(); closeModal(); showComments();
    toast('Comment added', 'comment');
  });
  $('#modal').querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    t.comments = t.comments.filter(c => c.id !== b.dataset.del);
    save(); closeModal(); showComments();
    toast('Comment deleted', 'delete');
  }));
  $('#mDone').addEventListener('click', closeModal);
}

function updateAvatar() {
  const av = $('#avatarBtn');
  av.textContent = (state.profile.name || 'M')[0].toUpperCase();
  av.style.background = state.profile.color || '#4d5d85';
  av.title = state.profile.name;
}
function showProfile() {
  const colors = ['#4d5d85', '#0f766e', '#b3261e', '#9334e6', '#e8710a', '#188038', '#5f6368'];
  openModal('Your profile', `
    <div class="profile-preview"><span class="avatar" id="profAvatar" style="background:${state.profile.color}">${esc((state.profile.name || 'M')[0].toUpperCase())}</span>
      <div><div style="font-weight:500">${esc(state.profile.name)}</div><div style="font-size:12px;color:var(--ink-3)">Stored locally in this browser</div></div></div>
    <div class="field"><label>Display name</label><input id="profName" value="${esc(state.profile.name)}" /></div>
    <div class="field"><label>Avatar colour</label><div class="swatch-row">${colors.map(c => `<button class="swatch" data-c="${c}" style="background:${c}"></button>`).join('')}</div></div>`,
    `<button class="btn text" id="mDone">Done</button><button class="btn primary" id="profSave">Save</button>`);
  $('#modal').querySelectorAll('.swatch').forEach(s => s.addEventListener('click', () => {
    state.profile.color = s.dataset.c;
    $('#profAvatar').style.background = s.dataset.c;
  }));
  $('#profSave').addEventListener('click', () => {
    state.profile.name = $('#profName').value.trim() || 'MegaDoc user';
    updateAvatar(); save(); closeModal();
    toast('Profile saved', 'account_circle');
  });
  $('#mDone').addEventListener('click', closeModal);
}

// Page view belongs to each tab and changes presentation only, not stored HTML.
function applyTabView() {
  document.body.classList.toggle('pageless-view', getTab(state.activeTabId)?.pageView === 'pageless');
  buildRuler();
  const wrap = $('#pageWrap');
  wrap.style.marginBottom = `${((state.zoom || 100) / 100 - 1) * page.offsetHeight}px`;
}
function tabViewModal() {
  const tab = getTab(state.activeTabId);
  if (!tab) { toast('Create a tab first', 'info'); return; }
  const id = state.activeTabId;
  openModal('Page view for this tab', `<p>Choose how to edit this tab. Pageless fills the available width and hides page boundaries and the page-margin ruler.</p><fieldset class="view-choices"><legend>Editing layout</legend><label><input type="radio" name="tabPageView" value="pages"> Page view</label><label><input type="radio" name="tabPageView" value="pageless"> Pageless</label></fieldset><p>Existing page breaks are hidden, not deleted. Print preview still uses saved page settings, breaks, headers and footers; file export support varies.</p>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Apply</button>`);
  $(`input[name="tabPageView"][value="${tab.pageView === 'pageless' ? 'pageless' : 'pages'}"]`).checked = true;
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    if (state.activeTabId !== id || getTab(id) !== tab) { closeModal(); toast('Select the tab again', 'info'); return; }
    const value = $('input[name="tabPageView"]:checked')?.value;
    if (!['pages', 'pageless'].includes(value)) return;
    tab.pageView = value; applyTabView(); save(); closeModal();
    toast(value === 'pageless' ? 'Pageless view for this tab' : 'Page view for this tab', 'check_circle');
  });
}

/* Page setup changes document presentation, not editable HTML. Unknown fields
   on existing saves are left intact; older saves continue using default sizing. */
const PAPER_SIZES = { letter: [816, 1056, 'letter'], a4: [793.7, 1122.5, 'A4'], legal: [816, 1344, 'legal'] };
function pageSetupValues() {
  const setup = state.pageSetup;
  const paper = Object.hasOwn(PAPER_SIZES, setup?.paper) ? setup.paper : 'letter';
  return {paper, orientation:setup?.orientation === 'landscape' ? 'landscape' : 'portrait'};
}
function updatePrintPageSetup() {
  const style = $('#printPageSetup');
  if (!state.pageSetup || typeof state.pageSetup !== 'object') { style.textContent = ''; return; }
  const {paper, orientation} = pageSetupValues();
  const rule = `@page { size: ${PAPER_SIZES[paper][2]} ${orientation}; margin: 72px ${marginValue('right')}px 72px ${marginValue('left')}px; }`;
  if (style.textContent !== rule) style.textContent = rule;
}
function applyPageSetup() {
  const {paper, orientation} = pageSetupValues();
  let [width, height] = PAPER_SIZES[paper];
  if (orientation === 'landscape') [width, height] = [height, width];
  document.documentElement.style.setProperty('--document-width', `${width}px`);
  document.documentElement.style.setProperty('--document-height', `${height}px`);
  updatePrintPageSetup();
}
const PRINT_BOXES = ['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right'];
function printLayoutValues(tab) {
  const value = tab?.printLayout && typeof tab.printLayout === 'object' ? tab.printLayout : {};
  return {header:typeof value.header === 'string' ? value.header.slice(0,150) : '', footer:typeof value.footer === 'string' ? value.footer.slice(0,150) : '', headerPosition:PRINT_BOXES.slice(0,3).includes(value.headerPosition) ? value.headerPosition : 'top-center', footerPosition:PRINT_BOXES.slice(3).includes(value.footerPosition) ? value.footerPosition : 'bottom-center', numberPosition:PRINT_BOXES.includes(value.numberPosition) ? value.numberPosition : 'none'};
}
const printLayoutHistory = new WeakMap();
function printLayoutModal() {
  const tab = getTab(state.activeTabId); if (!tab || mode === 'viewing') { toast('Open an editable tab first', 'info'); return; }
  const id = state.activeTabId, values = printLayoutValues(tab), options = (prefix) => ['left','center','right'].map(p=>`<option value="${prefix}-${p}">${p[0].toUpperCase()+p.slice(1)}</option>`).join('');
  openModal('Headers, footers & page numbers', `<p>These print settings apply to the current tab. Page numbers restart at one in each tab. Use Paginated preview to see the printed result. Settings undo and redo are separate from text undo and last until reload.</p><div class="field"><label for="printHeader">Header text</label><input id="printHeader" maxlength="150" value="${esc(values.header)}"></div><div class="field"><label for="printHeaderPosition">Header placement</label><select id="printHeaderPosition">${options('top')}</select></div><div class="field"><label for="printFooter">Footer text</label><input id="printFooter" maxlength="150" value="${esc(values.footer)}"></div><div class="field"><label for="printFooterPosition">Footer placement</label><select id="printFooterPosition">${options('bottom')}</select></div><div class="field"><label for="printNumberPosition">Page numbers</label><select id="printNumberPosition"><option value="none">None</option>${PRINT_BOXES.map(p=>`<option value="${p}">${p.replace('-', ' ')}</option>`).join('')}</select></div>`, `<button class="btn text" id="printUndo">Undo</button><button class="btn text" id="printRedo">Redo</button><button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Apply</button>`);
  $('#printHeaderPosition').value=values.headerPosition; $('#printFooterPosition').value=values.footerPosition; $('#printNumberPosition').value=values.numberPosition;
  let history = printLayoutHistory.get(tab); if (!history) {history={undo:[],redo:[]};printLayoutHistory.set(tab,history);}
  const snapshot=()=>structuredClone(tab.printLayout ?? null);
  const refresh=()=>{const v=printLayoutValues(tab); $('#printHeader').value=v.header; $('#printFooter').value=v.footer; $('#printHeaderPosition').value=v.headerPosition; $('#printFooterPosition').value=v.footerPosition; $('#printNumberPosition').value=v.numberPosition; $('#printUndo').disabled=!history.undo.length; $('#printRedo').disabled=!history.redo.length;};
  const restore=(from,to)=>{if(!from.length || getTab(id)!==tab || mode==='viewing')return;to.push(snapshot());tab.printLayout=from.pop();save();refresh();};
  $('#printUndo').addEventListener('click',()=>restore(history.undo,history.redo)); $('#printRedo').addEventListener('click',()=>restore(history.redo,history.undo)); refresh();
  $('#mCancel').addEventListener('click',closeModal);
  $('#mOk').addEventListener('click',()=>{
    if (state.activeTabId !== id || getTab(id) !== tab || mode === 'viewing') { closeModal(); toast('Select the tab again', 'info'); return; }
    const header = $('#printHeader').value.replace(/[\r\n\x00-\x1f]/g,' ').trim(), footer = $('#printFooter').value.replace(/[\r\n\x00-\x1f]/g,' ').trim(), headerPosition = $('#printHeaderPosition').value, footerPosition = $('#printFooterPosition').value, numberPosition = $('#printNumberPosition').value;
    if (header.length > 150 || footer.length > 150 || !PRINT_BOXES.slice(0,3).includes(headerPosition) || !PRINT_BOXES.slice(3).includes(footerPosition) || (numberPosition !== 'none' && !PRINT_BOXES.includes(numberPosition))) { toast('Choose valid print settings', 'error'); return; }
    history.undo.push(snapshot()); if(history.undo.length>50)history.undo.shift(); history.redo=[];
    const target = getTab(id); target.printLayout = {...(target.printLayout && typeof target.printLayout === 'object' ? target.printLayout : {}),header,footer,headerPosition,footerPosition,numberPosition};
    save(); closeModal(); toast('Print layout saved for this tab', 'check_circle');
  });
}
function paginationCSS() {
  const tab = getTab(state.activeTabId), layout = printLayoutValues(tab), {paper,orientation} = pageSetupValues();
  const left = marginValue('left'), right = marginValue('right');
  const boxes = Object.fromEntries(PRINT_BOXES.map(p=>[p,[]]));
  // JSON string quoting protects the generated CSS from user text.
  if (layout.header) boxes[layout.headerPosition].push(JSON.stringify(layout.header.replace(/[\x00-\x1f\x7f]/g,' ')));
  if (layout.footer) boxes[layout.footerPosition].push(JSON.stringify(layout.footer.replace(/[\x00-\x1f\x7f]/g,' ')));
  if (layout.numberPosition !== 'none') boxes[layout.numberPosition].push('"Page " counter(page) " of " counter(pages)');
  const rules = PRINT_BOXES.filter(p=>boxes[p].length).map(p=>`@${p}{content:${boxes[p].join(' "  ·  " ')};font:9pt Arial,sans-serif;color:#333}`).join('');
  const docStyles = $('#paragraphStyleRules').textContent.replace(/\.page/g,'.print-document');
  return `@page{size:${PAPER_SIZES[paper][2]} ${orientation};margin:72px ${right}px 72px ${left}px;${rules}}
@font-face{font-family:Roboto;src:url("${new URL('fonts/roboto-latin-400-normal.woff2',location.href).href}")}
.print-document{font:11pt Arial,Helvetica,sans-serif;line-height:1.5;color:#000;overflow-wrap:break-word}
.print-document h1{font-size:26pt;font-weight:700;margin:0 0 12px;line-height:1.25}.print-document h2{font-size:20pt;font-weight:700;margin:18px 0 8px;line-height:1.3}.print-document h3{font-size:15pt;font-weight:700;margin:14px 0 6px}.print-document h4{font-size:13pt;margin:12px 0 6px}.print-document h5{font-size:11pt;margin:10px 0 5px}.print-document h6{font-size:10pt;margin:10px 0 5px}
.print-document p{margin:0 0 10px}.print-document ul,.print-document ol{margin:0 0 10px 28px;padding:0}.print-document li{margin-bottom:3px}.print-document blockquote{border-left:3px solid #4d5d85;margin:10px 0;padding:4px 0 4px 14px}.print-document pre{white-space:pre-wrap}.print-document a{color:#1155cc}.print-document img{max-width:100%;border-radius:6px;margin:8px 0}.print-document table{border-collapse:collapse;margin:10px 0;width:100%}.print-document th,.print-document td{border:1px solid #bdc1c6;padding:6px 10px;font-size:10.5pt;text-align:left}.print-document th{background:#f1f3f4}.print-document .checklist{list-style:none}.print-document .megadoc-page-break{break-before:page;page-break-before:always;border:0;height:0;margin:0}.print-document table.megadoc-toc td{border:0}.print-document .document-equation{display:inline-block}.print-footnote{float:footnote;font:10pt Arial,sans-serif;white-space:pre-wrap}.print-footnote::footnote-call{vertical-align:super;font-size:8pt}.print-footnote::footnote-marker{font-weight:bold}@footnote{border-top:1px solid #777;padding-top:6px}
${docStyles}`;
}
let previewGeneration = 0;
async function showPaginationPreview() {
  if (!getTab(state.activeTabId)) { toast('Create a tab first', 'info'); return; }
  if (!window.DOMPurify) { toast('Preview sanitizer is unavailable', 'error'); return; }
  const setup = pageSetupValues(), dimensions = PAPER_SIZES[setup.paper], width = setup.orientation === 'landscape' ? dimensions[1] : dimensions[0];
  if (marginValue('left') + marginValue('right') > width - 48) { toast('Page margins leave too little room to paginate', 'info'); return; }
  saveCurrentContent(); save();
  const html = DOMPurify.sanitize(page.innerHTML,{USE_PROFILES:{html:true,mathMl:true}}), snapshot = {html,css:paginationCSS()};
  const overlay = $('#paginationPreview'), frame = $('#paginationFrame'), status = $('#paginationStatus'), print = $('#paginationPrint'), pdf = $('#paginationPdf');
  const generation = ++previewGeneration; overlay.classList.remove('hidden'); status.textContent='Preparing pages…'; print.disabled=true; pdf.disabled=true;
  try {
    await new Promise((resolve,reject)=>{ const timer=setTimeout(()=>reject(new Error('Preview could not load')),15000); frame.onload=()=>{clearTimeout(timer);resolve()}; frame.onerror=()=>{clearTimeout(timer);reject(new Error('Preview could not load'))}; frame.src=`print-preview.html?view=${generation}`; });
    if (generation !== previewGeneration) return;
    const count = await Promise.race([frame.contentWindow.renderMegaDocPreview(snapshot), new Promise((_,reject)=>setTimeout(()=>reject(new Error('Pagination timed out')),30000))]);
    if (generation !== previewGeneration) return;
    status.textContent=`${count} page${count === 1 ? '' : 's'} · current tab`; print.disabled=false; pdf.disabled=false;
  } catch (error) { if (generation === previewGeneration) status.textContent=`Could not paginate: ${error.message}. Your document was not changed.`; }
}
$('#paginationClose').addEventListener('click',()=>{ previewGeneration++; $('#paginationPreview').classList.add('hidden'); $('#paginationFrame').removeAttribute('src'); });
$('#paginationPrint').addEventListener('click',()=>{ if (!$('#paginationPrint').disabled) $('#paginationFrame').contentWindow.print(); });
$('#paginationPdf').addEventListener('click',async()=>{
  if ($('#paginationPdf').disabled || !confirm('Download an image-based PDF? Text will not be selectable and some complex formatting, equations or cropped images may differ. For highest fidelity, use Print / Save as PDF instead.')) return;
  const generation=previewGeneration, frame=$('#paginationFrame'), status=$('#paginationStatus'), button=$('#paginationPdf'), print=$('#paginationPrint'), name=getTab(state.activeTabId)?.title || 'MegaDoc tab';
  button.disabled=true; print.disabled=true;
  try { await frame.contentWindow.exportMegaDocPDF(name,(i,total)=>{if(generation === previewGeneration)status.textContent=`Creating PDF: page ${i} of ${total}…`;},()=>generation!==previewGeneration); if (generation===previewGeneration) status.textContent='PDF downloaded · current tab'; }
  catch(error) { if(generation===previewGeneration) status.textContent=`PDF export failed: ${error.message}`; }
  finally { if(generation===previewGeneration) {button.disabled=false;print.disabled=false;} }
});

function showPageSetup() {
  const current = pageSetupValues();
  openModal('Page setup', `<div class="field"><label for="paperSize">Paper size</label><select id="paperSize"><option value="letter">US Letter</option><option value="a4">A4</option><option value="legal">US Legal</option></select></div><div class="field"><label for="pageOrientation">Orientation</label><select id="pageOrientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div><p>Applies to all tabs. The editor displays one continuous page; paper size and orientation control printing. Printer settings may override these choices.</p>`, `<button class="btn text" id="mCancel">Cancel</button><button class="btn primary" id="mOk">Apply</button>`);
  $('#paperSize').value = current.paper; $('#pageOrientation').value = current.orientation;
  $('#mCancel').addEventListener('click', closeModal);
  $('#mOk').addEventListener('click', () => {
    const paper = $('#paperSize').value, orientation = $('#pageOrientation').value;
    if (!Object.hasOwn(PAPER_SIZES, paper) || !['portrait','landscape'].includes(orientation)) return;
    state.pageSetup = {...(state.pageSetup && typeof state.pageSetup === 'object' ? state.pageSetup : {}), paper, orientation};
    closeModal(); applyPageSetup(); setZoom(state.zoom || 100); buildRuler(); save();
  });
}

/* ─────────────────────────── Ruler ─────────────────────────── */
// The ruler uses the rendered page, not the window, as its coordinate system.
// Stored margins remain document-space pixels; narrow screens display a scaled
// version without modifying the saved values.
function marginDisplayScale() { return innerWidth <= 600 ? 28 / 72 : 1; }
function marginValue(side) {
  const raw = state.margins?.[side];
  const n = Number(raw);
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(n) && n >= 0 ? n : 72;
}
function pageGeometry() {
  const rect = page.getBoundingClientRect();
  const style = getComputedStyle(page);
  const scale = rect.width / page.offsetWidth;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return { rect, scale, borderLeft: parseFloat(style.borderLeftWidth) || 0, borderRight: parseFloat(style.borderRightWidth) || 0 };
}
function buildRuler() {
  updatePrintPageSetup();
  if (document.body.classList.contains('pageless-view')) { page.style.paddingLeft = ''; page.style.paddingRight = ''; if (selectedImage) updateImageControls(); return; }
  const factor = marginDisplayScale();
  page.style.paddingLeft = (marginValue('left') * factor) + 'px';
  page.style.paddingRight = (marginValue('right') * factor) + 'px';
  if (selectedImage) updateImageControls();
  const ruler = $('#ruler').getBoundingClientRect();
  const viewport = $('#pageScroll').getBoundingClientRect();
  const geometry = pageGeometry();
  if (!geometry || !ruler.width) return;
  const { rect, scale, borderLeft, borderRight } = geometry;
  const visibleLeft = Math.max(ruler.left, viewport.left);
  const visibleRight = Math.min(ruler.right, viewport.left + $('#pageScroll').clientWidth);
  const pageLeft = rect.left - ruler.left;
  const pageWidth = page.offsetWidth;
  let html = '';
  for (let x = 0; x <= pageWidth; x += 12) {
    const position = pageLeft + x * scale;
    const screenX = ruler.left + position;
    if (screenX < visibleLeft || screenX > visibleRight) continue;
    const major = x % 96 === 0;
    html += `<span class="tick ${major ? 'major' : 'minor'}" style="left:${position}px"></span>`;
    if (major && x > 0) html += `<span class="tick-label" style="left:${position}px">${x / 96}</span>`;
  }
  $('#rulerTicks').innerHTML = html;
  const display = {
    left: rect.left + (borderLeft + marginValue('left') * factor) * scale,
    right: rect.right - (borderRight + marginValue('right') * factor) * scale,
  };
  for (const side of ['left', 'right']) {
    const marker = side === 'left' ? $('#markerLeft') : $('#markerRight');
    const screenX = display[side];
    marker.style.left = (screenX - ruler.left - 6) + 'px';
    marker.classList.toggle('hidden', screenX < visibleLeft || screenX > visibleRight);
    const value = marginValue(side) * factor;
    marker.setAttribute('aria-valuemin', String(Math.round(Math.min(24 * factor, value))));
    marker.setAttribute('aria-valuemax', String(Math.round(Math.max(200 * factor, value))));
    marker.setAttribute('aria-valuenow', String(Math.round(value)));
    marker.setAttribute('aria-valuetext', `${Math.round(value)} pixels from the ${side} page edge`);
  }
}
function setPageMargin(side, value) {
  if (!Number.isFinite(value)) return;
  if (!state.margins || typeof state.margins !== 'object') state.margins = {};
  state.margins[side] = Math.min(200, Math.max(24, value));
  buildRuler();
}
function dragMarker(el, side) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const move = ev => {
      const g = pageGeometry();
      if (!g) return;
      const distance = side === 'left' ? (ev.clientX - g.rect.left) / g.scale - g.borderLeft : (g.rect.right - ev.clientX) / g.scale - g.borderRight;
      setPageMargin(side, distance / marginDisplayScale());
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      save();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  el.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const direction = (e.key === 'ArrowRight' ? 1 : -1) * (side === 'left' ? 1 : -1);
    setPageMargin(side, marginValue(side) + direction * (e.shiftKey ? 10 : 1) / marginDisplayScale());
    save();
  });
}

/* ─────────────────────────── Wiring ─────────────────────────── */
function positionToolbarMenu(dropdown) {
  const menu = dropdown.querySelector('.tb-menu');
  if (!menu) return;
  const anchor = dropdown.getBoundingClientRect();
  const rect = menu.getBoundingClientRect();
  const left = dropdown.querySelector('.tb-menu.right') ? anchor.right - rect.width : anchor.left;
  menu.style.left = `${Math.max(8, Math.min(left, innerWidth - rect.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(anchor.bottom + 4, innerHeight - rect.height - 8))}px`;
}
function wireToolbar() {
  $$('#toolbar [data-cmd]').forEach(btn => btn.addEventListener('click', () => toolbarActions[btn.dataset.cmd]?.()));
  // Keep the editor selection when using toolbar controls.
  $('#toolbar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  // dropdowns
  $$('.tb-dropdown > .tb-select, .tb-dropdown > .tb-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const dd = btn.closest('.tb-dropdown');
      const was = dd.classList.contains('open');
      closeMenus();
      if (!was) { dd.classList.add('open'); positionToolbarMenu(dd); }
    });
  });
  $$('#zoomMenu button').forEach(b => b.addEventListener('click', () => { setZoom(+b.dataset.zoom); closeMenus(); }));
  $$('#styleMenu button').forEach(b => b.addEventListener('click', () => { setStyle(b.dataset.style); closeMenus(); }));
  $$('#fontMenu button').forEach(b => b.addEventListener('click', () => { setFont(b.dataset.font); closeMenus(); }));
  $$('#alignMenu button').forEach(b => b.addEventListener('click', () => { exec(b.dataset.align); closeMenus(); }));
  $$('#spacingMenu button').forEach(b => b.addEventListener('click', () => {
    focusPage();
    const block = selectionBlock();
    if (block) block.style.lineHeight = b.dataset.spacing;
    saveCurrentContent(); save(); closeMenus();
  }));
  $$('#modeMenu button').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); closeMenus(); }));
  $('#fontSizeInput').addEventListener('change', e => {
    applyFontSize(e.target.value);
  });
  $('#menusSearch').addEventListener('click', commandPalette);
  $('#collapseToolbar').addEventListener('click', () => document.body.classList.add('toolbar-hidden'));
  document.addEventListener('click', e => {
    if (document.body.classList.contains('toolbar-hidden') && !e.target.closest('.menubar')) {
      // click anywhere in the top area restores the toolbar
      if (e.clientY < 90) document.body.classList.remove('toolbar-hidden');
    }
  });
}

function wireTopbar() {
  $('#docTitle').addEventListener('input', e => { state.docTitle = e.target.value; save(); document.title = `${state.docTitle} — MegaDoc`; });
  $('#shareBtn').addEventListener('click', showShare);
  $('#shareArrow').addEventListener('click', showShare);
  $('#historyBtn').addEventListener('click', showHistory);
  $('#commentBtn').addEventListener('click', showComments);
  $('#avatarBtn').addEventListener('click', showProfile);
  $('#logoBtn').addEventListener('click', () => {
    if (state.roots.length) selectTab(state.roots[0]);
    else toast('Create your first tab to get started', 'folder_open');
  });
}

function wirePanel() {
  $('#addRootTab').addEventListener('click', () => addTab(null));
  $('#tabSearch').addEventListener('input', e => {
    searchQuery = e.target.value;
    $('#clearSearch').classList.toggle('hidden', !searchQuery);
    renderTree();
  });
  $('#clearSearch').addEventListener('click', () => { searchQuery = ''; $('#tabSearch').value = ''; $('#clearSearch').classList.add('hidden'); renderTree(); });
  $('#expandAll').addEventListener('click', () => { state.expanded = Object.keys(state.tabs); save(); renderTree(); });
  $('#collapseAll').addEventListener('click', () => { state.expanded = []; save(); renderTree(); });
  $('#panelBack').addEventListener('click', () => { if (innerWidth <= 900) { $('#tabsPanel').classList.remove('open'); $('#panelReopen').setAttribute('aria-expanded', 'false'); } else togglePanel(); });
  $('#panelReopen').addEventListener('click', () => togglePanel());
  $('#toolbarRestore').addEventListener('click', () => document.body.classList.remove('toolbar-hidden'));
  $('#statusOutline').addEventListener('click', showOutline);
  $('#findInput').addEventListener('input', runFind);
  $('#findInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') findStep(e.shiftKey ? -1 : 1);
    if (e.key === 'Escape') closeFind();
  });
  $('#findNext').addEventListener('click', () => findStep(1));
  $('#findCase').addEventListener('change', runFind); $('#findRegex').addEventListener('change', runFind);
  $('#replaceOne').addEventListener('click', () => replaceFind(false)); $('#replaceAll').addEventListener('click', () => replaceFind(true));
  $('#findPrev').addEventListener('click', () => findStep(-1));
  $('#findClose').addEventListener('click', closeFind);
  $('#importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then(text => {
      try {
        const imported = JSON.parse(text);
        if (!imported.tabs || !imported.roots) throw new Error('bad file');
        state = normalizeState(imported); paragraphStyleUndo = []; paragraphStyleRedo = []; applyParagraphStyles();
        $('#docTitle').value = state.docTitle;
        updateAvatar(); applyPageTheme();
        save(true); applyPageSetup(); loadTabContent(); renderTree(); setZoom(state.zoom || 100);
        toast('MegaDoc imported', 'upload');
      } catch { toast('Could not import that file', 'error'); }
    });
    e.target.value = '';
  });
}

function wireKeyboard() {
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && document.activeElement === page && getTab(state.activeTabId) && mode !== 'viewing') {
      if (!e.altKey && !e.shiftKey && (e.key === '.' || e.key === ',')) { e.preventDefault(); exec(e.key === '.' ? 'superscript' : 'subscript'); return; }
      if (e.altKey && !e.shiftKey && /^[0-6]$/.test(e.key)) { e.preventDefault(); setStyle(e.key === '0' ? 'p' : 'h' + e.key); return; }
      if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); navigateHeading(e.key === 'ArrowUp' ? -1 : 1); return; }
      if (!e.altKey && e.shiftKey) {
        const alignments = { KeyL: 'justifyLeft', KeyE: 'justifyCenter', KeyR: 'justifyRight', KeyJ: 'justifyFull', Digit7: 'insertOrderedList', Digit8: 'insertUnorderedList' };
        if (alignments[e.code]) { e.preventDefault(); exec(alignments[e.code]); return; }
      }
    }
    if (mod && e.key === '/') { e.preventDefault(); commandPalette(); }
    if (mod && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); addTab(state.activeTabId); }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveCurrentContent(); save(true); toast('Saved', 'cloud_done'); }
    if (mod && (e.key.toLowerCase() === 'f' || (!e.shiftKey && e.key.toLowerCase() === 'h'))) { e.preventDefault(); findInTab(); }
    if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); showPaginationPreview(); return; }
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); linkModal(); }
    if (e.key === 'Escape') { closeModal(); closeFind(); clearImageSelection(); }
  });
}

/* ─────────────────────────── Init ─────────────────────────── */
function init() {
  $('#docTitle').value = state.docTitle || 'MegaDoc';
  document.title = `${state.docTitle || 'MegaDoc'} — MegaDoc`;
  updateAvatar();
  applyPageTheme();
  applyAppearance();
  applyPageSetup();
  applyParagraphStyles();
  buildMenubar();
  buildPalettes();
  wireToolbar();
  wireImageControls();
  wireTopbar();
  wirePanel();
  wireKeyboard();
  buildRuler();
  addEventListener('resize', () => { buildRuler(); closeMenus(); });
  $('#toolbar .toolbar-scroll').addEventListener('scroll', () => { $$('.tb-dropdown.open').forEach(positionToolbarMenu); });
  let lastScrollLeft = $('#pageScroll').scrollLeft;
  $('#pageScroll').addEventListener('scroll', e => {
    $('#editorArea').classList.toggle('scrolled', e.target.scrollTop > 2);
    if (selectedImage) updateImageControls();
    if (e.target.scrollLeft !== lastScrollLeft) { lastScrollLeft = e.target.scrollLeft; buildRuler(); }
  });
  if (typeof ResizeObserver !== 'undefined') {
    const rulerObserver = new ResizeObserver(buildRuler);
    rulerObserver.observe($('#editorArea'));
    rulerObserver.observe($('#ruler'));
    rulerObserver.observe($('#pageWrap'));
    const zoomObserver = new ResizeObserver(() => { $('#pageWrap').style.marginBottom = `${((state.zoom || 100) / 100 - 1) * page.offsetHeight}px`; });
    zoomObserver.observe(page);
  }
  dragMarker($('#markerLeft'), 'left');
  dragMarker($('#markerRight'), 'right');

  initSpelling();
  loadTabContent();
  renderTree();
  setZoom(state.zoom || 100);
  buildRuler();
  // open the panel on small screens via the back arrow area; default open on desktop
  if (innerWidth > 900) $('#tabsPanel').classList.add('open');
}

init();
