// Verify real editable text fits and wraps in pageless view at desktop and mobile widths.
const assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});try{
 for(const mobile of [false,true]){
  const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile}),errors=[];p.on('pageerror',e=>errors.push(e.stack));try{
   await p.goto(process.env.MEGADOC_URL||'http://localhost:8000');await p.locator('#emptyNewTab').click();await p.locator('.tab-rename').press('Enter');if(mobile)await p.locator('#panelBack').click();
   async function menu(name,item){await p.locator('#menubar .menu-item').filter({hasText:name}).click();await p.locator('#menuDropdown .mi').filter({hasText:item}).click()}
   await menu('View','Page view / pageless');await p.locator('input[value=pageless]').check();await p.locator('#mOk').click();
   const editor=p.locator('#page');await editor.click();const typed='Typing wraps cleanly through the available space '.repeat(30)+'SuperLongWord'.repeat(25);await p.keyboard.insertText(typed);
   async function check(label, minLines=true){const result=await editor.evaluate(el=>{const view=document.querySelector('#pageScroll').getBoundingClientRect(),tree=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),out=[];let n;while((n=tree.nextNode())){if(!n.data.trim())continue;for(let i=0;i<n.length;i++){if(/\s/.test(n.data[i]))continue;let r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);for(const box of r.getClientRects()){if(box.width>0)out.push({left:box.left,right:box.right,top:box.top})}}}return {view:{left:view.left,right:view.right},off:out.filter(r=>r.left<view.left-1||r.right>view.right+1).slice(0,5),lines:new Set(out.map(r=>Math.round(r.top))).size,scrollWidth:document.querySelector('#pageScroll').scrollWidth,clientWidth:document.querySelector('#pageScroll').clientWidth}});assert.equal(result.off.length,0,`${label}: ${JSON.stringify(result)}`);if(minLines)assert.ok(result.lines>1,`${label} did not wrap`);assert.ok(result.scrollWidth<=result.clientWidth+2,`${label} horizontal overflow: ${JSON.stringify(result)}`)}
   await check('typed, normal zoom');
   await menu('View','Zoom in');await menu('View','Zoom in');await menu('View','Zoom in');await menu('View','Zoom in');await check('typed, 200% zoom');
   if(!mobile){await p.locator('#panelBack').click();await check('typed, panel hidden');await p.locator('#panelReopen').click();await check('typed, panel open');}
   // Existing/imported formatted text must wrap without rewriting stored content.
   const html='<p style="white-space:nowrap">'+('nowrap text and words '.repeat(35))+'</p><pre>'+('long_code_token_'.repeat(60))+'</pre><div style="white-space:pre">'+('preformatted '.repeat(35))+'</div>';
   await editor.evaluate((el,value)=>{el.innerHTML=value;el.dispatchEvent(new Event('input',{bubbles:true}));},html);await check('formatted text and preformatted code, 200% zoom');assert.equal(await editor.innerHTML(),html);
   await p.waitForTimeout(500);await p.reload();assert.equal(await editor.innerHTML(),html);await check('reloaded formatting, 200% zoom');
   await editor.evaluate(el=>{el.innerHTML='';el.focus();const r=document.createRange();r.selectNodeContents(el);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));const data=new DataTransfer();data.setData('text/html','<p style="white-space:nowrap;color:red">'+('pastedUnbrokenText'.repeat(90))+'</p>');data.setData('text/plain','pastedUnbrokenText'.repeat(90));el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
   assert.equal(await editor.locator('p').evaluate(el=>el.style.color),'red');assert.equal((await editor.innerText()).replace(/\s/g,'').length,('pastedUnbrokenText'.repeat(90)).length);await check('formatted paste, 200% zoom');
   await p.locator('[data-cmd=undo]').click();assert.equal((await editor.innerText()).trim(),'');await p.locator('[data-cmd=redo]').click();await check('redone paste, 200% zoom');assert.deepEqual(errors,[]);console.log(`${mobile?'Mobile':'Desktop'} pageless text wrapping and persistence passed`);
  }finally{await p.close()}
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
