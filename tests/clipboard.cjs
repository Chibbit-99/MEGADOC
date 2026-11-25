// Real browser clipboard and rich-paste regressions. See README for setup.
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  try {
    for (const mobile of [false,true]) {
      const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
      const p=await context.newPage(),errors=[]; p.on('pageerror',e=>errors.push(e.stack));
      try {
        await p.goto(process.env.MEGADOC_URL||'http://localhost:8000'); await p.locator('#emptyNewTab').click();await p.locator('.tab-rename').fill('Source');await p.locator('.tab-rename').press('Enter');if(mobile)await p.locator('#panelBack').click();
        const editor=p.locator('#page');
        const source='<h2>Heading</h2><p>Text <strong>bold</strong> <em>italic</em> <span style="font-family:Georgia;font-size:24px;color:rgb(255, 0, 0)">red</span> <a href="https://example.com">link</a></p><ul><li>First</li><li>Second</li></ul>';
        await editor.evaluate((el,html)=>{el.innerHTML=html;el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();let r=document.createRange();r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));},source);
        await p.keyboard.press('Control+c');
        const copied=await p.evaluate(async()=>{let items=await navigator.clipboard.read();let item=items[0];return {types:item.types,html:await(await item.getType('text/html')).text(),text:await(await item.getType('text/plain')).text()}});
        assert.ok(copied.types.includes('text/html'));assert.match(copied.html,/<strong/i);assert.match(copied.text,/bold italic red link/);
        if(mobile)await p.locator('#panelReopen').click();await p.locator('#addRootTab').click();await p.locator('.tab-rename').fill('Target');await p.locator('.tab-rename').press('Enter');if(mobile)await p.locator('#panelBack').click();
        await editor.click();await p.keyboard.press('Control+v');
        assert.equal(await editor.locator('h2').innerText(),'Heading');assert.equal(await editor.locator('strong').innerText(),'bold');assert.equal(await editor.locator('em').innerText(),'italic');assert.equal(await editor.locator('ul li').count(),2);assert.match(await editor.locator('a').getAttribute('href'),/^https:\/\/example.com/);
        assert.equal(await editor.locator('span').filter({hasText:'red'}).evaluate(el=>getComputedStyle(el).color),'rgb(255, 0, 0)');
        const pasted=await editor.innerHTML();await p.locator('[data-cmd=undo]').click();assert.equal((await editor.innerText()).trim(),'');await p.locator('[data-cmd=redo]').click();assert.equal(await editor.innerHTML(),pasted);
        await p.waitForTimeout(500);await p.reload();assert.equal(await editor.innerHTML(),pasted);
        // Native menu copy retains rich text on the system clipboard too.
        await editor.evaluate(el=>{el.focus();let r=document.createRange();r.selectNodeContents(el.querySelector('p'));getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));});
        await p.locator('#menubar .menu-item').filter({hasText:'Edit'}).click();await p.locator('#menuDropdown .mi').filter({hasText:'Copy'}).click();
        const menuCopy=await p.evaluate(async()=>{const i=(await navigator.clipboard.read())[0];return (await(await i.getType('text/html')).text())});assert.match(menuCopy,/<strong/i);
        // Menu paste uses clipboard HTML, not only readText().
        await editor.evaluate(el=>{el.focus();let r=document.createRange();r.selectNodeContents(el);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));});
        await p.locator('#menubar .menu-item').filter({hasText:'Edit'}).click();await p.locator('#menuDropdown .mi').filter({hasText:'Paste'}).click();await p.waitForFunction(()=>document.querySelectorAll('#page strong').length===2);assert.equal(await editor.locator('em').count(),2);
        // Raw untrusted HTML is sanitized, while ordinary typography and tables remain.
        await editor.evaluate(el=>{el.innerHTML='<p>before</p>';el.focus();const r=document.createRange();r.selectNodeContents(el);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));const data=new DataTransfer();data.setData('text/html','<p style="color:red;background-image:url(https://bad.example/x)"><font face="Georgia" size="5" color="#f00">safe</font><b onclick="window.bad=1">bold</b><a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a><img src="javascript:alert(1)" onerror="window.bad=1"><script>window.bad=1</script><iframe src="https://bad.example"></iframe></p><table><tr><td>cell</td></tr></table>');data.setData('text/plain','safe bold bad good cell');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
        assert.equal(await editor.locator('script,iframe,[onclick],[onerror]').count(),0);assert.equal(await p.evaluate(()=>window.bad),undefined);assert.equal(await editor.locator('font').getAttribute('face'),'Georgia');assert.equal(await editor.locator('b').innerText(),'bold');assert.equal(await editor.locator('table td').innerText(),'cell');assert.equal(await editor.locator('a').first().getAttribute('href'),null);assert.equal(await editor.locator('img').getAttribute('src'),null);assert.equal(await editor.locator('p').last().evaluate(el=>el.style.backgroundImage),'');
        // Plain paste and paste-without-formatting remain browser native.
        await p.evaluate(()=>navigator.clipboard.writeText('plain only'));await editor.click();await p.keyboard.press('Control+v');assert.match(await editor.innerText(),/plain only/);
        await p.evaluate(()=>navigator.clipboard.write([new ClipboardItem({'text/html':new Blob(['<b>unformatted</b>'],{type:'text/html'}),'text/plain':new Blob(['unformatted'],{type:'text/plain'})})]));await editor.click();await p.keyboard.press('Control+Shift+v');assert.match(await editor.innerText(),/unformatted/);assert.equal(await editor.locator('b').filter({hasText:'unformatted'}).count(),0);
        assert.deepEqual(errors,[]); console.log(`${mobile?'Mobile':'Desktop'} rich copy, safe paste, menu, plain text and undo passed`);
      } finally {await context.close()}
    }
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
