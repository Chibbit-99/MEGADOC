'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
let driveFailure=false, driveArgs;
let revision = 'r1', documentOverrides = {}, calls = [], cache = new Map(), createFailure = false, updateFailure = false, template, allowedOrigins = '["https://megadoc.example"]';
const base = () => ({title:'Existing', revisionId:revision, suggestionsViewMode:'SUGGESTIONS_INLINE', commentsViewMode:'COMMENTS_VIEW_MODE_INCLUDED', tabs:[{tabProperties:{tabId:'t.0'}, documentTab:{body:{content:[{sectionBreak:{},startIndex:0,endIndex:1},{paragraph:{elements:[{textRun:{content:'old\n'}}]},startIndex:1,endIndex:5}]}}}]});
const ctx = {Drive:{Files:{list(options){driveArgs=options; if(driveFailure) throw Error('denied'); return {files:[{id:'recent123456789',name:'Recent',capabilities:{canEdit:true}},{id:'readonly123456789',name:'Read only',capabilities:{canEdit:false}},{id:'bad!',name:'Invalid',capabilities:{canEdit:true}}]};}}},Docs:{Documents:{
  get(id,options) { calls.push({method:'get',id,options}); return {...base(),...documentOverrides}; },
  create(data) { calls.push({method:'create',data}); if (createFailure) throw Error('network'); return {documentId:'doc123456789'}; },
  batchUpdate(body,id) { calls.push({method:'batchUpdate',body,id}); if (updateFailure) throw Error('network'); }
}}, Utilities:{newBlob:text=>({getBytes:()=>Buffer.from(text)}), getUuid:()=>crypto.randomUUID(), computeDigest(_alg,text) { return [...crypto.createHash('sha256').update(text).digest()].map(n=>n>127?n-256:n); },DigestAlgorithm:{SHA_256:'sha'},Charset:{UTF_8:'utf8'}},
CacheService:{getUserCache:()=>({put:(k,v)=>cache.set(k,v),get:k=>cache.get(k),remove:k=>cache.delete(k)})},LockService:{getUserLock:()=>({waitLock(){},releaseLock(){}})},
PropertiesService:{getScriptProperties:()=>({getProperty:()=>allowedOrigins})},
HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createTemplateFromFile:()=>{ template={evaluate:()=>({setTitle:()=>({setXFrameOptionsMode:mode=>({mode})})})}; return template; }},console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../Code.gs'),'utf8'),ctx);
const payload = {version:1,title:'Example',blocks:[{kind:'HEADING_1',runs:[{text:'Hi 😀',style:{bold:true}},{text:' link',style:{link:'https://example.com'}}]},{kind:'NORMAL_TEXT',runs:[]}]};
const exec = (name,...args) => ctx[name](...args);
const rejects = (fn,re) => assert.throws(fn,re);
const id='1234567890abcdef';
const nonce='0123456789abcdef0123456789abcdef';
let getResult=exec('doGet',{parameters:{request:[nonce]},parameter:{request:nonce}});
assert.equal(getResult.mode,'ALLOWALL');
assert.equal(JSON.parse(template.boot).request,nonce);
assert.equal(JSON.parse(template.boot).allowedOrigins[0],'https://megadoc.example');
exec('doGet',{parameters:{request:[nonce,nonce]},parameter:{request:nonce}}); assert.equal(JSON.parse(template.boot).request,'');
exec('doGet',{parameter:{request:'bad',payload:JSON.stringify(payload)}}); assert.equal(JSON.parse(template.boot).request,''); assert.equal(JSON.parse(template.boot).payload,undefined);
allowedOrigins='["https://good.example", "*", "https://evil.example/path", "http://localhost:8000"]';
exec('doGet',{}); assert.equal(JSON.stringify(JSON.parse(template.boot).allowedOrigins),JSON.stringify(['https://good.example','http://localhost:8000']));
allowedOrigins='not-json'; exec('doGet',{}); assert.equal(JSON.parse(template.boot).allowedOrigins.length,0);
allowedOrigins=null; exec('doGet',{}); assert.equal(JSON.parse(template.boot).allowedOrigins[0],'https://chibbit-99.github.io');
let recent=exec('listRecentDocuments'); assert.equal(recent.length,1); assert.equal(recent[0].id,'recent123456789'); assert.equal(driveArgs.orderBy,'viewedByMeTime desc'); assert.match(driveArgs.q,/application\/vnd\.google-apps\.document/); driveFailure=true; rejects(()=>exec('listRecentDocuments'),/Drive authorization/); driveFailure=false;
allowedOrigins='["https://megadoc.example"]';
rejects(()=>exec('validatePayload_', {...payload,blocks:[{kind:'NORMAL_TEXT',runs:[{text:'x'.repeat(100001)}]}]}),/large/);
assert.equal(exec('validatePayload_', {...payload,blocks:[{kind:'NORMAL_TEXT',runs:[{text:'x'.repeat(10000)}]}]}).blocks[0].runs[0].text.length,10000);
assert.equal(exec('documentId_',`https://docs.google.com/document/d/${id}/edit`),id);
rejects(()=>exec('documentId_',`https://evil.example/document/d/${id}/edit`),/valid/);
rejects(()=>exec('validatePayload_', {...payload,blocks:[{kind:'NORMAL_TEXT',runs:[{text:'bad\nline'}]}]}),/unsupported/);
rejects(()=>exec('validatePayload_', {...payload,blocks:[{kind:'NORMAL_TEXT',runs:[{text:'\ud800'}]}]}),/unsupported/);
rejects(()=>exec('validatePayload_', {...payload,blocks:[{kind:'NORMAL_TEXT',runs:[{text:'a',style:{link:'javascript:alert(1)'}}]}]}),/Unsupported/);
// Rich formatting, paragraph geometry and nested list indices (UTF-16).
const richInput={version:1,title:'Rich',blocks:[
  {kind:'HEADING_1',paragraph:{alignment:'CENTER',lineSpacing:150,indentStart:36,indentFirstLine:18},runs:[{text:'😀A',style:{bold:true,fontFamily:'Arial',fontSize:16,foregroundColor:'#ff0000',backgroundColor:'#00ff00'}}]},
  {kind:'NORMAL_TEXT',list:{type:'BULLET',level:0},runs:[{text:'One',style:{italic:true}}]},
  {kind:'NORMAL_TEXT',list:{type:'BULLET',level:1},runs:[{text:'Two',style:{underline:true,link:'https://example.com'}}]},
  {kind:'NORMAL_TEXT',list:{type:'NUMBER',level:0},runs:[{text:'End'}]}
]};
const normalized=exec('validatePayload_',richInput), richRequests=exec('requestsForPayload_',normalized,'t.0');
assert.equal(richRequests[0].insertText.text,'😀A\nOne\n\tTwo\nEnd\n');
const heading=richRequests.find(r=>r.updateParagraphStyle && r.updateParagraphStyle.paragraphStyle.namedStyleType==='HEADING_1').updateParagraphStyle;
assert.equal(heading.paragraphStyle.alignment,'CENTER'); assert.equal(heading.paragraphStyle.lineSpacing,150); assert.equal(heading.paragraphStyle.indentStart.magnitude,36); assert.equal(heading.paragraphStyle.indentFirstLine.magnitude,18); assert.equal(heading.range.tabId,'t.0');
const colored=richRequests.find(r=>r.updateTextStyle && r.updateTextStyle.textStyle.foregroundColor).updateTextStyle;
assert.equal(colored.range.startIndex,1); assert.equal(colored.range.endIndex,4); assert.equal(colored.textStyle.fontSize.magnitude,16); assert.equal(colored.textStyle.weightedFontFamily.fontFamily,'Arial'); assert.equal(colored.textStyle.foregroundColor.color.rgbColor.red,1); assert.equal(colored.textStyle.backgroundColor.color.rgbColor.green,1);
const bullets=richRequests.filter(r=>r.createParagraphBullets).map(r=>r.createParagraphBullets);
assert.equal(bullets.length,2); assert.equal(bullets[0].bulletPreset,'NUMBERED_DECIMAL_ALPHA_ROMAN'); assert.equal(bullets[0].range.startIndex,14); assert.equal(bullets[1].range.startIndex,5); assert.equal(bullets[1].range.endIndex,14); assert.equal(bullets[1].range.tabId,'t.0');
rejects(()=>exec('validatePayload_', {...richInput,blocks:[{kind:'NORMAL_TEXT',paragraph:{indentStart:-1},runs:[]}]}),/paragraph/);
rejects(()=>exec('validatePayload_', {...richInput,blocks:[{kind:'NORMAL_TEXT',list:{type:'BULLET',level:9},runs:[]}]}),/list/);
rejects(()=>exec('validatePayload_', {...richInput,blocks:[{kind:'NORMAL_TEXT',runs:[{text:'x',style:{foregroundColor:'url(https://bad.example)'}}]}]}),/Unsupported/);
const out=exec('createDocument',payload);
assert.equal(out.ok,true);
let update=calls.find(c=>c.method==='batchUpdate');
assert.equal(update.body.requests[0].insertText.text,'Hi 😀 link\n\n');
assert.equal(update.body.requests[2].updateParagraphStyle.range.endIndex,12);
assert.equal(update.body.requests[4].updateTextStyle.range.endIndex,6); // emoji is two UTF-16 units
assert.equal(update.body.requests[5].updateTextStyle.textStyle.link.url,'https://example.com');
updateFailure=true; assert.equal(exec('createDocument',payload).ok,false); updateFailure=false;
createFailure=true; rejects(()=>exec('createDocument',payload),/Check Drive/); createFailure=false;
calls=[];
let prep=exec('prepareOverwrite',id,payload);
assert.equal(prep.title,'Existing');
assert.equal(calls[0].options.commentsViewMode,'COMMENTS_VIEW_MODE_INCLUDED');
const success=exec('overwriteDocument',prep.ticket,'Existing',payload);
assert.equal(success.ok,true);
update=calls.find(c=>c.method==='batchUpdate');
assert.equal(update.body.writeControl.requiredRevisionId,'r1');
assert.equal(update.body.requests[0].deleteContentRange.range.endIndex,4);
assert.equal(update.body.requests[0].deleteContentRange.range.tabId,'t.0');
rejects(()=>exec('overwriteDocument',prep.ticket,'Existing',payload),/expired/);
prep=exec('prepareOverwrite',id,payload); revision='r2';
rejects(()=>exec('overwriteDocument',prep.ticket,'Existing',payload),/changed/); revision='r1';
prep=exec('prepareOverwrite',id,payload);
rejects(()=>exec('overwriteDocument',prep.ticket,'wrong',payload),/confirmation/);
prep=exec('prepareOverwrite',id,payload);
rejects(()=>exec('overwriteDocument',prep.ticket,'Existing',{...payload,title:'Changed'}),/content changed/);
for (const override of [{comments:[{commentId:'x'}]},{suggestions:[{suggestionId:'x'}]},{tabs:[...base().tabs,...base().tabs]},{commentsViewMode:'COMMENTS_VIEW_MODE_OMITTED'}, {suggestedDocumentStyleChanges:{s:{}}}, {tabs:[{...base().tabs[0],documentTab:{...base().tabs[0].documentTab,commentAnchors:{x:{}}}}]}]) {
  documentOverrides=override; rejects(()=>exec('prepareOverwrite',id,payload),/cannot be|Documents with/);
}
documentOverrides={tabs:[{...base().tabs[0],documentTab:{body:{content:[{paragraph:{bullet:{listId:'x'},elements:[{textRun:{content:'x\n'}}]},endIndex:3}]}}}]};
rejects(()=>exec('prepareOverwrite',id,payload),/plain-text/);
documentOverrides={}; prep=exec('prepareOverwrite',id,payload); updateFailure=true;
rejects(()=>exec('overwriteDocument',prep.ticket,'Existing',payload),/result is unknown/); updateFailure=false;
console.log('Apps Script server mock tests passed');
