/* ═══════════════════════════════════════════════════════════════
   MegaDoc — all your notes in one document.
   Tabs → subtabs → subsubtabs (unlimited depth), each with its
   own rich-text page. Everything persists in localStorage.
   ═══════════════════════════════════════════════════════════════ */

const LS_KEY = 'megadoc-v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ─────────────────────────── Seed data ─────────────────────────── */
function seedState() {
  const tabs = {};
  const mk = (title, parentId, content) => {
    const id = uid();
    tabs[id] = { id, title, parentId, children: [], content, updatedAt: Date.now() };
    return id;
  };
  const roots = [];

  const home = mk('home', null,
    `<h1>Welcome to MegaDoc</h1>
     <p><b>MegaDoc</b> is a software for putting all your notes in one document when you are too lazy to manage 15 billion of them.</p>
     <p>Instead of 15 billion files, you get <b>one document</b> with <b>tabs, subtabs and subsubtabs</b> — as deep as you want. Every tab is its own page, but everything lives together, searchable and saved in your browser.</p>
     <div class="callout"><b>How it works:</b> use the <b>+</b> on the left to add a tab, hover any tab to add a <b>subtab</b>, and keep nesting. Click a tab to open its page. Drag tabs to reorder. Right-click (or ⋮) to rename, duplicate or delete.</div>
     <h2>Quick start</h2>
     <ul>
       <li>Click <b>+</b> next to <i>Document tabs</i> to create a new top-level tab.</li>
       <li>Hover a tab and press <b>+</b> to create a subtab inside it.</li>
       <li>Double-click a tab title to rename it inline.</li>
       <li>Use <span class="kbd">Ctrl</span>+<span class="kbd">B</span> / <span class="kbd">I</span> / <span class="kbd">U</span> for bold, italic, underline.</li>
       <li>Press <span class="kbd">Ctrl</span>+<span class="kbd">/</span> to search all menus and commands.</li>
     </ul>
     <h2>Why one doc?</h2>
     <p>Tabs keep things tidy. Subtabs keep related stuff together. Subsubtabs let you go as deep as your brain does — <i>without</i> ever leaving this one document. No folders, no 15 billion files, no "where did I put that note?"</p>
     <p><span class="tag">megadoc</span><span class="tag">one doc</span><span class="tag">tabs</span><span class="tag">subtabs</span></p>`);
  roots.push(home);

  const welcome = mk('welcome', home,
    `<h1>Welcome 👋</h1>
     <p>This is a <b>subtab</b> of <i>home</i>. It lives inside home, but opens as its own full page.</p>
     <p>Try adding a subtab here — that becomes a <b>subsubtab</b>. And a subtab inside <i>that</i> becomes a sub-sub-subtab. There is no depth limit.</p>
     <blockquote>One document. Infinite nesting. Zero file management.</blockquote>`);
  tabs[home].children.push(welcome);

  const getting = mk('getting started', welcome,
    `<h1>Getting started</h1>
     <h2>1. Create tabs</h2>
     <p>Top-level tabs are your big buckets. Everything else nests underneath.</p>
     <h2>2. Write</h2>
     <p>Each tab has a full rich-text page: headings, lists, tables, images, links, code blocks. Use the toolbar above or the <i>Menus</i> search.</p>
     <h2>3. Organise</h2>
     <p>Drag tabs to reorder. Use the ⋮ menu to move, duplicate or delete. Search tabs with the search box in the sidebar.</p>
     <h2>4. Everything saves automatically</h2>
     <p>Your document is stored locally in this browser. Use <b>File → Export JSON</b> to back it up or move it to another device.</p>`);
  tabs[welcome].children.push(getting);

  const changelog = mk('changelog', home,
    `<h1>Changelog</h1>
     <h2>v1.0 — MegaDoc launches</h2>
     <ul>
       <li>Google Docs–style editor with ruler, toolbar and menus.</li>
       <li>Unlimited tab nesting (tabs → subtabs → subsubtabs).</li>
       <li>Drag-and-drop tab reordering.</li>
       <li>Auto-save to localStorage, JSON export/import.</li>
       <li>Command palette via <span class="kbd">Ctrl</span>+<span class="kbd">/</span>.</li>
     </ul>`);
  tabs[home].children.push(changelog);

  const freeApi = mk('free ai api…', null,
    `<h1>Free AI APIs</h1>
     <p>Notes on free-tier AI APIs — endpoints, limits and keys. <i>(Placeholder content — paste your own notes here.)</i></p>
     <h2>Providers</h2>
     <ul>
       <li><b>Pollinations</b> — free image + text generation. See the <i>pollinations</i> subtab.</li>
       <li><b>Groq</b> — fast inference. See the <i>groq</i> subtab.</li>
       <li><b>NVIDIA</b> — NIM endpoints. See the <i>nvidia</i> tab.</li>
     </ul>
     <p>Tip: keep keys in the <i>keys vault</i> subtab, not in public docs.</p>`);
  roots.push(freeApi);

  const providers = mk('providers', freeApi,
    `<h1>Providers</h1>
     <table>
       <tr><th>Provider</th><th>What</th><th>Free tier</th></tr>
       <tr><td>Pollinations</td><td>Images + text</td><td>Generous, no key needed for basic use</td></tr>
       <tr><td>Groq</td><td>Fast LLM inference</td><td>Free tier with API key</td></tr>
       <tr><td>NVIDIA NIM</td><td>Hosted models</td><td>Free credits on signup</td></tr>
     </table>`);
  tabs[freeApi].children.push(providers);

  const poll = mk('pollinations', providers,
    `<h1>Pollinations</h1>
     <p>Free image generation via URL. Example pattern:</p>
     <pre>https://gen.pollinations.ai/image/{prompt}?key=YOUR_KEY</pre>
     <p>Replace <code class="inline">YOUR_KEY</code> with your own key. Keep keys private.</p>`);
  tabs[providers].children.push(poll);

  const groq = mk('groq', providers,
    `<h1>Groq</h1>
     <p>Groq API keys start with <code class="inline">gsk_</code>. Base URL: <code class="inline">https://api.groq.com/openai/v1</code></p>
     <p>Store your key in the vault subtab and never commit it to git.</p>`);
  tabs[providers].children.push(groq);

  const vault = mk('keys vault', freeApi,
    `<h1>Keys vault 🔐</h1>
     <p><b>Private.</b> Keep API keys here, not in shared documents.</p>
     <pre>PROVIDER=your-key-here
PROVIDER_2=your-key-here</pre>
     <p>Remember: anything in this browser stays on this device unless you export it.</p>`);
  tabs[freeApi].children.push(vault);

  const randomKeys = mk('random api keys', null,
    `<h1>Random API keys</h1>
     <p>Scratch space for random keys and tokens. <i>Placeholder — replace with your own.</i></p>
     <pre>service-a: paste-key-here
service-b: paste-key-here</pre>`);
  roots.push(randomKeys);

  const nvidiaSub = mk('nvidia', randomKeys,
    `<h1>NVIDIA</h1>
     <p>NVIDIA API keys start with <code class="inline">nvapi-</code>. Get them from <a href="https://build.nvidia.com" target="_blank" rel="noopener">build.nvidia.com</a>.</p>`);
  tabs[randomKeys].children.push(nvidiaSub);

  const groqSub = mk('groq', randomKeys,
    `<h1>Groq</h1>
     <p>Groq keys start with <code class="inline">gsk_</code>. Get them from <a href="https://console.groq.com" target="_blank" rel="noopener">console.groq.com</a>.</p>`);
  tabs[randomKeys].children.push(groqSub);

  const legacy = mk('normos ddos hack legacy', null,
    `<h1>Normos DDoS hack legacy</h1>
     <p>Legacy notes. Archived here so they don't clutter the main tabs.</p>
     <p><i>Nothing to see here — yet.</i></p>`);
  roots.push(legacy);

  const legacyNotes = mk('notes', legacy,
    `<h1>Legacy notes</h1>
     <p>Old ideas, dead links and forgotten experiments. Everything still searchable from one place.</p>`);
  tabs[legacy].children.push(legacyNotes);

  const chibbit = mk('chibbit ai models', null,
    `<h1>Chibbit AI models</h1>
     <p>Model notes for the Chibbit project.</p>
     <ul>
       <li><b>Model A</b> — fast, cheap, good for drafts.</li>
       <li><b>Model B</b> — smarter, slower, good for final output.</li>
     </ul>
     <p>Add a subtab per model as you experiment.</p>`);
  roots.push(chibbit);

  const modelsList = mk('models list', chibbit,
    `<h1>Models list</h1>
     <table>
       <tr><th>Model</th><th>Use</th><th>Notes</th></tr>
       <tr><td>model-a</td><td>Drafts</td><td>Fast</td></tr>
       <tr><td>model-b</td><td>Final</td><td>Smart</td></tr>
     </table>`);
  tabs[chibbit].children.push(modelsList);

  const aiKeys = mk('ai api keys', null,
    `<h1>AI API keys</h1>
     <p>Central list of AI provider keys. <i>Placeholder — add your own.</i></p>
     <pre>openai: sk-...
anthropic: sk-ant-...
groq: gsk_...
nvidia: nvapi-...</pre>`);
  roots.push(aiKeys);

  const searchHtml = mk('search html', null,
    `<h1>Search HTML</h1>
     <p>Notes on HTML search / scraping patterns.</p>
     <pre>&lt;!-- example --&gt;
&lt;div class="result"&gt;…&lt;/div&gt;</pre>`);
  roots.push(searchHtml);

  const sidebar = mk('sidebar', null,
    `<h1>Sidebar</h1>
     <p>Ideas for the sidebar UI. The MegaDoc tabs panel on the left is the living example.</p>`);
  roots.push(sidebar);

  const providers2 = mk('free ai api providers', null,
    `<h1>Free AI API providers</h1>
     <p>See <i>free ai api… → providers</i> for the full breakdown.</p>`);
  roots.push(providers2);

  const nvidia = mk('nvidia', null,
    `<h1>NVIDIA</h1>
     <p>NVIDIA NIM notes. Keys start with <code class="inline">nvapi-</code>.</p>`);
  roots.push(nvidia);

  const scraper = mk('google ai mode scraper', null,
    `<h1>Google AI Mode scraper</h1>
     <p>Notes on scraping Google AI Mode results.</p>
     <ul>
       <li>Use a headless browser for reliable rendering.</li>
       <li>Respect rate limits.</li>
       <li>Store results as JSON in a subtab.</li>
     </ul>`);
  roots.push(scraper);

  return {
    docTitle: 'MegaDoc',
    starred: false,
    activeTabId: home,
    roots,
    tabs,
    expanded: [home, freeApi, providers, randomKeys, legacy, chibbit],
    margins: { left: 72, right: 72 },
    zoom: 100,
  };
}

/* ─────────────────────────── Store ─────────────────────────── */
let state;
try {
  const raw = localStorage.getItem(LS_KEY);
  state = raw ? JSON.parse(raw) : seedState();
  if (!state.tabs || !state.tabs[state.activeTabId]) state = seedState();
} catch { state = seedState(); }

let saveTimer;
function save(immediate = false) {
  const status = $('#saveStatus');
  status.classList.add('saving');
  status.innerHTML = '<span class="material-symbols-outlined">cloud_upload</span> Saving…';
  const write = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
    status.classList.remove('saving');
    status.innerHTML = '<span class="material-symbols-outlined">cloud_done</span> Saved';
    $('#cloudStatus').innerHTML = '<span class="material-symbols-outlined">cloud_done</span>';
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
    tree.innerHTML = '<div class="empty-tree"><span class="material-symbols-outlined">search_off</span>No tabs match your search.</div>';
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
  loadTabContent();
  renderTree();
  save();
  $('#tabsPanel').classList.remove('open');
}

function addTab(parentId = null, title = 'Untitled tab') {
  const id = uid();
  state.tabs[id] = { id, title, parentId, children: [], content: `<h1>${esc(title)}</h1><p>Start writing…</p>`, updatedAt: Date.now() };
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
    state.tabs[nid] = { id: nid, title: parentId ? s.title : s.title + ' copy', parentId, children: [], content: s.content, updatedAt: Date.now() };
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
        if (!state.activeTabId) {
          const nid = uid();
          state.tabs[nid] = { id: nid, title: 'home', parentId: null, children: [], content: '<h1>home</h1><p>Start writing…</p>', updatedAt: Date.now() };
          state.roots.push(nid);
          state.activeTabId = nid;
        }
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
  if (t) { t.content = page.innerHTML; t.updatedAt = Date.now(); }
}
function loadTabContent() {
  const t = getTab(state.activeTabId);
  page.innerHTML = t ? t.content : '<p>Start writing…</p>';
  updateWordCount();
  $('#statusTab').textContent = `Tab: ${t ? t.title : '—'}`;
}
function updateWordCount() {
  const text = page.innerText.replace(/\s+/g, ' ').trim();
  const words = text ? text.split(' ').length : 0;
  $('#wordCount').textContent = `${words} word${words === 1 ? '' : 's'}`;
  $('#statusWords').textContent = `${words} words`;
}
page.addEventListener('input', () => { saveCurrentContent(); updateWordCount(); save(); });
page.addEventListener('paste', e => {
  // paste as plain text to keep the doc clean, unless it contains HTML from this doc
  const html = e.clipboardData.getData('text/html');
  if (!html) return; // plain text paste is fine
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  document.execCommand('insertText', false, text);
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
function focusPage() { page.focus(); }
function exec(cmd, val = null) {
  focusPage();
  document.execCommand(cmd, false, val);
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
  paint: () => toast('Paint format: select text, then click Paint format, then select target text', 'format_paint'),
  bold: () => exec('bold'),
  italic: () => exec('italic'),
  underline: () => exec('underline'),
  strike: () => exec('strikeThrough'),
  link: () => {
    const url = prompt('Insert link URL:', 'https://');
    if (url) exec('createLink', url);
  },
  image: () => {
    const url = prompt('Image URL:', 'https://');
    if (url) exec('insertImage', url);
  },
  checklist: () => exec('insertUnorderedList'),
  bullets: () => exec('insertUnorderedList'),
  numbering: () => exec('insertOrderedList'),
  indent: () => exec('indent'),
  outdent: () => exec('outdent'),
  clear: () => { exec('removeFormat'); exec('unlink'); toast('Formatting cleared', 'format_clear'); },
  'fontsize-inc': () => changeFontSize(1),
  'fontsize-dec': () => changeFontSize(-1),
};

function changeFontSize(delta) {
  const input = $('#fontSizeInput');
  let size = parseInt(input.value, 10) || 12;
  size = Math.min(72, Math.max(6, size + delta));
  input.value = size;
  exec('fontSize', size > 24 ? 7 : size > 18 ? 6 : size > 14 ? 5 : size > 12 ? 4 : size > 10 ? 3 : 2);
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

const TEXT_COLORS = ['#000000', '#444746', '#1a73e8', '#188038', '#b3261e', '#f9ab00', '#9334e6', '#e8710a', '#0b8043', '#d93025', '#1a73e8', '#5f6368', '#ffffff', '#fbbc04', '#a8dab5', '#f28b82'];
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
  page.contentEditable = m === 'viewing' ? 'false' : 'true';
  toast(m === 'viewing' ? 'Viewing mode — editing disabled' : m === 'suggesting' ? 'Suggesting mode' : 'Editing mode', 'edit');
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
    { sep: true },
    { icon: 'print', label: 'Print', shortcut: 'Ctrl+P', fn: () => toolbarActions.print() },
    { icon: 'info', label: 'Document details', fn: showDetails },
    { sep: true },
    { icon: 'delete_forever', label: 'Reset MegaDoc (delete all)', danger: true, fn: resetAll },
  ]},
  { label: 'Edit', items: [
    { icon: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', fn: () => exec('undo') },
    { icon: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', fn: () => exec('redo') },
    { sep: true },
    { icon: 'content_cut', label: 'Cut', shortcut: 'Ctrl+X', fn: () => exec('cut') },
    { icon: 'content_copy', label: 'Copy', shortcut: 'Ctrl+C', fn: () => exec('copy') },
    { icon: 'content_paste', label: 'Paste', shortcut: 'Ctrl+V', fn: () => exec('paste') },
    { sep: true },
    { icon: 'select_all', label: 'Select all', shortcut: 'Ctrl+A', fn: () => exec('selectAll') },
    { icon: 'find_replace', label: 'Find in tab', shortcut: 'Ctrl+F', fn: findInTab },
  ]},
  { label: 'View', items: [
    { icon: 'view_sidebar', label: 'Toggle tabs panel', fn: () => $('#tabsPanel').classList.toggle('open') },
    { icon: 'zoom_in', label: 'Zoom in', shortcut: 'Ctrl++', fn: () => setZoom(Math.min(200, state.zoom + 25)) },
    { icon: 'zoom_out', label: 'Zoom out', shortcut: 'Ctrl+-', fn: () => setZoom(Math.max(50, state.zoom - 25)) },
    { icon: 'fullscreen', label: 'Full screen', fn: () => document.documentElement.requestFullscreen?.().catch(() => {}) },
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
    { icon: 'dark_mode', label: 'Dark page', fn: () => { page.style.background = page.style.background === 'rgb(32, 33, 36)' ? '' : '#202124'; page.style.color = page.style.background === 'rgb(32, 33, 36)' ? '#e8eaed' : ''; toast('Dark page toggled', 'dark_mode'); } },
  ]},
  { label: 'Help', items: [
    { icon: 'keyboard', label: 'Keyboard shortcuts', fn: showShortcuts },
    { icon: 'help', label: 'About MegaDoc', fn: showAbout },
  ]},
  { label: 'Accessibility', items: [
    { icon: 'format_size', label: 'Larger text', fn: () => setZoom(Math.min(200, state.zoom + 25)) },
    { icon: 'contrast', label: 'High contrast page', fn: () => { page.style.filter = page.style.filter ? '' : 'contrast(1.15)'; toast('High contrast toggled', 'contrast'); } },
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

function insertTable() {
  exec('insertHTML', '<table><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr><tr><td>Cell</td><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td><td>Cell</td></tr></table><p><br></p>');
  toast('Table inserted', 'table');
}
function findInTab() {
  const q = prompt('Find in this tab:');
  if (!q) return;
  const found = page.innerHTML.toLowerCase().includes(q.toLowerCase());
  toast(found ? `Found "${q}" in this tab` : `"${q}" not found in this tab`, found ? 'search' : 'search_off');
}
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
function resetAll() {
  confirmModal('Reset MegaDoc?', '<p>This deletes <b>all tabs and content</b> stored in this browser and restores the starter document. Export a backup first if you need it.</p>', 'Reset everything', () => {
    localStorage.removeItem(LS_KEY);
    state = seedState();
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
  const link = `https://megadoc.local/${state.docTitle.toLowerCase().replace(/\s+/g, '-')}/${state.activeTabId}`;
  openModal('Share “' + state.docTitle + '”', `
    <p>Anyone with this link can view this document. (Demo link — MegaDoc stores everything locally in your browser.)</p>
    <div class="field"><label>Document link</label>
      <div class="share-link-row"><input id="shareLink" readonly value="${esc(link)}" /><button class="btn primary" id="copyLink">Copy</button></div></div>
    <div class="field"><label>People with access</label>
      <div class="share-link-row"><input id="shareEmail" placeholder="Add people by email…" /><button class="btn text" id="inviteBtn">Invite</button></div></div>`,
    `<button class="btn text" id="mDone">Done</button>`);
  $('#copyLink').addEventListener('click', () => { $('#shareLink').select(); navigator.clipboard?.writeText(link); toast('Link copied', 'link'); });
  $('#inviteBtn').addEventListener('click', () => { const v = $('#shareEmail').value.trim(); if (v) { toast(`Invitation sent to ${v}`, 'mail'); $('#shareEmail').value = ''; } });
  $('#mDone').addEventListener('click', closeModal);
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
  page.style.paddingLeft = m.left + 'px';
  page.style.paddingRight = m.right + 'px';
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
function wireToolbar() {
  $$('#toolbar [data-cmd]').forEach(btn => btn.addEventListener('click', () => toolbarActions[btn.dataset.cmd]?.()));
  // dropdowns
  $$('.tb-dropdown > .tb-select, .tb-dropdown > .tb-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const dd = btn.closest('.tb-dropdown');
      const was = dd.classList.contains('open');
      closeMenus();
      if (!was) dd.classList.add('open');
    });
  });
  $$('#zoomMenu button').forEach(b => b.addEventListener('click', () => { setZoom(+b.dataset.zoom); closeMenus(); }));
  $$('#styleMenu button').forEach(b => b.addEventListener('click', () => { setStyle(b.dataset.style); closeMenus(); }));
  $$('#fontMenu button').forEach(b => b.addEventListener('click', () => { setFont(b.dataset.font); closeMenus(); }));
  $$('#alignMenu button').forEach(b => b.addEventListener('click', () => { exec(b.dataset.align); closeMenus(); }));
  $$('#spacingMenu button').forEach(b => b.addEventListener('click', () => {
    const block = selectionBlock();
    if (block) block.style.lineHeight = b.dataset.spacing;
    saveCurrentContent(); save(); closeMenus();
  }));
  $$('#modeMenu button').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); closeMenus(); }));
  $('#fontSizeInput').addEventListener('change', e => {
    const size = parseInt(e.target.value, 10) || 12;
    exec('fontSize', size > 24 ? 7 : size > 18 ? 6 : size > 14 ? 5 : size > 12 ? 4 : size > 10 ? 3 : 2);
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
  $('#starBtn').addEventListener('click', () => {
    state.starred = !state.starred;
    $('#starBtn').classList.toggle('active', state.starred);
    $('#starBtn .material-symbols-outlined').textContent = state.starred ? 'star' : 'star';
    $('#starBtn .material-symbols-outlined').style.fontVariationSettings = state.starred ? "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24" : '';
    save(); toast(state.starred ? 'Starred' : 'Unstarred', 'star');
  });
  $('#moveBtn').addEventListener('click', () => toast('MegaDoc lives in this browser — use File → Export JSON to move it', 'folder'));
  $('#shareBtn').addEventListener('click', showShare);
  $('#shareArrow').addEventListener('click', showShare);
  $('#historyBtn').addEventListener('click', () => {
    const t = getTab(state.activeTabId);
    openModal('Version history', `<p>Last edited ${t ? new Date(t.updatedAt).toLocaleString() : '—'}.</p><p>MegaDoc auto-saves every change to this browser. Export JSON from the File menu for a full backup.</p>`, `<button class="btn text" id="mDone">Done</button>`);
    $('#mDone').addEventListener('click', closeModal);
  });
  $('#commentBtn').addEventListener('click', () => toast('Comments are not in this demo — everything is already in one doc', 'comment'));
  $('#avatarBtn').addEventListener('click', () => toast('Signed in locally as MegaDoc user', 'account_circle'));
  $('#logoBtn').addEventListener('click', () => selectTab(state.roots[0]));
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
  $('#panelBack').addEventListener('click', () => $('#tabsPanel').classList.remove('open'));
  $('#statusOutline').addEventListener('click', showOutline);
  $('#importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then(text => {
      try {
        const imported = JSON.parse(text);
        if (!imported.tabs || !imported.roots) throw new Error('bad file');
        state = imported;
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
    if (e.key === 'Escape') closeModal();
  });
}

/* ─────────────────────────── Init ─────────────────────────── */
function init() {
  $('#docTitle').value = state.docTitle || 'MegaDoc';
  document.title = `${state.docTitle || 'MegaDoc'} — MegaDoc`;
  if (state.starred) {
    $('#starBtn').classList.add('active');
    $('#starBtn .material-symbols-outlined').style.fontVariationSettings = "'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24";
  }
  buildMenubar();
  buildPalettes();
  wireToolbar();
  wireTopbar();
  wirePanel();
  wireKeyboard();
  buildRuler();
  addEventListener('resize', buildRuler);

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
