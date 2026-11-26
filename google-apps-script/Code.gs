/* MegaDoc Google Docs export prototype. Deploy to execute as the accessing
   user. Do not log payloads, document content, tokens or request URLs. */
const MAX_TEXT_UNITS = 100000;
const MAX_RUNS = 1000;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const TICKET_SECONDS = 300;

// A deployed HTML-service web app is embeddable by any site when ALLOWALL is
// enabled. No document writes or content are accepted from URL parameters.
function doGet(e) {
  const params = (e && e.parameters) || {};
  const requested = e && e.parameter && e.parameter.request;
  const validRequest = (!params.request || params.request.length === 1) && typeof requested === 'string' && /^[a-f0-9]{32}$/.test(requested);
  const boot = {request: validRequest ? requested : '', allowedOrigins: approvedOrigins_()};
  const template = HtmlService.createTemplateFromFile('Index');
  template.boot = JSON.stringify(boot).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return template.evaluate().setTitle('MegaDoc export').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function approvedOrigins_() {
  const raw = PropertiesService.getScriptProperties().getProperty('MEGADOC_ALLOWED_ORIGINS');
  // Trust the official MegaDoc host by default; custom hosts must set this property.
  let origins; try { origins = JSON.parse(raw === null ? '["https://chibbit-99.github.io"]' : raw); } catch (_) { return []; }
  if (!Array.isArray(origins) || origins.length > 20) return [];
  return origins.filter(origin => typeof origin === 'string' && origin.length <= 255 && /^(?:https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?|http:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]{1,5})?)$/.test(origin));
}

function validatePayload_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1 || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120 || !Array.isArray(input.blocks) || !input.blocks.length || input.blocks.length > 500) throw new Error('Invalid export content.');
  if (/[\x00-\x1f\x7f-\x9f]/.test(input.title)) throw new Error('The title contains unsupported characters.');
  if (JSON.stringify(input).length > 1000000) throw new Error('Export is too large.');
  let count = 0, length = 0, paragraphCount = 0, tableCount = 0, cellCount = 0;
  function validateBlock(block, inCell) {
    if (block && block.kind === 'TABLE') {
      if (inCell || ++tableCount > 10 || !Array.isArray(block.rows) || !block.rows.length || block.rows.length > 20 || !Array.isArray(block.rows[0]) || !block.rows[0].length || block.rows[0].length > 20) throw new Error('Invalid table.');
      const cols=block.rows[0].length;
      cellCount += cols * block.rows.length;
      if (cellCount > 200 || !Array.isArray(block.widths) || block.widths.length !== cols || block.widths.some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 12 || v > 1500))) throw new Error('Invalid table dimensions.');
      const heights=block.heights === undefined ? block.rows.map(()=>null) : block.heights;
      if (!Array.isArray(heights) || heights.length !== block.rows.length || heights.some(v=>v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0.75 || v > 1500))) throw new Error('Invalid table dimensions.');
      const rows=block.rows.map(row => {
        if (!Array.isArray(row) || row.length !== cols) throw new Error('Invalid table row.');
        return row.map(cell => {
          if (!cell || !Array.isArray(cell.blocks) || !cell.blocks.length || cell.blocks.length > 500 || (cell.backgroundColor !== undefined && (typeof cell.backgroundColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(cell.backgroundColor)))) throw new Error('Invalid table cell.');
          return {blocks:cell.blocks.map(b=>validateBlock(b,true)), ...(cell.backgroundColor ? {backgroundColor:cell.backgroundColor.toLowerCase()} : {})};
        });
      });
      return {kind:'TABLE',rows,widths:block.widths.slice(),heights:heights.slice()};
    }
    paragraphCount++;
    if (!block || !['NORMAL_TEXT','HEADING_1','HEADING_2','HEADING_3','HEADING_4','HEADING_5','HEADING_6'].includes(block.kind) || !Array.isArray(block.runs)) throw new Error('Invalid paragraph.');
    const paragraph = {};
    if (block.paragraph !== undefined && (!block.paragraph || typeof block.paragraph !== 'object' || Array.isArray(block.paragraph))) throw new Error('Invalid paragraph style.');
    for (const [key,value] of Object.entries(block.paragraph || {})) {
      if (key === 'alignment' && ['START','CENTER','END','JUSTIFIED'].includes(value)) paragraph[key] = value;
      else if (key === 'lineSpacing' && typeof value === 'number' && Number.isFinite(value) && value >= 50 && value <= 400) paragraph[key] = value;
      else if (['indentStart','indentFirstLine','indentEnd','spaceAbove','spaceBelow'].includes(key) && typeof value === 'number' && Number.isFinite(value) && value >= (key === 'indentFirstLine' ? -200 : 0) && value <= 400) paragraph[key] = value;
      else throw new Error('Unsupported paragraph style.');
    }
    let list;
    if (block.list !== undefined) {
      if (!block.list || typeof block.list !== 'object' || Array.isArray(block.list) || Object.keys(block.list).some(k => !['type','level'].includes(k)) || !['BULLET','NUMBER'].includes(block.list.type) || !Number.isInteger(block.list.level) || block.list.level < 0 || block.list.level > 8) throw new Error('Invalid list.');
      list = {type:block.list.type,level:block.list.level}; length += list.level;
    }
    const runs = block.runs.map(run => {
      if (!run || typeof run.text !== 'string' || !run.text || /[\x00-\x1f\x7f-\x9f\ue000-\uf8ff]/.test(run.text) || /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(run.text)) throw new Error('Text contains unsupported characters.');
      count++; length += run.text.length;
      const style = {};
      if (run.style !== undefined && (!run.style || typeof run.style !== 'object' || Array.isArray(run.style))) throw new Error('Invalid text style.');
      for (const [key,value] of Object.entries(run.style || {})) {
        if (['bold','italic','underline','strikethrough'].includes(key) && typeof value === 'boolean') style[key] = value;
        else if (key === 'link' && typeof value === 'string' && /^https?:\/\/[^\s<>"']{1,2000}$/i.test(value)) style[key] = value;
        else if (key === 'fontFamily' && typeof value === 'string' && /^[\w .-]{1,80}$/.test(value)) style[key] = value;
        else if (key === 'fontSize' && typeof value === 'number' && Number.isFinite(value) && value >= 6 && value <= 96) style[key] = value;
        else if (['foregroundColor','backgroundColor'].includes(key) && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) style[key] = value.toLowerCase();
        else if (key === 'baselineOffset' && ['SUPERSCRIPT','SUBSCRIPT'].includes(value)) style[key] = value;
        else throw new Error('Unsupported text style or link.');
      }
      return {text:run.text, style};
    });
    return {kind:block.kind, paragraph, ...(list ? {list} : {}), runs};
  }
  const blocks = input.blocks.map(block => validateBlock(block,false));
  if (paragraphCount > 500 || count > MAX_RUNS || length + paragraphCount > MAX_TEXT_UNITS) throw new Error('Export is too large.');
  return {version:1, title:input.title.trim(), blocks};
}

function requestsForPayload_(payload, tabId, startIndex, useExistingNewline) {
  const base = startIndex || 1;
  let text = '', ranges = [], paragraphs = [];
  for (const block of payload.blocks) {
    const start = base + text.length;
    if (block.list) text += '\t'.repeat(block.list.level);
    for (const run of block.runs) {
      const from = base + text.length; text += run.text;
      if (Object.keys(run.style).length) ranges.push({start:from, end:base+text.length, style:run.style});
    }
    text += '\n'; paragraphs.push({start, end:base+text.length, kind:block.kind, style:block.paragraph, list:block.list});
  }
  const range = (start,end) => { const r = {startIndex:start,endIndex:end}; if (tabId) r.tabId = tabId; return r; };
  const totalLength=text.length;
  if (useExistingNewline) text=text.slice(0,-1);
  const location = {index:base}; if (tabId) location.tabId = tabId;
  const requests = [];
  if (text) requests.push({insertText:{location,text}});
  requests.push({updateTextStyle:{range:range(base,base+totalLength), textStyle:{bold:false,italic:false,underline:false,strikethrough:false}, fields:'bold,italic,underline,strikethrough,link,foregroundColor,backgroundColor,weightedFontFamily,fontSize,baselineOffset'}});
  for (const paragraph of paragraphs) {
    const style = {namedStyleType:paragraph.kind};
    for (const [key,value] of Object.entries(paragraph.style || {})) style[key] = ['alignment','lineSpacing'].includes(key) ? value : {magnitude:value,unit:'PT'};
    requests.push({updateParagraphStyle:{range:range(paragraph.start,paragraph.end), paragraphStyle:style, fields:'namedStyleType,alignment,lineSpacing,indentStart,indentFirstLine,indentEnd,spaceAbove,spaceBelow'}});
  }
  for (const item of ranges) {
    const style = {};
    for (const [key,value] of Object.entries(item.style)) {
      if (key === 'link') style.link = {url:value};
      else if (key === 'fontFamily') style.weightedFontFamily = {fontFamily:value};
      else if (key === 'fontSize') style.fontSize = {magnitude:value,unit:'PT'};
      else if (key === 'foregroundColor' || key === 'backgroundColor') style[key] = {color:{rgbColor:{red:parseInt(value.slice(1,3),16)/255,green:parseInt(value.slice(3,5),16)/255,blue:parseInt(value.slice(5,7),16)/255}}};
      else style[key] = value;
    }
    requests.push({updateTextStyle:{range:range(item.start,item.end), textStyle:style, fields:Object.keys(style).join(',')}});
  }
  // Bullets remove leading nesting tabs. Apply from the end so original UTF-16
  // indices for earlier paragraphs remain valid, after all other style updates.
  for (let i = paragraphs.length - 1; i >= 0;) {
    if (!paragraphs[i].list) { i--; continue; }
    const last = i, type = paragraphs[i].list.type;
    while (i > 0 && paragraphs[i-1].list && paragraphs[i-1].list.type === type) i--;
    requests.push({createParagraphBullets:{range:range(paragraphs[i].start,paragraphs[last].end),bulletPreset:type === 'NUMBER' ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE'}});
    i--;
  }
  return requests;
}

// List a bounded set of recent, non-trashed Docs. Paging matters: Drive may
// return short pages, and read-only files can fill the first page. A name
// filter lets users find older documents without enumerating their whole Drive.
function listRecentDocuments(query) {
  if (query === undefined || query === null) query = '';
  if (typeof query !== 'string' || query.length > 100 || /[\x00-\x1f\x7f-\x9f]/.test(query)) throw new Error('Search must be at most 100 characters without control characters.');
  query = query.trim();
  let q = "mimeType = 'application/vnd.google-apps.document' and trashed = false";
  if (query) q += " and name contains '" + query.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + "'";
  const files=[], seen=new Set(), tokens=new Set();
  let pageToken, incomplete=false, more=false;
  try {
    for (let page=0;page<10 && files.length<20;page++) {
      const options={q,orderBy:'recency desc',pageSize:100,corpora:'allDrives',includeItemsFromAllDrives:true,supportsAllDrives:true,fields:'nextPageToken,incompleteSearch,files(id,name,capabilities(canEdit))'};
      if (pageToken) options.pageToken=pageToken;
      const response=Drive.Files.list(options);
      if (!response || (response.files !== undefined && !Array.isArray(response.files))) throw new Error('Invalid Drive response');
      incomplete = incomplete || response.incompleteSearch === true;
      const batch=response.files || [];
      for (let i=0;i<batch.length;i++) {
        const file=batch[i];
        if (!file || !/^[A-Za-z0-9_-]{10,200}$/.test(file.id || '') || seen.has(file.id) || (file.capabilities && file.capabilities.canEdit === false)) continue;
        seen.add(file.id);
        files.push({id:file.id,title:typeof file.name === 'string' ? file.name.slice(0,200) : 'Untitled document',canEdit:!!(file.capabilities && file.capabilities.canEdit === true)});
        if (files.length === 20) { more = i < batch.length-1 || !!response.nextPageToken; break; }
      }
      pageToken=response.nextPageToken;
      if (!pageToken || files.length === 20) break;
      if (typeof pageToken !== 'string' || tokens.has(pageToken)) throw new Error('Invalid Drive page token');
      tokens.add(pageToken);
      if (page === 9) more=true;
    }
  } catch (_) {
    throw new Error('Could not load Google Docs from Drive. Open the web app directly to authorize it, check the Drive advanced service and API are enabled, and verify the signed-in account. You can also enter a document URL.');
  }
  return {files,more,incomplete};
}

// Tables require a read between insertion and population: Google supplies cell
// indices only after insertion. Never use this multi-stage path for overwrite.
function createDocument(input) {
  const payload = validatePayload_(input);
  const tables=payload.blocks.filter(block=>block.kind === 'TABLE');
  const token = tables.length ? Utilities.getUuid().replace(/-/g,'') : '';
  const markers=[];
  const skeleton=payload.blocks.map(block => {
    if (block.kind !== 'TABLE') return block;
    const marker='MEGADOCTABLE'+token+'X'+markers.length+'END';
    markers.push({marker,table:block});
    return {kind:'NORMAL_TEXT',paragraph:{},runs:[{text:marker,style:{}}]};
  });
  const requests = requestsForPayload_({blocks:skeleton}, null);
  let id;
  try { const created = Docs.Documents.create({title:payload.title}); id = created.documentId; }
  catch (_) { throw new Error('Could not confirm document creation. Check Drive before retrying.'); }
  if (!id) throw new Error('Google did not return a document ID. Check Drive before retrying.');
  const url = 'https://docs.google.com/document/d/' + encodeURIComponent(id) + '/edit';
  try {
    if (!tables.length) Docs.Documents.batchUpdate({requests}, id);
    else {
      let doc=Docs.Documents.get(id);
      if (!doc.revisionId) throw new Error('Missing revision.');
      let revision=updatedRevision_(Docs.Documents.batchUpdate({requests,writeControl:{requiredRevisionId:doc.revisionId}},id));
      for (const entry of markers) revision=insertNewTable_(id,entry,revision);
    }
  } catch (_) { return {ok:false, url, message:'A document was created, but export stopped or its result is unknown. It may be incomplete; open it before retrying.'}; }
  return {ok:true, url};
}
function updatedRevision_(result) {
  const revision=result && result.writeControl && result.writeControl.requiredRevisionId;
  if (!revision) throw new Error('Missing update revision.');
  return revision;
}
function insertNewTable_(id, entry, expectedRevision) {
  let doc=Docs.Documents.get(id);
  if (doc.revisionId !== expectedRevision || !doc.body || !Array.isArray(doc.body.content)) throw new Error('Cannot inspect new document.');
  const matches=[];
  for (const element of doc.body.content) {
    if (!element.paragraph || !Array.isArray(element.paragraph.elements)) continue;
    const text=element.paragraph.elements.map(e=>e.textRun ? e.textRun.content : '').join('');
    if (text === entry.marker+'\n' && Number.isInteger(element.startIndex)) matches.push(element.startIndex);
  }
  if (matches.length !== 1) throw new Error('Cannot locate table placeholder.');
  const index=matches[0];
  const insertedRevision=updatedRevision_(Docs.Documents.batchUpdate({requests:[
    {deleteContentRange:{range:{startIndex:index,endIndex:index+entry.marker.length}}},
    {insertTable:{rows:entry.table.rows.length,columns:entry.table.rows[0].length,location:{index}}}
  ],writeControl:{requiredRevisionId:doc.revisionId}},id));
  doc=Docs.Documents.get(id);
  const element=doc.body && doc.body.content && doc.body.content.find(e=>e.startIndex === index+1 && e.table);
  if (doc.revisionId !== insertedRevision || !element || !Array.isArray(element.table.tableRows) || element.table.tableRows.length !== entry.table.rows.length) throw new Error('Cannot inspect inserted table.');
  const requests=[];
  const start={index:element.startIndex};
  for (let c=0;c<entry.table.widths.length;c++) if (entry.table.widths[c] !== null) requests.push({updateTableColumnProperties:{tableStartLocation:start,columnIndices:[c],tableColumnProperties:{widthType:'FIXED_WIDTH',width:{magnitude:entry.table.widths[c],unit:'PT'}},fields:'widthType,width'}});
  for (let r=0;r<entry.table.heights.length;r++) if (entry.table.heights[r] !== null) requests.push({updateTableRowStyle:{tableStartLocation:start,rowIndices:[r],tableRowStyle:{minRowHeight:{magnitude:entry.table.heights[r],unit:'PT'}},fields:'minRowHeight'}});
  const cells=[];
  element.table.tableRows.forEach((row,r)=>{
    if (!Array.isArray(row.tableCells) || row.tableCells.length !== entry.table.rows[r].length) throw new Error('Unexpected table shape.');
    row.tableCells.forEach((cell,c)=>{
      if (!Array.isArray(cell.content) || cell.content.length !== 1 || !cell.content[0].paragraph || !Number.isInteger(cell.content[0].startIndex) || cell.content[0].endIndex !== cell.content[0].startIndex + 1 || !Array.isArray(cell.content[0].paragraph.elements) || cell.content[0].paragraph.elements.length !== 1 || !cell.content[0].paragraph.elements[0].textRun || cell.content[0].paragraph.elements[0].textRun.content !== '\n') throw new Error('Unexpected cell contents.');
      const source=entry.table.rows[r][c];
      if (source.backgroundColor) {
        const color=source.backgroundColor;
        requests.push({updateTableCellStyle:{tableRange:{tableCellLocation:{tableStartLocation:start,rowIndex:r,columnIndex:c},rowSpan:1,columnSpan:1},tableCellStyle:{backgroundColor:{color:{rgbColor:{red:parseInt(color.slice(1,3),16)/255,green:parseInt(color.slice(3,5),16)/255,blue:parseInt(color.slice(5,7),16)/255}}}},fields:'backgroundColor'}});
      }
      cells.push({index:cell.content[0].startIndex,blocks:source.blocks});
    });
  });
  // Descending order keeps every unvisited cell's structural index stable.
  cells.sort((a,b)=>b.index-a.index);
  for (const cell of cells) requests.push(...requestsForPayload_({blocks:cell.blocks},null,cell.index,true));
  return updatedRevision_(Docs.Documents.batchUpdate({requests,writeControl:{requiredRevisionId:doc.revisionId}},id));
}

function documentId_(value) {
  if (typeof value !== 'string') throw new Error('Enter a Google Doc URL or ID.');
  const trimmed=value.trim(), match=/^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)(?:\/[^\s]*)?$/.exec(trimmed);
  const id=match ? match[1] : trimmed;
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) throw new Error('Enter a valid Google Doc URL or ID.');
  return id;
}
function hasEntries_(value) { return !!value && typeof value === 'object' && Object.keys(value).length > 0; }
function hasSuggestions_(value) {
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (/^suggested/i.test(key) && hasEntries_(child)) return true;
    if (child && typeof child === 'object' && hasSuggestions_(child)) return true;
  }
  return false;
}
function inspectDocument_(id) {
  let doc;
  try { doc = Docs.Documents.get(id, {includeTabsContent:true, suggestionsViewMode:'SUGGESTIONS_INLINE', commentsViewMode:'COMMENTS_VIEW_MODE_INCLUDED'}); }
  catch (_) { throw new Error('Cannot inspect this document. Check its ID, permissions and authorization.'); }
  if (!doc || JSON.stringify(doc).length > MAX_DOCUMENT_BYTES || doc.suggestionsViewMode !== 'SUGGESTIONS_INLINE' || doc.commentsViewMode !== 'COMMENTS_VIEW_MODE_INCLUDED' || !doc.revisionId || !Array.isArray(doc.tabs) || doc.tabs.length !== 1 || (doc.tabs[0].childTabs || []).length || !doc.tabs[0].tabProperties || !doc.tabs[0].tabProperties.tabId || !doc.tabs[0].documentTab) throw new Error('This document cannot be safely inspected or has multiple tabs.');
  const tab = doc.tabs[0].documentTab;
  if (hasEntries_(doc.comments) || hasEntries_(doc.suggestions) || ['headers','footers','footnotes','namedRanges','inlineObjects','positionedObjects','commentAnchors'].some(k => hasEntries_(tab[k]) || hasEntries_(doc[k])) || hasSuggestions_(doc)) throw new Error('Documents with comments, suggestions or special objects cannot be overwritten by this prototype.');
  const content = tab.body && tab.body.content;
  if (!Array.isArray(content) || !content.length || !content[content.length-1].paragraph || !Number.isInteger(content[content.length-1].endIndex)) throw new Error('The document body cannot be safely inspected.');
  let sections=0;
  for (const element of content) {
    if (element.sectionBreak) { sections++; continue; }
    if (!element.paragraph || element.paragraph.bullet || hasEntries_(element.paragraph.positionedObjectIds) || !Array.isArray(element.paragraph.elements) || element.paragraph.elements.some(item => !item.textRun)) throw new Error('Only plain-text document bodies can be overwritten by this prototype.');
  }
  if (sections > 1) throw new Error('Documents with multiple sections cannot be overwritten by this prototype.');
  const end = content[content.length-1].endIndex - 1;
  if (end < 1) throw new Error('Invalid document range.');
  return {id, title:doc.title || '', revision:doc.revisionId, tabId:doc.tabs[0].tabProperties.tabId, end};
}
// Object property order may change across google.script.run calls. Hash a
// canonical representation while retaining array order and every validated value.
function canonicalJson_(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson_).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson_(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function digest_(payload) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonicalJson_(payload), Utilities.Charset.UTF_8).map(b => ('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function prepareOverwrite(value, input) {
  const payload=validatePayload_(input);
  if (payload.blocks.some(block=>block.kind === 'TABLE')) throw new Error('Tables can only be exported to a new Google Doc; existing-document overwrite is disabled to protect its contents.');
  const document=inspectDocument_(documentId_(value));
  const ticket=Utilities.getUuid() + Utilities.getUuid();
  CacheService.getUserCache().put('overwrite:'+ticket, JSON.stringify({document,digest:digest_(payload)}), TICKET_SECONDS);
  return {ticket,title:document.title,documentId:document.id};
}
function overwriteDocument(ticket, confirmation, input) {
  const payload=validatePayload_(input);
  if (payload.blocks.some(block=>block.kind === 'TABLE')) throw new Error('Tables can only be exported to a new Google Doc.');
  if (typeof ticket !== 'string' || !/^[a-f0-9-]{72}$/i.test(ticket)) throw new Error('The overwrite confirmation expired. Inspect the document again.');
  const lock=LockService.getUserLock(); lock.waitLock(10000);
  try {
    const cache=CacheService.getUserCache(), key='overwrite:'+ticket, raw=cache.get(key); cache.remove(key);
    if (!raw) throw new Error('The overwrite confirmation expired. Inspect the document again.');
    const saved=JSON.parse(raw);
    if (confirmation !== saved.document.title) throw new Error('The title did not match the existing Google Doc. Inspect it again and type its exact title.');
    if (digest_(payload) !== saved.digest) throw new Error('The export content changed after inspection. Inspect the document again.');
    const current=inspectDocument_(saved.document.id);
    if (current.revision !== saved.document.revision || current.tabId !== saved.document.tabId || current.end !== saved.document.end || current.title !== saved.document.title) throw new Error('The document changed. Inspect it again before overwriting.');
    const requests=requestsForPayload_(payload,current.tabId);
    if (current.end > 1) requests.unshift({deleteContentRange:{range:{startIndex:1,endIndex:current.end,tabId:current.tabId}}});
    try { Docs.Documents.batchUpdate({requests,writeControl:{requiredRevisionId:current.revision}},current.id); }
    catch (_) { throw new Error('Overwrite failed or its result is unknown. Check the document before retrying.'); }
    return {ok:true,url:'https://docs.google.com/document/d/'+encodeURIComponent(current.id)+'/edit'};
  } finally { lock.releaseLock(); }
}
