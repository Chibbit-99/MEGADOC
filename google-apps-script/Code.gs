/* MegaDoc Google Docs export prototype. Deploy to execute as the accessing
   user. Do not log payloads, document content, tokens or request URLs. */
const MAX_TEXT_UNITS = 4000;
const MAX_RUNS = 200;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const TICKET_SECONDS = 300;

// Standalone only: do not enable ALLOWALL until an embedded origin protocol has
// been verified on a real deployment. No document content is accepted in URLs.
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('MegaDoc export');
}

function validatePayload_(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1 || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120 || !Array.isArray(input.blocks) || !input.blocks.length || input.blocks.length > 80) throw new Error('Invalid export content.');
  if (/[\x00-\x1f\x7f-\x9f]/.test(input.title)) throw new Error('The title contains unsupported characters.');
  let count = 0, length = 0;
  const blocks = input.blocks.map(block => {
    if (!block || !['NORMAL_TEXT','HEADING_1','HEADING_2','HEADING_3','HEADING_4','HEADING_5','HEADING_6'].includes(block.kind) || !Array.isArray(block.runs)) throw new Error('Invalid paragraph.');
    return {kind:block.kind, runs:block.runs.map(run => {
      if (!run || typeof run.text !== 'string' || !run.text || /[\x00-\x1f\x7f-\x9f\ue000-\uf8ff]/.test(run.text) || /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(run.text)) throw new Error('Text contains unsupported characters.');
      count++; length += run.text.length;
      const style = {};
      if (run.style !== undefined && (!run.style || typeof run.style !== 'object' || Array.isArray(run.style))) throw new Error('Invalid text style.');
      const source = run.style || {};
      for (const key of Object.keys(source)) {
        if (['bold','italic','underline','strikethrough'].includes(key) && typeof source[key] === 'boolean') style[key] = source[key];
        else if (key === 'link' && typeof source[key] === 'string' && /^https?:\/\/[^\s<>"']{1,2000}$/i.test(source[key])) style.link = source[key];
        else throw new Error('Unsupported text style or link.');
      }
      return {text:run.text, style};
    })};
  });
  if (count > MAX_RUNS || length + blocks.length > MAX_TEXT_UNITS) throw new Error('Export is too large.');
  return {version:1, title:input.title.trim(), blocks};
}

function requestsForPayload_(payload, tabId) {
  let text = '', ranges = [], paragraphs = [];
  for (const block of payload.blocks) {
    const start = 1 + text.length;
    for (const run of block.runs) {
      const from = 1 + text.length; text += run.text;
      if (Object.keys(run.style).length) ranges.push({start:from, end:1+text.length, style:run.style});
    }
    text += '\n'; paragraphs.push({start, end:1+text.length, kind:block.kind});
  }
  const location = {index:1}; if (tabId) location.tabId = tabId;
  const fullRange = {startIndex:1, endIndex:1+text.length}; if (tabId) fullRange.tabId = tabId;
  const requests = [{insertText:{location, text}}, {updateTextStyle:{range:fullRange, textStyle:{bold:false,italic:false,underline:false,strikethrough:false}, fields:'bold,italic,underline,strikethrough,link'}}];
  for (const paragraph of paragraphs) {
    const range = {startIndex:paragraph.start, endIndex:paragraph.end}; if (tabId) range.tabId = tabId;
    requests.push({updateParagraphStyle:{range, paragraphStyle:{namedStyleType:paragraph.kind}, fields:'namedStyleType'}});
  }
  for (const item of ranges) {
    const range = {startIndex:item.start, endIndex:item.end}; if (tabId) range.tabId = tabId;
    const style = {...item.style}; if (style.link) style.link = {url:style.link};
    requests.push({updateTextStyle:{range, textStyle:style, fields:Object.keys(style).join(',')}});
  }
  return requests;
}

function createDocument(input) {
  const payload = validatePayload_(input), requests = requestsForPayload_(payload, null);
  let id;
  try { const created = Docs.Documents.create({title:payload.title}); id = created.documentId; }
  catch (_) { throw new Error('Could not confirm document creation. Check Drive before retrying.'); }
  if (!id) throw new Error('Google did not return a document ID. Check Drive before retrying.');
  const url = 'https://docs.google.com/document/d/' + encodeURIComponent(id) + '/edit';
  try { Docs.Documents.batchUpdate({requests}, id); }
  catch (_) { return {ok:false, url, message:'A document was created, but the content update failed or its result is unknown. Check it before retrying.'}; }
  return {ok:true, url};
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
function digest_(payload) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(payload), Utilities.Charset.UTF_8).map(b => ('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function prepareOverwrite(value, input) {
  const payload=validatePayload_(input), document=inspectDocument_(documentId_(value));
  const ticket=Utilities.getUuid() + Utilities.getUuid();
  CacheService.getUserCache().put('overwrite:'+ticket, JSON.stringify({document,digest:digest_(payload)}), TICKET_SECONDS);
  return {ticket,title:document.title,documentId:document.id};
}
function overwriteDocument(ticket, confirmation, input) {
  const payload=validatePayload_(input);
  if (typeof ticket !== 'string' || !/^[a-f0-9-]{72}$/i.test(ticket)) throw new Error('The overwrite confirmation expired. Inspect the document again.');
  const lock=LockService.getUserLock(); lock.waitLock(10000);
  try {
    const cache=CacheService.getUserCache(), key='overwrite:'+ticket, raw=cache.get(key); cache.remove(key);
    if (!raw) throw new Error('The overwrite confirmation expired. Inspect the document again.');
    const saved=JSON.parse(raw);
    if (confirmation !== saved.document.title || digest_(payload) !== saved.digest) throw new Error('The confirmation or content changed. Inspect the document again.');
    const current=inspectDocument_(saved.document.id);
    if (current.revision !== saved.document.revision || current.tabId !== saved.document.tabId || current.end !== saved.document.end || current.title !== saved.document.title) throw new Error('The document changed. Inspect it again before overwriting.');
    const requests=requestsForPayload_(payload,current.tabId);
    if (current.end > 1) requests.unshift({deleteContentRange:{range:{startIndex:1,endIndex:current.end,tabId:current.tabId}}});
    try { Docs.Documents.batchUpdate({requests,writeControl:{requiredRevisionId:current.revision}},current.id); }
    catch (_) { throw new Error('Overwrite failed or its result is unknown. Check the document before retrying.'); }
    return {ok:true,url:'https://docs.google.com/document/d/'+encodeURIComponent(current.id)+'/edit'};
  } finally { lock.releaseLock(); }
}
