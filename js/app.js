/* ═══════════════════════════════════════════════════════════════
   MegaDoc — all your notes in one document.
   Tabs → subtabs → subsubtabs (unlimited depth), each with its
   own rich-text page. Everything persists in localStorage.
   ═══════════════════════════════════════════════════════════════ */

const LS_KEY = 'megadoc-v2';
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
        <span class="material-symbols-outlined tab-icon">${hasKids ? 'folder' : 'description'}</span>
        <span class="tab-title" title="${esc(t.title)}">${esc(t.title)}</span>
        ${kidCount ? `<span class="tab-badge" title="${kidCount} subtab${kidCount > 1 ? 's' : ''}">${kidCount}</span>` : ''}
        <button class="tab-add" data-act="add" title="Add subtab"><span class="material-symbols-outlined">add</span></button>
        <button class="tab-dots" data-act="menu" title="Tab options"><span class="material-symbols-outlined">more_vert</span></button>`;
      row.addEventListener('click', e => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'toggle') { toggleExpand(id); return; }
        if (act === 'add') { e.stopPropagation(); addTab(id); return; }
        if (act === 'menu') { e.stopPropagation(); openTabMenu(id, e.currentTarget); return; }
        selectTab(id);
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

function selectTab(id) {
  if (!getTab(id)) return;
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
  renderTree();
  save();
  if (innerWidth <= 900) { $('#tabsPanel').classList.remove('open'); $('#panelReopen').setAttribute('aria-expanded', 'false'); }
}

function addTab(parentId = null, title = 'Untitled tab') {
  const id = uid();
  state.tabs[id] = { id, title, parentId, children: [], content: '', updatedAt: Date.now(), history: [], comments: [] };
  if (parentId && getTab(parentId)) {
    getTab(parentId).children.push(id);
    if (!state.expanded.includes(parentId)) state.expanded.push(parentId);
  } else state.roots.push(id);
  save(); selectTab(id);
  requestAnimationFrame(() => {
    const row = $(`.tab-row[data-id="${id}"]`);
    if (row) startRename(id, row);
  });
  toast(parentId ? 'Subtab created' : 'Tab created', 'add_circle');
}

function duplicateTab(id) {
  const src = getTab(id);
  if (!src) return;
  // Recursive copy that preserves structure:
  const clone = (sid, parentId) => {
    const s = getTab(sid);
    const nid = uid();
    state.tabs[nid] = { id: nid, title: parentId ? s.title : s.title + ' copy', parentId, children: [], content: s.content, updatedAt: Date.now(), history: [], comments: [] };
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
  menu.style.left = Math.min(rect.right + 4, innerWidth - 240) + 'px';
  menu.style.top = Math.min(rect.bottom, innerHeight - 320) + 'px';
  menu.classList.remove('hidden');
  menu.querySelectorAll('[data-a]').forEach(btn => btn.addEventListener('click', () => {
    closeMenus();
    const a = btn.dataset.a;
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
let mode = 'editing';

function saveCurrentContent() {
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
  const t = getTab(state.activeTabId);
  if (!t) {
    page.contentEditable = 'false';
    page.innerHTML = `<div class="empty-state">
      <h1>Your MegaDoc is empty</h1>
      <p>Create a tab to start writing. You can add subtabs as you go.</p>
      <button class="btn primary" id="emptyNewTab">+ Create your first tab</button>
      <div class="es-tips">Hover a tab to add a <b>subtab</b> · double-click to rename · <span class="kbd">Ctrl</span>+<span class="kbd">/</span> for commands</div>
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
page.addEventListener('input', () => {
  if (pendingFontSize) {
    page.querySelectorAll('font[size="7"]').forEach(font => {
      if (!pendingFontSize.existing.has(font)) { font.removeAttribute('size'); font.style.fontSize = `${pendingFontSize.size}pt`; }
    });
    pendingFontSize = null;
  }
  saveCurrentContent(); updateWordCount(); save();
});
page.addEventListener('paste', e => {
  // paste as plain text to keep the doc clean, unless it contains HTML from this doc
  const html = e.clipboardData.getData('text/html');
  if (!html) return; // plain text paste is fine
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  document.execCommand('insertText', false, text);
});

/* Markdown shortcuts are deliberately local to the current plain-text run.
   This avoids rewriting existing formatting or anything inside code or tables. */
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
  const candidate = parent.closest('p,div,h1,h2,h3,blockquote');
  const block = candidate && page.contains(candidate) ? candidate : page;
  const before = document.createRange();
  before.selectNodeContents(block); before.setEnd(node, sel.anchorOffset);
  const prefix = before.toString();
  const blockMatch = !parent.closest('td,th,li') && (e.key === ' ' || (e.key === 'Enter' && prefix === '```')) && /^(#{1,3}|[-*+]|1\.|>|```|---)$/.exec(prefix);
  if (blockMatch) {
    e.preventDefault();
    sel.removeAllRanges(); sel.addRange(before);
    document.execCommand('delete', false);
    const token = blockMatch[1];
    if (token[0] === '#') document.execCommand('formatBlock', false, 'H' + token.length);
    else if (token === '>') document.execCommand('formatBlock', false, 'BLOCKQUOTE');
    else if (token === '```') document.execCommand('formatBlock', false, 'PRE');
    else if (token === '---') document.execCommand('insertHorizontalRule', false);
    else document.execCommand(token === '1.' ? 'insertOrderedList' : 'insertUnorderedList', false);
    if (sel.rangeCount && page.contains(sel.anchorNode)) editorRange = sel.getRangeAt(0).cloneRange();
    saveCurrentContent(); updateWordCount(); save();
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
page.addEventListener('keydown', handleMarkdownKey);
// Mobile keyboards may not send meaningful keydown events; use beforeinput as a fallback.
let handlingMarkdownInput = false;
page.addEventListener('beforeinput', e => {
  if (handlingMarkdownInput || e.isComposing) return;
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
  if (sel.rangeCount && page.contains(sel.anchorNode) && page.contains(sel.focusNode)) editorRange = sel.getRangeAt(0).cloneRange();
});
function focusPage() {
  page.focus();
  if (editorRange && page.contains(editorRange.commonAncestorContainer)) {
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(editorRange);
  }
}
function exec(cmd, val = null) {
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'edit_off'); return; }
  focusPage();
  document.execCommand(cmd, false, val);
  const sel = getSelection();
  if (sel.rangeCount && page.contains(sel.anchorNode)) editorRange = sel.getRangeAt(0).cloneRange();
  saveCurrentContent(); updateWordCount(); save();
}
function selectionBlock() {
  const sel = getSelection();
  if (!sel.rangeCount) return null;
  let n = sel.anchorNode;
  while (n && !['H1','H2','H3','P','BLOCKQUOTE','PRE','LI'].includes(n.nodeName)) n = n.parentNode;
  return n;
}

const toolbarActions = {
  undo: () => exec('undo'),
  redo: () => exec('redo'),
  print: () => { saveCurrentContent(); window.print(); },
  spellcheck: () => {
    const on = page.spellcheck;
    page.spellcheck = !on;
    toast(on ? 'Spellcheck off' : 'Spellcheck on', 'spellcheck');
  },
  paint: paintFormat,
  bold: () => exec('bold'),
  italic: () => exec('italic'),
  underline: () => exec('underline'),
  strike: () => exec('strikeThrough'),
  link: linkModal,
  image: imageModal,
  checklist: () => exec('insertHTML', '<ul class="checklist"><li><input type="checkbox" contenteditable="false"> Task</li></ul><p><br></p>'),

  bullets: () => exec('insertUnorderedList'),
  numbering: () => exec('insertOrderedList'),
  indent: () => exec('indent'),
  outdent: () => exec('outdent'),
  clear: () => { exec('removeFormat'); exec('unlink'); toast('Formatting cleared', 'format_clear'); },
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
  wrap.style.marginBottom = `${(scale - 1) * 1056}px`;
  $$('#zoomMenu button').forEach(b => b.classList.toggle('active', +b.dataset.zoom === z));
  save();
}

function setStyle(style) {
  const map = { p: 'P', h1: 'H1', h2: 'H2', h3: 'H3', blockquote: 'BLOCKQUOTE', code: 'PRE' };
  exec('formatBlock', map[style] || 'P');
  const labels = { p: 'Normal text', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', blockquote: 'Quote', code: 'Code' };
  $('#styleLabel').textContent = labels[style] || 'Normal text';
  $$('#styleMenu button').forEach(b => b.classList.toggle('active', b.dataset.style === style));
}

function setFont(name) {
  exec('fontName', name);
  $('#fontLabel').textContent = name;
  $$('#fontMenu button').forEach(b => b.classList.toggle('active', b.dataset.font === name));
}

const TEXT_COLORS = ['#000000', '#444746', '#4f46e5', '#188038', '#b3261e', '#f9ab00', '#9334e6', '#e8710a', '#0b8043', '#d93025', '#1a73e8', '#5f6368', '#ffffff', '#fbbc04', '#a8dab5', '#f28b82'];
const HIGHLIGHTS = ['#fff59d', '#c2e7ff', '#c4eed0', '#f9dedc', '#e9defc', '#feefc3', '#ffffff', '#000000'];

function buildPalettes() {
  $('#colorMenu').innerHTML = '<div class="color-grid">' + TEXT_COLORS.map(c => `<button class="swatch" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('') + '</div>';
  $('#highlightMenu').innerHTML = '<div class="color-grid">' + HIGHLIGHTS.map(c => `<button class="swatch" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('') + '</div>';
  $$('#colorMenu .swatch').forEach(s => s.addEventListener('click', () => {
    $('#colorBar').style.background = s.dataset.color;
    exec('foreColor', s.dataset.color); closeMenus();
  }));
  $$('#highlightMenu .swatch').forEach(s => s.addEventListener('click', () => {
    $('#highlightBar').style.background = s.dataset.color;
    exec('hiliteColor', s.dataset.color); closeMenus();
  }));
}

function setMode(m) {
  mode = m;
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
  if (!getTab(state.activeTabId) || mode === 'viewing') { toast('Open an editable tab first', 'error'); return; }
  try { const text = await navigator.clipboard.readText(); exec('insertText', text); }
  catch { toast('Clipboard access unavailable. Use Ctrl+V or your browser paste shortcut.', 'content_paste'); }
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
    { icon: 'restore', label: 'Restore previous local document…', fn: restoreLegacy },
    { sep: true },
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
    { icon: 'zoom_in', label: 'Zoom in', shortcut: 'Ctrl++', fn: () => setZoom(Math.min(200, state.zoom + 25)) },
    { icon: 'zoom_out', label: 'Zoom out', shortcut: 'Ctrl+-', fn: () => setZoom(Math.max(50, state.zoom - 25)) },
    { icon: 'fullscreen', label: 'Toggle full screen', fn: async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('Full screen is unavailable in this browser', 'info'); } catch { toast('Full screen is unavailable here', 'info'); } } },
    { icon: 'keyboard_arrow_up', label: 'Hide toolbar', fn: () => document.body.classList.add('toolbar-hidden') },
  ]},
  { label: 'Insert', items: [
    { icon: 'image', label: 'Image (URL)…', fn: () => toolbarActions.image() },
    { icon: 'link', label: 'Link', shortcut: 'Ctrl+K', fn: () => toolbarActions.link() },
    { icon: 'horizontal_rule', label: 'Horizontal line', fn: () => exec('insertHorizontalRule') },
    { icon: 'table', label: 'Table', fn: insertTable },
    { icon: 'emoji', label: 'Emoji…', fn: emojiPicker },
    { icon: 'code', label: 'Code block', fn: () => setStyle('code') },
    { icon: 'note', label: 'Callout box', fn: () => exec('insertHTML', '<div class="callout">Callout text — edit me.</div><p><br></p>') },
  ]},
  { label: 'Format', items: [
    { icon: 'format_bold', label: 'Bold', shortcut: 'Ctrl+B', fn: () => exec('bold') },
    { icon: 'format_italic', label: 'Italic', shortcut: 'Ctrl+I', fn: () => exec('italic') },
    { icon: 'format_underlined', label: 'Underline', shortcut: 'Ctrl+U', fn: () => exec('underline') },
    { icon: 'format_strikethrough', label: 'Strikethrough', fn: () => exec('strikeThrough') },
    { sep: true },
    { icon: 'format_clear', label: 'Clear formatting', fn: () => toolbarActions.clear() },
    { icon: 'format_align_left', label: 'Align left', fn: () => exec('justifyLeft') },
    { icon: 'format_align_center', label: 'Align center', fn: () => exec('justifyCenter') },
    { icon: 'format_align_right', label: 'Align right', fn: () => exec('justifyRight') },
    { icon: 'format_align_justify', label: 'Justify', fn: () => exec('justifyFull') },
    { sep: true },
    { icon: 'format_list_bulleted', label: 'Bulleted list', fn: () => exec('insertUnorderedList') },
    { icon: 'format_list_numbered', label: 'Numbered list', fn: () => exec('insertOrderedList') },
  ]},
  { label: 'Tools', items: [
    { icon: 'fact_check', label: 'Word count', fn: showDetails },
    { icon: 'spellcheck', label: 'Toggle spellcheck', fn: () => toolbarActions.spellcheck() },
    { icon: 'list', label: 'Outline (all tabs)', fn: showOutline },
    { icon: 'search', label: 'Search menus', shortcut: 'Ctrl+/', fn: commandPalette },
  ]},
  { label: 'Extensions', items: [
    { icon: 'center_focus_strong', label: 'Focus mode', fn: () => { document.body.classList.toggle('focus-mode'); toast(document.body.classList.contains('focus-mode') ? 'Focus mode on' : 'Focus mode off', 'center_focus_strong'); } },
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

function openMenu(i, anchor) {
  const menu = MENUS[i];
  const dd = $('#menuDropdown');
  dd.innerHTML = menu.items.map(it => it.sep
    ? '<div class="mi-sep"></div>'
    : `<button class="mi ${it.danger ? 'danger' : ''}" data-i="${menu.items.indexOf(it)}"><span class="material-symbols-outlined">${it.icon}</span>${it.label}${it.shortcut ? `<span class="shortcut">${it.shortcut}</span>` : ''}</button>`
  ).join('');
  const rect = anchor.getBoundingClientRect();
  dd.style.left = rect.left + 'px';
  dd.style.top = (rect.bottom + 2) + 'px';
  dd.classList.remove('hidden');
  anchor.classList.add('open');
  dd.querySelectorAll('.mi').forEach(b => b.addEventListener('click', () => { closeMenus(); menu.items[+b.dataset.i].fn(); }));
}

/* Editor context menu: native browser menus remain available outside the page. */
function showEditorContext(e) {
  if (!getTab(state.activeTabId) || mode === 'viewing' || e.target.closest('input,textarea,select,button')) return;
  e.preventDefault();
  const selection = getSelection();
  if (selection.rangeCount && page.contains(selection.anchorNode) && page.contains(selection.focusNode)) editorRange = selection.getRangeAt(0).cloneRange();
  const cell = e.target.closest('td,th');
  const table = cell?.closest('table');
  closeMenus();
  const menu = $('#contextMenu');
  menu.innerHTML = (table && page.contains(table) ? `
    <div class="mi-label">Table</div>
    <button class="mi" data-editor-action="row-before"><span class="material-symbols-outlined">add</span> Insert row above</button>
    <button class="mi" data-editor-action="row-after"><span class="material-symbols-outlined">add</span> Insert row below</button>
    <button class="mi" data-editor-action="col-before"><span class="material-symbols-outlined">add</span> Insert column left</button>
    <button class="mi" data-editor-action="col-after"><span class="material-symbols-outlined">add</span> Insert column right</button>
    <button class="mi" data-editor-action="row-delete"><span class="material-symbols-outlined">remove</span> Delete row</button>
    <button class="mi" data-editor-action="col-delete"><span class="material-symbols-outlined">remove</span> Delete column</button>
    <button class="mi danger" data-editor-action="table-delete"><span class="material-symbols-outlined">delete</span> Delete table</button>
    <div class="mi-sep"></div>` : '') + `
    <div class="mi-label">Edit</div>
    <button class="mi" data-editor-action="undo"><span class="material-symbols-outlined">undo</span> Undo</button>
    <button class="mi" data-editor-action="cut"><span class="material-symbols-outlined">content_cut</span> Cut</button>
    <button class="mi" data-editor-action="copy"><span class="material-symbols-outlined">content_copy</span> Copy</button>
    <button class="mi" data-editor-action="paste"><span class="material-symbols-outlined">content_paste</span> Paste</button>
    <button class="mi" data-editor-action="select-all"><span class="material-symbols-outlined">select_all</span> Select all</button>`;
  menu.classList.remove('hidden');
  const rect = menu.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(e.clientX, innerWidth - rect.width - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(e.clientY, innerHeight - rect.height - 8)) + 'px';
  menu.querySelectorAll('[data-editor-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.editorAction;
    closeMenus();
    if (['row-before','row-after','col-before','col-after','row-delete','col-delete','table-delete'].includes(action)) editTable(table, cell, action);
    else if (action === 'undo') exec('undo');
    else if (action === 'cut' || action === 'copy') clipboardCommand(action);
    else if (action === 'paste') pasteAction();
    else if (action === 'select-all') exec('selectAll');
  }));
}
page.addEventListener('contextmenu', showEditorContext);

function editTable(table, cell, action) {
  if (!table || !cell || !page.contains(table) || mode === 'viewing') return;
  const rows = [...table.rows];
  const rowIndex = rows.indexOf(cell.parentElement), colIndex = cell.cellIndex;
  if (rowIndex < 0 || colIndex < 0) return;
  const columns = rows[0]?.cells.length || 0;
  if (action !== 'table-delete' && rows.some(row => row.cells.length !== columns || [...row.cells].some(c => c.rowSpan !== 1 || c.colSpan !== 1))) {
    toast('Row and column editing is not supported for merged or uneven cells', 'info'); return;
  }
  if (action === 'row-delete' && rows.length === 1) { toast('Use Delete table to remove the last row', 'info'); return; }
  if (action === 'col-delete' && columns === 1) { toast('Use Delete table to remove the last column', 'info'); return; }
  const clone = table.cloneNode(true);
  const cloneRows = [...clone.rows];
  const cloneRow = cloneRows[rowIndex];
  const emptyCell = tag => { const el = document.createElement(tag); el.appendChild(document.createElement('br')); return el; };
  if (action === 'row-before' || action === 'row-after') {
    const row = document.createElement('tr');
    for (const existing of cloneRow.cells) {
      const afterHeader = action === 'row-after' && cloneRow.parentElement.tagName !== 'THEAD' && [...cloneRow.cells].every(c => c.tagName === 'TH') && (!cloneRow.nextElementSibling || cloneRow.nextElementSibling.cells[0]?.tagName === 'TD');
      row.appendChild(emptyCell(afterHeader ? 'td' : existing.tagName.toLowerCase()));
    }
    cloneRow.parentElement.insertBefore(row, action === 'row-before' ? cloneRow : cloneRow.nextSibling);
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
      html += '<tr>' + `<${tag}><br></${tag}>`.repeat(cols) + '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    closeModal(); exec('insertHTML', html); toast('Table inserted', 'table');
  });
}
let findIndex = -1;
function findInTab() {
  if (!getTab(state.activeTabId)) { toast('Create a tab first', 'search_off'); return; }
  $('#findbar').classList.add('open'); $('#findInput').focus(); $('#findInput').select(); runFind();
}
function findRanges(q) {
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const nodes = []; let text = '', node;
  while ((node = walker.nextNode())) { nodes.push({node, start: text.length}); text += node.data; }
  const ranges = []; const needle = q.toLowerCase(); const haystack = text.toLowerCase();
  if (!needle) return ranges;
  let pos = 0, hit;
  while ((hit = haystack.indexOf(needle, pos)) !== -1) {
    const start = nodes.find(n => hit >= n.start && hit < n.start + n.node.length);
    const end = nodes.find(n => hit + needle.length > n.start && hit + needle.length <= n.start + n.node.length);
    if (start && end) { const r = document.createRange(); r.setStart(start.node, hit - start.start); r.setEnd(end.node, hit + needle.length - end.start); ranges.push(r); }
    pos = hit + needle.length;
  }
  return ranges;
}
function showFindResult(ranges) {
  $('#findCount').textContent = ranges.length ? `${findIndex + 1} / ${ranges.length}` : ($('#findInput').value ? 'No matches' : '');
  if (ranges.length) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(ranges[findIndex]); ranges[findIndex].startContainer.parentElement?.scrollIntoView({block:'nearest'}); }
}
function runFind() { const ranges = findRanges($('#findInput').value); findIndex = ranges.length ? 0 : -1; showFindResult(ranges); }
function findStep(dir) { const ranges = findRanges($('#findInput').value); if (!ranges.length) return; findIndex = (findIndex + dir + ranges.length) % ranges.length; showFindResult(ranges); }
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
function restoreLegacy() {
  let old;
  try { old = JSON.parse(localStorage.getItem('megadoc-v1')); } catch {}
  if (!old || !old.tabs || !Array.isArray(old.roots)) { toast('No previous local document found', 'info'); return; }
  confirmModal('Restore previous document?', '<p>This replaces your current document with the previous locally saved version, which may include the old example tabs. Export your current document first if needed.</p>', 'Restore', () => {
    state = normalizeState(old); $('#docTitle').value = state.docTitle || 'MegaDoc';
    updateAvatar(); applyPageTheme(); loadTabContent(); renderTree(); setZoom(state.zoom || 100); save(true);
    toast('Previous document restored', 'restore');
  });
}
function resetAll() {
  confirmModal('Reset MegaDoc?', '<p>This deletes <b>all tabs and content</b> stored in this browser and starts a new empty document. Export a backup first if you need it.</p>', 'Reset everything', () => {
    localStorage.removeItem(LS_KEY);
    state = seedState();
    $('#docTitle').value = state.docTitle; document.title = 'MegaDoc — MegaDoc';
    updateAvatar(); applyPageTheme();
    save(true); loadTabContent(); renderTree(); setZoom(state.zoom || 100);
    toast('MegaDoc reset', 'restart_alt');
  });
}

/* ─────────────────────────── Modals ─────────────────────────── */
function openModal(title, bodyHTML, footHTML = '') {
  $('#modal').innerHTML = `
    <div class="modal-head"><span class="modal-title">${esc(title)}</span>
      <button class="icon-btn sm" id="modalClose" aria-label="Close"><span class="material-symbols-outlined">close</span></button></div>
    <div class="modal-body">${bodyHTML}</div>
    ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ''}`;
  $('#modalBackdrop').classList.remove('hidden');
  $('#modalClose').addEventListener('click', closeModal);
}
function closeModal() { $('#modalBackdrop').classList.add('hidden'); }
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
  openModal('Outline — all tabs', `<div>${rows.join('') || '<p>No tabs yet.</p>'}</div>`, `<button class="btn text" id="mDone">Done</button>`);
  $('#modal').querySelectorAll('.outline-item').forEach(b => b.addEventListener('click', () => { closeModal(); selectTab(b.dataset.id); }));
  $('#mDone').addEventListener('click', closeModal);
}

function showShortcuts() {
  openModal('Keyboard shortcuts', `
    <table>
      <tr><td><kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd></td><td>Bold / Italic / Underline</td></tr>
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
function emojiPicker() {
  openModal('Insert emoji', `<div class="emoji-grid">${EMOJIS.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>`);
  $('#modal').querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => { exec('insertText', b.dataset.e); closeModal(); }));
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
    list.innerHTML = filtered.map((c, i) => `<button class="cmd-item ${i === 0 ? 'sel' : ''}" data-i="${cmds.indexOf(c)}"><span class="material-symbols-outlined">${c.icon}</span>${esc(c.label)}${c.shortcut ? `<span class="shortcut">${c.shortcut}</span>` : ''}</button>`).join('') || '<p style="padding:12px;color:var(--ink-3)">No commands found.</p>';
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

/* ─────────────────────────── Ruler ─────────────────────────── */
function buildRuler() {
  const ticks = $('#rulerTicks');
  const w = $('#ruler').clientWidth;
  const pxPerInch = 96;
  let html = '';
  for (let x = 0; x <= w; x += pxPerInch / 8) {
    const inch = x / pxPerInch;
    const major = Math.abs(inch - Math.round(inch)) < 0.01;
    html += `<span class="tick ${major ? 'major' : 'minor'}" style="left:${x}px"></span>`;
    if (major && Math.round(inch) >= 1) html += `<span class="tick-label" style="left:${x}px">${Math.round(inch)}</span>`;
  }
  ticks.innerHTML = html;
  positionMarkers();
}
function positionMarkers() {
  const w = $('#ruler').clientWidth;
  const pageW = Math.min(816, w - 48);
  const pageLeft = (w - pageW) / 2;
  const m = state.margins;
  $('#markerLeft').style.left = (pageLeft + m.left - 6) + 'px';
  $('#markerRight').style.left = (pageLeft + pageW - m.right - 6) + 'px';
  $('#markerFirstLine').style.left = (pageLeft + m.left + 18 - 6) + 'px';
  page.style.paddingLeft = (innerWidth <= 600 ? Math.min(m.left, 28) : m.left) + 'px';
  page.style.paddingRight = (innerWidth <= 600 ? Math.min(m.right, 28) : m.right) + 'px';
}
function dragMarker(el, onMove) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const move = ev => onMove(ev.clientX);
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); save(); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
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
  $('#findPrev').addEventListener('click', () => findStep(-1));
  $('#findClose').addEventListener('click', closeFind);
  $('#importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then(text => {
      try {
        const imported = JSON.parse(text);
        if (!imported.tabs || !imported.roots) throw new Error('bad file');
        state = normalizeState(imported);
        $('#docTitle').value = state.docTitle;
        updateAvatar(); applyPageTheme();
        save(true); loadTabContent(); renderTree(); setZoom(state.zoom || 100);
        toast('MegaDoc imported', 'upload');
      } catch { toast('Could not import that file', 'error'); }
    });
    e.target.value = '';
  });
}

function wireKeyboard() {
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === '/') { e.preventDefault(); commandPalette(); }
    if (mod && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); addTab(state.activeTabId); }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveCurrentContent(); save(true); toast('Saved', 'cloud_done'); }
    if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); findInTab(); }
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); linkModal(); }
    if (e.key === 'Escape') { closeModal(); closeFind(); }
  });
}

/* ─────────────────────────── Init ─────────────────────────── */
function init() {
  $('#docTitle').value = state.docTitle || 'MegaDoc';
  document.title = `${state.docTitle || 'MegaDoc'} — MegaDoc`;
  updateAvatar();
  applyPageTheme();
  applyAppearance();
  buildMenubar();
  buildPalettes();
  wireToolbar();
  wireTopbar();
  wirePanel();
  wireKeyboard();
  buildRuler();
  addEventListener('resize', () => { buildRuler(); closeMenus(); });
  $('#toolbar .toolbar-scroll').addEventListener('scroll', () => { $$('.tb-dropdown.open').forEach(positionToolbarMenu); });
  $('#pageScroll').addEventListener('scroll', e => $('#editorArea').classList.toggle('scrolled', e.target.scrollTop > 2));

  dragMarker($('#markerLeft'), x => {
    const r = $('#ruler').getBoundingClientRect();
    const pageLeft = (r.width - Math.min(816, r.width - 48)) / 2;
    state.margins.left = Math.min(200, Math.max(24, x - r.left - pageLeft));
    positionMarkers();
  });
  dragMarker($('#markerRight'), x => {
    const r = $('#ruler').getBoundingClientRect();
    const pageW = Math.min(816, r.width - 48);
    const pageLeft = (r.width - pageW) / 2;
    state.margins.right = Math.min(200, Math.max(24, pageLeft + pageW - (x - r.left)));
    positionMarkers();
  });
  dragMarker($('#markerFirstLine'), x => {
    const r = $('#ruler').getBoundingClientRect();
    const pageLeft = (r.width - Math.min(816, r.width - 48)) / 2;
    const indent = Math.min(96, Math.max(0, x - r.left - pageLeft - state.margins.left));
    const block = selectionBlock();
    if (block) block.style.textIndent = indent + 'px';
    saveCurrentContent(); save();
  });

  loadTabContent();
  renderTree();
  setZoom(state.zoom || 100);
  positionMarkers();
  // open the panel on small screens via the back arrow area; default open on desktop
  if (innerWidth > 900) $('#tabsPanel').classList.add('open');
}

init();
