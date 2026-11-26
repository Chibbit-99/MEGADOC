// Client tests use jsdom; install it separately (NODE_PATH may point to it).
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), {JSDOM}=require('jsdom');
(async()=>{
  const dom=new JSDOM('<div id="modalBackdrop" class="hidden"><div id="modal"></div></div><div id="page"></div>', {url:'https://megadoc.example/',runScripts:'outside-only'});
  const w=dom.window; let fetches=0, transferTimer, defaultUrl='https://script.google.com/a/macros/education.nsw.gov.au/s/AKfycbx_123-A/exec'; const realTimeout=w.setTimeout.bind(w); w.setTimeout=(fn,ms,...args)=> ms===30000 ? (transferTimer=fn,12345) : realTimeout(fn,ms,...args);
  const origin='https://n-test-script.googleusercontent.com', deploy='https://script.google.com/a/macros/education.nsw.gov.au/s/AKfycbx_123-A/exec';
  w.fetch=async()=>{fetches++;return {ok:true,json:async()=>({appsScriptUrl:defaultUrl})}};
  w.eval("var GOOGLE_DOCS_SETTINGS_KEY='megadoc-google-docs-settings-v1'");
  w.eval(`var $ = s => document.querySelector(s); var state={activeTabId:'one'}; var tab={title:'My tab'}; var getTab = id => id==='one'?tab:null; var page=$('#page'); function toast(){} function saveCurrentContent(){} function openModal(title,body,foot){$('#modal').innerHTML=body+foot;$('#modalBackdrop').classList.remove('hidden')} function closeModal(){if (googleDocsCleanup) googleDocsCleanup(); $('#modalBackdrop').classList.add('hidden'); const frame=$('#googleDocsFrame'); if(frame){frame.remove();$('#googleDocsTop')?.removeAttribute('href')}}`);
  let src=fs.readFileSync('js/app.js','utf8'); src=src.slice(src.indexOf('function googleDocsDeploymentUrl('),src.indexOf('function localImportDialog()'));
  w.eval(src.replace('let googleDocsCleanup = null;','var googleDocsCleanup = null;')+"\nwindow.openExport=googleDocsExportDialog;");
  assert.equal(w.googleDocsDeploymentUrl('https://script.google.com/macros/s/DEPLOY/exec').href,'https://script.google.com/macros/s/DEPLOY/exec');
  assert.equal(w.googleDocsDeploymentUrl(deploy).href,deploy);
  for (const bad of [
    'http://script.google.com/a/macros/education.nsw.gov.au/s/ID/exec',
    'https://script.google.com.evil.test/a/macros/education.nsw.gov.au/s/ID/exec',
    'https://evil.test@script.google.com/a/macros/education.nsw.gov.au/s/ID/exec',
    'https://script.google.com/a/macros/education..nsw.gov.au/s/ID/exec',
    'https://script.google.com/a/macros/-bad.example/s/ID/exec',
    'https://script.google.com/a/macros/education.nsw.gov.au/s/ID/dev',
    'https://script.google.com/a/macros/education.nsw.gov.au/s/ID/exec?foo=1',
    'https://script.google.com/a/macros/education.nsw.gov.au/s/ID/exec#fragment',
    'https://script.google.com/a/macros/education.nsw.gov.au/s/ID/exec/extra',
    'https://script.google.com/macros/s/ID/exec?foo=1'
  ]) assert.throws(()=>w.googleDocsDeploymentUrl(bad),/web app/);
  const editor=w.document.querySelector('#page');
  editor.innerHTML=`<h1>Heading 😀</h1><p style="text-align:center;line-height:1.5;margin-left:48px;text-indent:-24px;margin-top:8px"><strong>Bold 😀</strong><span style="font-size:16pt;color:#ff0000;background-color:#00ff00"><em> Red</em></span><a href="https://example.com"> link</a></p><ul><li>First<ul><li><u>Nested</u></li></ul></li></ul><p><br></p><p>After<br>break</p><img src="https://example.com/a.png"><table><tbody><tr><td>Cell</td></tr></tbody></table>`;
  const original=editor.innerHTML, rich=w.googleDocsPayload({title:'Rich'},editor);
  assert.equal(editor.innerHTML,original); assert.equal(rich.blocks[0].kind,'HEADING_1'); assert.equal(rich.blocks[0].runs[0].text,'Heading 😀'); assert.equal(rich.blocks[0].paragraph.lineSpacing,125); assert.equal(rich.blocks[0].paragraph.spaceBelow,9);
  const p=rich.blocks[1]; assert.equal(p.paragraph.alignment,'CENTER'); assert.equal(p.paragraph.lineSpacing,150); assert.equal(p.paragraph.indentStart,36); assert.equal(p.paragraph.indentFirstLine,18); assert.equal(p.paragraph.spaceAbove,6);
  assert.equal(p.runs[0].style.bold,true); assert.equal(p.runs[1].style.italic,true); assert.equal(p.runs[1].style.fontSize,16); assert.equal(p.runs[1].style.foregroundColor,'#ff0000'); assert.equal(p.runs[1].style.backgroundColor,'#00ff00'); assert.equal(p.runs[2].style.link,'https://example.com');
  assert.equal(rich.blocks[2].list.type,'BULLET'); assert.equal(rich.blocks[2].list.level,0); assert.equal(rich.blocks[3].list.level,1); assert.equal(rich.blocks[3].runs[0].style.underline,true);
  assert.equal(rich.blocks[4].runs.length,0); assert.equal(rich.blocks[5].runs[0].text,'After'); assert.equal(rich.blocks[6].runs[0].text,'break');
  assert.ok(rich.warnings.some(x=>/Images/.test(x))); assert.ok(rich.warnings.some(x=>/Tables/.test(x))); assert.equal(rich.blocks.at(-1).kind,'TABLE'); assert.equal(rich.blocks.at(-1).rows[0][0].blocks[0].runs[0].text,'Cell');
  // Exercise the browser-produced model through the real server validator and
  // request builder, not just separately constructed fixtures.
  const server={}; vm.createContext(server); vm.runInContext(fs.readFileSync('google-apps-script/Code.gs','utf8'),server);
  const accepted=server.validatePayload_(JSON.parse(JSON.stringify(rich))), requests=server.requestsForPayload_({blocks:accepted.blocks.filter(b=>b.kind !== 'TABLE')},'t.0');
  assert.ok(requests.some(r=>r.updateTextStyle?.textStyle.bold === true));
  assert.ok(requests.some(r=>r.updateParagraphStyle?.paragraphStyle.indentStart?.magnitude === 36));
  assert.ok(requests.some(r=>r.createParagraphBullets?.bulletPreset === 'BULLET_DISC_CIRCLE_SQUARE'));

  editor.innerHTML='<p>before</p><table><tr><th style="width:120px;background-color:#ff0000"><b>Head 😀</b></th><th>Other</th></tr><tr style="height:40px"><td><p style="text-align:right">One <em>two</em></p><p>next</p></td><td><br></td></tr></table><p>after</p>';
  const tablePayload=w.googleDocsPayload({title:'Table'},editor), table=tablePayload.blocks.find(b=>b.kind==='TABLE');
  assert.equal(table.rows.length,2); assert.equal(table.rows[0].length,2); assert.equal(table.widths[0],90); assert.equal(table.heights[1],30); assert.equal(table.rows[0][0].backgroundColor,'#ff0000'); assert.equal(table.rows[0][0].blocks[0].runs[0].style.bold,true); assert.equal(table.rows[1][0].blocks[0].paragraph.alignment,'END'); assert.equal(table.rows[1][0].blocks.length,2); assert.equal(table.rows[1][1].blocks[0].runs.length,0);
  server.validatePayload_(JSON.parse(JSON.stringify(tablePayload)));
  for (const html of ['<table><tr><td colspan="2">x</td></tr></table>','<table><tr><td><table><tr><td>x</td></tr></table></td></tr></table>']) { editor.innerHTML=html; assert.throws(()=>w.googleDocsPayload({title:'x'},editor),/tables|table/i); }
  editor.innerHTML='<ul><li><p>Wrapped</p><ul><li>Child</li></ul></li></ul>'; const wrapped=w.googleDocsPayload({title:'Wrapped'},editor); assert.equal(wrapped.blocks.length,2); assert.equal(wrapped.blocks[0].list.level,0); assert.equal(wrapped.blocks[1].list.level,1);
  w.eval("page.innerHTML='<p>Hello 😀</p><p>'+ 'x'.repeat(5000)+'</p>'; openExport()");
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(fetches,1); assert.equal(w.document.querySelector('#googleDocsUrl').value,deploy); assert.equal(w.document.querySelector('#googleDocsOrigin'),null);
  assert.equal(w.document.querySelector('iframe'),null); // Nothing sent before consent.
  w.document.querySelector('#googleDocsUrl').value='https://script.google.com.evil.test/macros/s/DEPLOY/exec';
  w.document.querySelector('#mOk').click(); assert.match(w.document.querySelector('#googleDocsError').textContent,/script.google.com/); assert.equal(w.document.querySelector('iframe'),null);
  w.document.querySelector('#googleDocsUrl').value=deploy; w.document.querySelector('#mOk').click();
  assert.equal(JSON.parse(w.localStorage.getItem('megadoc-google-docs-settings-v1')).url,deploy);
  const frame=w.document.querySelector('#googleDocsFrame'), url=new URL(frame.src), nonce=url.searchParams.get('request');
  assert.equal(url.host,'script.google.com'); assert.equal(url.searchParams.size,1); assert.match(nonce,/^[0-9a-f]{32}$/); assert.ok(!frame.src.includes('Hello')); assert.equal(w.document.querySelector('#googleDocsTop').href,deploy);
  const sent=[]; const child={parent:{parent:frame.contentWindow},postMessage:(data,target)=>sent.push({data,target})};
  const msg=(source,org,type,request=nonce)=>w.dispatchEvent(new w.MessageEvent('message',{source,origin:org,data:{version:1,type,request}}));
  msg(child,'https://wrong.example','megadoc-export-ready'); msg(child,origin,'megadoc-export-ready','wrong'); msg({parent:w,postMessage(){throw Error('wrong source')}},origin,'megadoc-export-ready'); assert.equal(sent.length,0);
  msg(child,origin,'megadoc-export-ready'); assert.equal(sent.length,1); assert.equal(sent[0].target,origin); const payload=sent[0].data.payload;
  assert.equal(payload.title,'My tab'); assert.equal(payload.blocks[0].runs[0].text,'Hello 😀'); assert.equal(payload.blocks[1].runs[0].text.length,5000);
  msg(child,origin,'megadoc-export-ready'); assert.equal(sent.length,1); msg({parent:frame.contentWindow},origin,'megadoc-export-received'); assert.match(w.document.querySelector('#googleDocsTransferStatus').textContent,/Sending/);
  msg(child,origin,'megadoc-export-received'); assert.match(w.document.querySelector('#googleDocsTransferStatus').textContent,/received/i); assert.equal(JSON.parse(w.localStorage.getItem('megadoc-google-docs-settings-v1')).origin,origin);
  w.document.querySelector('#mCancel').click(); assert.equal(w.document.querySelector('iframe'),null);
  defaultUrl='https://script.google.com/macros/s/OTHER/exec';
  w.eval("page.textContent='changed'; openExport()"); await new Promise(resolve=>setTimeout(resolve,0)); assert.equal(w.document.querySelector('#googleDocsUrl').value,deploy); w.document.querySelector('#mOk').click();
  const changedFrame=w.document.querySelector('#googleDocsFrame'), changedNonce=new URL(changedFrame.src).searchParams.get('request'); const changedOrigin='https://n-another-script.googleusercontent.com'; let changedSent=0;
  const changedPeer={parent:changedFrame.contentWindow,postMessage(data,target){changedSent++;assert.equal(target,changedOrigin);}};
  msg(changedPeer,changedOrigin,'megadoc-export-ready',changedNonce); assert.equal(changedSent,0); assert.match(w.document.querySelector('#googleDocsTransferStatus').textContent,/changed/);
  w.document.querySelector('#googleDocsTrust').click(); assert.equal(changedSent,1); msg(changedPeer,changedOrigin,'megadoc-export-received',changedNonce); assert.equal(JSON.parse(w.localStorage.getItem('megadoc-google-docs-settings-v1')).origin,changedOrigin);
  w.document.querySelector('#mCancel').click();
  w.eval("page.textContent='cancelled'; openExport()"); await new Promise(resolve=>setTimeout(resolve,0)); w.document.querySelector('#mOk').click();
  const cancelledFrame=w.document.querySelector('#googleDocsFrame'), cancelledNonce=new URL(cancelledFrame.src).searchParams.get('request'); let afterClose=0;
  const latePeer={parent:cancelledFrame.contentWindow,postMessage(){afterClose++}}; w.document.querySelector('#mCancel').click();
  msg(latePeer,origin,'megadoc-export-ready',cancelledNonce); assert.equal(afterClose,0);
  w.eval("page.textContent='timeout'; openExport()"); await new Promise(resolve=>setTimeout(resolve,0)); w.document.querySelector('#mOk').click();
  const timedFrame=w.document.querySelector('#googleDocsFrame'), timedNonce=new URL(timedFrame.src).searchParams.get('request'); let afterTimeout=0;
  const timedPeer={parent:timedFrame.contentWindow,postMessage(){afterTimeout++}}; transferTimer(); assert.match(w.document.querySelector('#googleDocsTransferStatus').textContent,/Could not confirm/);
  msg(timedPeer,origin,'megadoc-export-ready',timedNonce); assert.equal(afterTimeout,0); w.document.querySelector('#mCancel').click();
  w.eval("page.textContent='x'.repeat(100001); openExport()"); await new Promise(resolve=>setTimeout(resolve,0)); w.document.querySelector('#mOk').click(); assert.match(w.document.querySelector('#googleDocsError').textContent,/limits/); assert.equal(w.document.querySelector('iframe'),null);
  w.eval("page.textContent='hello'; openExport(); state.activeTabId='two'"); await new Promise(resolve=>setTimeout(resolve,0)); w.document.querySelector('#mOk').click(); assert.match(w.document.querySelector('#googleDocsError').textContent,/Select the tab again/);
  dom.window.close();

  const html=fs.readFileSync('google-apps-script/Index.html','utf8'); const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const outer=new JSDOM('<iframe></iframe>',{url:'https://megadoc.example/',runScripts:'outside-only'}); const f=outer.window.document.querySelector('iframe').contentWindow;
  f.document.open(); f.document.write(html.replace(/<script>[\s\S]*?<\/script>/,'')); f.document.close(); let create=0, recentFail=false; const outgoing=[];
  outer.window.postMessage=(data,target)=>outgoing.push({data,target});
  const runner={withSuccessHandler(fn){this.success=fn;return this},withFailureHandler(fn){this.failure=fn;return this},listRecentDocuments(){if(recentFail)this.failure({message:'Drive unavailable'}); else this.success([{id:'recent123456789',title:'Recent <doc>'}]);},prepareOverwrite(id){assert.equal(id,'recent123456789');this.success({ticket:'ticket',title:'Existing',documentId:id});},createDocument(value){create++;this.success({ok:true,url:'https://docs.google.com/document/d/abc123456789/edit'});assert.equal(value.title,'My tab')}};
  f.google={script:{run:runner}}; const boot={request:nonce,allowedOrigins:['https://megadoc.example']}; new vm.Script(code.replace('<?!= boot ?>',JSON.stringify(boot))); f.eval(code.replace('<?!= boot ?>',JSON.stringify(boot)));
  assert.equal(create,0); assert.equal(outgoing[0].data.type,'megadoc-export-ready'); assert.equal(outgoing[0].target,'https://megadoc.example');
  const deliver=(org,source,request,data=payload)=>f.dispatchEvent(new f.MessageEvent('message',{origin:org,source,data:{type:'megadoc-export-payload',version:1,request,payload:data}}));
  deliver('https://evil.example',outer.window,nonce); deliver('https://megadoc.example',f,nonce); deliver('https://megadoc.example',outer.window,'wrong'); assert.equal(f.document.querySelector('#content').value,'');
  deliver('https://megadoc.example',outer.window,nonce,{...payload,blocks:[{kind:'NORMAL_TEXT',runs:[{text:'x'.repeat(100001)}]}]}); assert.equal(f.document.querySelector('#content').value,'');
  deliver('https://megadoc.example',outer.window,nonce,{...rich,blocks:[{kind:'TABLE',widths:[null],rows:[[{blocks:[{kind:'TABLE',rows:[],widths:[]}]}]]}]}); assert.equal(f.document.querySelector('#content').value,'');
  const transportRich={...rich,title:'My tab'}; deliver('https://megadoc.example',outer.window,nonce,transportRich); assert.equal(JSON.parse(f.document.querySelector('#content').value).blocks[1].runs[0].style.bold,true); assert.equal(f.document.querySelector('#mode').value,'json'); assert.equal(JSON.parse(f.document.querySelector('#content').value).title,'My tab'); assert.equal(outgoing[1].data.type,'megadoc-export-received');
  deliver('https://megadoc.example',outer.window,nonce,{...payload,title:'replacement'}); assert.equal(JSON.parse(f.document.querySelector('#content').value).title,'My tab');
  recentFail=true; f.document.querySelector('#loadRecent').click(); assert.match(f.document.querySelector('#status').textContent,/Drive unavailable/); recentFail=false;
  f.document.querySelector('#loadRecent').click(); assert.equal(f.document.querySelectorAll('#recent option').length,2); assert.equal(f.document.querySelector('#recent option:last-child').textContent,'Recent <doc>'); f.document.querySelector('#recent').value='recent123456789'; f.document.querySelector('#recent').dispatchEvent(new f.Event('change')); assert.equal(f.document.querySelector('#document').value,'recent123456789'); f.document.querySelector('#inspect').click(); assert.equal(f.document.querySelector('#confirm').hidden,false); assert.match(f.document.querySelector('#target').textContent,/Existing/);
  f.document.querySelector('#create').click(); assert.equal(create,1); assert.equal(f.document.querySelector('#status a').href,'https://docs.google.com/document/d/abc123456789/edit'); outer.window.close();
  console.log('Google Docs guarded iframe messaging tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
