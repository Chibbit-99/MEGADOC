'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const path = require('node:path');
let revision = 'r1', documentOverrides = {}, calls = [], cache = new Map(), createFailure = false, updateFailure = false;
const base = () => ({title:'Existing', revisionId:revision, suggestionsViewMode:'SUGGESTIONS_INLINE', commentsViewMode:'COMMENTS_VIEW_MODE_INCLUDED', tabs:[{tabProperties:{tabId:'t.0'}, documentTab:{body:{content:[{sectionBreak:{},startIndex:0,endIndex:1},{paragraph:{elements:[{textRun:{content:'old\n'}}]},startIndex:1,endIndex:5}]}}}]});
const ctx = {Docs:{Documents:{
  get(id,options) { calls.push({method:'get',id,options}); return {...base(),...documentOverrides}; },
  create(data) { calls.push({method:'create',data}); if (createFailure) throw Error('network'); return {documentId:'doc123456789'}; },
  batchUpdate(body,id) { calls.push({method:'batchUpdate',body,id}); if (updateFailure) throw Error('network'); }
}}, Utilities:{getUuid:()=>crypto.randomUUID(), computeDigest(_alg,text) { return [...crypto.createHash('sha256').update(text).digest()].map(n=>n>127?n-256:n); },DigestAlgorithm:{SHA_256:'sha'},Charset:{UTF_8:'utf8'}},
CacheService:{getUserCache:()=>({put:(k,v)=>cache.set(k,v),get:k=>cache.get(k),remove:k=>cache.delete(k)})},LockService:{getUserLock:()=>({waitLock(){},releaseLock(){}})},
HtmlService:{createHtmlOutputFromFile:()=>({setTitle:()=>({})})},console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../Code.gs'),'utf8'),ctx);
const payload = {version:1,title:'Example',blocks:[{kind:'HEADING_1',runs:[{text:'Hi 😀',style:{bold:true}},{text:' link',style:{link:'https://example.com'}}]},{kind:'NORMAL_TEXT',runs:[]}]};
const exec = (name,...args) => ctx[name](...args);
const rejects = (fn,re) => assert.throws(fn,re);
const id='1234567890abcdef';
assert.equal(exec('documentId_',`https://docs.google.com/document/d/${id}/edit`),id);
rejects(()=>exec('documentId_',`https://evil.example/document/d/${id}/edit`),/valid/);
rejects(()=>exec('validatePayload_', {...payload,blocks:[{kind:'NORMAL_TEXT',runs:[{text:'bad\nline'}]}]}),/unsupported/);
rejects(()=>exec('validatePayload_', {...payload,blocks:[{kind:'NORMAL_TEXT',runs:[{text:'\ud800'}]}]}),/unsupported/);
rejects(()=>exec('validatePayload_', {...payload,blocks:[{kind:'NORMAL_TEXT',runs:[{text:'a',style:{link:'javascript:alert(1)'}}]}]}),/Unsupported/);
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
