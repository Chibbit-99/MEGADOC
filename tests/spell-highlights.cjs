// Test transient spelling highlights without mutating editor HTML.
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), {JSDOM}=require('jsdom');
(async()=>{
  // Exercise the actual worker against the bundled, independent dictionaries.
  const messages=[];
  const workerCtx={self:{postMessage:m=>messages.push(m)},fetch:async url=>({ok:true,text:async()=>fs.readFileSync('vendor/spelling/'+url.split('/').at(-1),'utf8')}), importScripts(){vm.runInContext(fs.readFileSync('vendor/spelling/nspell.min.js','utf8'),workerCtx)}, console};
  workerCtx.self.self=workerCtx.self; vm.createContext(workerCtx); workerCtx.window=workerCtx; workerCtx.globalThis=workerCtx; workerCtx.importScripts=()=>{vm.runInContext(fs.readFileSync('vendor/spelling/nspell.min.js','utf8'),workerCtx); if (!workerCtx.nspell) workerCtx.nspell=workerCtx.self.nspell;};
  vm.runInContext(fs.readFileSync('js/spell-worker.js','utf8'),workerCtx);
  await workerCtx.self.onmessage({data:{id:1,kind:'check',words:['work','colour','color','owrk']}});
  assert.equal(messages[0].correct.join(','),'true,true,true,false');
  await workerCtx.self.onmessage({data:{id:2,kind:'check',words:Array(201).fill('word')}}); assert.match(messages[1].error,/Unsupported/);
  await workerCtx.self.onmessage({data:{id:3,word:'owrk'}}); assert.equal(messages[2].correct,false); assert.ok(messages[2].suggestions.includes('work'));

  const dom=new JSDOM('<div id="page" contenteditable="true" spellcheck="true"><p>work owrk owrk colour</p><p>ow<b>rk</b> wörk</p><pre>owrk</pre><p spellcheck="false">owrk</p></div><div id="contextMenu"></div>',{url:'https://megadoc.example/',runScripts:'outside-only'}), w=dom.window;
  w.CSS={highlights:new Map(),supports:()=>true}; w.Highlight=class extends Set{};
  w.eval(`var page=document.querySelector('#page'), state={activeTabId:'a'}, tab={}, mode='editing', messages=[]; function getTab(id){return id==='a'?tab:null} function toast(message){messages.push(message)} function closeMenus(){} var editorRange; function exec(){};`);
  w.eval(`var requests=[], hold=false, pending=[]; window.Worker=class { postMessage(data){requests.push(data); if(hold) pending.push(data); else queueMicrotask(()=>this.onmessage({data:data.kind==='check'?{id:data.id,correct:data.words.map(w=>['work','colour','color'].includes(w.toLowerCase()))}:{id:data.id,correct:false,suggestions:['work']}})); } terminate(){} };`);
  const src=fs.readFileSync('js/app.js','utf8'); w.eval(src.slice(src.indexOf('const PERSONAL_DICTIONARY_KEY'),src.indexOf('/* Editor context menu:'))+`\nwindow.spellTest={check(){scheduleSpellHighlights();clearTimeout(spellTimer);return refreshSpellHighlights(spellGeneration)}, invalidate(){scheduleSpellHighlights();clearTimeout(spellTimer)}, setEnabled(v){spellingEnabled=v}, get custom(){return customSpellingActive},setCustom(v){customSpellingActive=v},clearCache(){spellCache.clear()}, fail(){spellWorker.onerror()}, respond(data){spellWorker.onmessage({data})}}`);
  w.eval('initSpelling()'); assert.equal(w.eval('page.spellcheck'),false);
  async function check() { await Promise.resolve(); await w.spellTest.check(); }
  const html=w.document.querySelector('#page').innerHTML; const selected=w.document.createRange(); selected.setStart(w.document.querySelector('#page p').firstChild,1); selected.collapse(true); w.getSelection().removeAllRanges(); w.getSelection().addRange(selected); await check(); assert.equal(w.getSelection().anchorOffset,1);
  const ranges=()=>[...(w.CSS.highlights.get('megadoc-spelling') || [])];
  assert.equal(ranges().length,2); assert.equal(ranges().map(r=>r.toString()).join(','),'owrk,owrk'); assert.equal(w.document.querySelector('#page').innerHTML,html);
  w.document.querySelector('#page').setAttribute('spellcheck','false'); const target=w.eval(`wordAtContextPoint({target:page.querySelector('p'),clientX:0,clientY:0})`); assert.equal(target.word,'work');
  assert.ok(!w.eval('requests[0].words').includes('ow')); assert.ok(!w.eval('requests[0].words').includes('rk')); assert.ok(!w.eval('requests[0].words').includes('w'));
  w.eval(`var menu=document.querySelector('#contextMenu'); var n=page.querySelector('p').firstChild; addSpellingSection(menu,{node:n,source:n.data,start:5,end:9,word:'owrk',tab,tabId:'a'},()=>{})`); await new Promise(resolve=>setTimeout(resolve,0));
  w.document.querySelector('.spelling-dictionary-action').click(); await check(); assert.equal(ranges().length,0); assert.equal(w.document.querySelector('#page').innerHTML,html);
  w.eval("savePersonalWord('owrk',false)"); await check(); assert.equal(ranges().length,2);
  w.spellTest.setEnabled(false); w.eval('page.spellcheck=false'); w.spellTest.invalidate(); assert.equal(w.CSS.highlights.has('megadoc-spelling'),false); w.spellTest.setEnabled(true);
  w.eval("mode='viewing'"); w.spellTest.invalidate(); assert.equal(w.CSS.highlights.has('megadoc-spelling'),false); w.eval("mode='editing'");
  // A stale worker response is never applied after a document mutation.
  w.eval("page.innerHTML='<p>freshbad</p>';hold=true"); await Promise.resolve(); w.spellTest.clearCache(); const inflight=w.spellTest.check();
  w.eval("page.innerHTML='<p>work</p>'"); w.spellTest.invalidate(); const request=w.eval('pending.shift()'); w.spellTest.respond({id:request.id,correct:[false]});
  await inflight; assert.equal(w.CSS.highlights.has('megadoc-spelling'),false); w.eval('hold=false'); await check(); assert.equal(ranges().length,0);
  // A worker failure falls back visibly instead of silently dropping checks.
  w.eval("page.innerHTML='<p>freshbad</p>';hold=true"); await Promise.resolve(); w.spellTest.clearCache(); const failed=w.spellTest.check(); w.spellTest.fail(); await failed;
  assert.equal(w.spellTest.custom,false); assert.equal(w.eval('page.spellcheck'),true); assert.match(w.eval('messages.at(-1)'),/browser spellcheck/);
  w.spellTest.setCustom(true); w.eval("page.textContent='x'.repeat(200001)"); await Promise.resolve(); await check(); assert.equal(w.spellTest.custom,false); assert.match(w.eval('messages.at(-1)'),/too large/);
  dom.window.close(); console.log('Spell worker and transient highlight tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
