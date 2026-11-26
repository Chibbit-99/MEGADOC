// Local dictionary and menu behavior without a browser binary.
const assert=require('node:assert/strict'), fs=require('node:fs'), {JSDOM}=require('jsdom');
(async()=>{
  const dom=new JSDOM('<div id="page" contenteditable="true"><p>Wizzle</p></div><div id="contextMenu"></div>',{url:'https://megadoc.example/',runScripts:'outside-only'}), w=dom.window;
  w.eval(`var page=document.querySelector('#page'), menu=document.querySelector('#contextMenu'), state={activeTabId:'a'}, tab={}, mode='editing', messages=[]; page.spellcheck=true; function getTab(id){return id==='a'?tab:null} function closeMenus(){menu.classList.add('hidden')} function toast(message){messages.push(message)} var editorRange; function exec(){};`);
  w.eval('var workers=[]; window.Worker=class { constructor(){workers.push(this)} postMessage(data){this.request=data} terminate(){} };');
  const src=fs.readFileSync('js/app.js','utf8'); w.eval(src.slice(src.indexOf('const PERSONAL_DICTIONARY_KEY'),src.indexOf('/* Editor context menu:')));
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  function open(word='Wizzle') { w.eval(`menu.innerHTML='';menu.classList.remove('hidden');page.querySelector('p').firstChild.data=${JSON.stringify(word)};var node=page.querySelector('p').firstChild;var target={node,source:node.data,start:0,end:node.data.length,word:node.data,tab,tabId:'a'};addSpellingSection(menu,target,()=>{});`); }
  function reply(data) {w.eval(`workers.at(-1).onmessage({data:{id:workers.at(-1).request.id,...${JSON.stringify(data)}}})`);}
  function text(selector){return w.document.querySelector(selector)?.textContent}
  open(); reply({correct:false,suggestions:['wizzle','whistle']}); await tick(); assert.equal(text('.spelling-dictionary-action'),'Add to personal dictionary'); w.document.querySelector('.spelling-dictionary-action').click();
  assert.deepEqual(JSON.parse(w.localStorage.getItem('megadoc-personal-dictionary-v1')),['wizzle']); assert.match(w.eval('messages.at(-1)'),/browser underlines may remain/);
  open('WIZZLE'); await tick(); assert.equal(text('.spelling-status'),'In your personal dictionary'); assert.equal(w.eval('workers.length'),1); assert.equal(text('.spelling-dictionary-action'),'Remove from personal dictionary');
  // Persistence across a new page context and case/apostrophe normalization.
  w.eval(`savePersonalWord('Won’t',true)`); assert.equal(w.eval(`isPersonalWord("WON'T")`),true);
  const persisted=w.localStorage.getItem('megadoc-personal-dictionary-v1'); const other=new JSDOM('',{url:'https://megadoc.example/',runScripts:'outside-only'}); other.window.localStorage.setItem('megadoc-personal-dictionary-v1',persisted); other.window.eval(src.slice(src.indexOf('const PERSONAL_DICTIONARY_KEY'),src.indexOf('let spellWorker = null'))); assert.equal(other.window.eval(`isPersonalWord('Wizzle')`),true); other.window.close();
  w.document.querySelector('.spelling-dictionary-action').click(); assert.equal(w.eval("isPersonalWord('wizzle')"),false);
  open(); reply({correct:false,suggestions:[]}); await tick(); assert.equal(text('.spelling-status'),'No suggestions'); assert.equal(text('.spelling-dictionary-action'),'Add to personal dictionary');
  // A changed target must never be added by a stale action.
  w.document.querySelector('#page p').firstChild.data='Changed'; w.document.querySelector('.spelling-dictionary-action').click(); assert.equal(w.eval("isPersonalWord('wizzle')"),false); assert.match(w.eval('messages.at(-1)'),/Text changed/);
  open(); w.eval("savePersonalWord('wizzle',true)"); reply({correct:false,suggestions:['whistle']}); await tick(); assert.equal(text('.spelling-status'),'In your personal dictionary'); assert.equal(w.document.querySelectorAll('.spelling-suggestion').length,0);
  w.eval("savePersonalWord('wizzle',false)"); open(); reply({correct:true}); await tick(); assert.equal(text('.spelling-status'),'Recognized by MegaDoc dictionaries'); assert.equal(text('.spelling-dictionary-action'),'Add to personal dictionary');
  // Broken storage never gets overwritten and a failed save is reported.
  w.localStorage.setItem('megadoc-personal-dictionary-v1','not-json'); open(); reply({correct:false,suggestions:[]}); await tick(); w.document.querySelector('.spelling-dictionary-action').click(); assert.equal(w.localStorage.getItem('megadoc-personal-dictionary-v1'),'not-json'); assert.match(w.eval('messages.at(-1)'),/could not be read/);
  w.localStorage.removeItem('megadoc-personal-dictionary-v1'); open(); reply({correct:false,suggestions:[]}); await tick(); const original=w.Storage.prototype.setItem; w.Storage.prototype.setItem=function(){throw Error('quota')}; w.document.querySelector('.spelling-dictionary-action').click(); assert.match(w.eval('messages.at(-1)'),/Could not save/); w.Storage.prototype.setItem=original;
  // A full dictionary and disabled storage cannot pretend a word was saved.
  const words=Array.from({length:5000},(_,n)=>'word'+String(n).split('').map(d=>String.fromCharCode(97+Number(d))).join(''));
  w.localStorage.setItem('megadoc-personal-dictionary-v1',JSON.stringify(words)); open(); reply({correct:false,suggestions:[]}); await tick(); w.document.querySelector('.spelling-dictionary-action').click(); assert.match(w.eval('messages.at(-1)'),/dictionary is full/); assert.equal(JSON.parse(w.localStorage.getItem('megadoc-personal-dictionary-v1')).length,5000);
  w.localStorage.removeItem('megadoc-personal-dictionary-v1'); open(); reply({correct:false,suggestions:[]}); await tick(); const oldGet=w.Storage.prototype.getItem; w.Storage.prototype.getItem=function(){throw Error('disabled')}; w.document.querySelector('.spelling-dictionary-action').click(); assert.match(w.eval('messages.at(-1)'),/storage is unavailable/); w.Storage.prototype.getItem=oldGet;
  // Menu and tab changes invalidate stale actions and responses.
  open(); w.eval("state.activeTabId='other'"); reply({correct:false,suggestions:['whistle']}); await tick(); assert.equal(w.document.querySelector('.spelling-section'),null); w.eval("state.activeTabId='a'");
  open(); w.eval("menu.classList.add('hidden')"); reply({correct:false,suggestions:['whistle']}); await tick(); assert.equal(w.document.querySelector('.spelling-dictionary-action'),null);
  // Worker failure keeps the rest of the menu usable and allows an intentional add.
  open(); w.eval('workers.at(-1).onerror()'); await tick(); assert.equal(text('.spelling-status'),'Suggestions unavailable'); assert.equal(text('.spelling-dictionary-action'),'Add to personal dictionary');
  dom.window.close(); console.log('Personal spelling dictionary tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
