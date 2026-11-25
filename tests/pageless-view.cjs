// Run against a local server; set CHROMIUM_PATH and NODE_PATH as in README.
const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');
const url = process.env.MEGADOC_URL || 'http://localhost:8000';
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox']});
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage({viewport:mobile ? {width:390,height:844} : {width:1440,height:900}, isMobile:mobile, hasTouch:mobile, acceptDownloads:true});
      const errors=[]; page.on('pageerror', error=>errors.push(error.message));
      await page.goto(url);
      await page.locator('#emptyNewTab').click(); await page.locator('.tab-rename').fill('Parent'); await page.locator('.tab-rename').press('Enter');
      const editor=page.locator('#page');
      if (mobile) await page.locator('#panelBack').click();
      await editor.evaluate(el=>{el.innerHTML='<p>Before and after</p>';el.dispatchEvent(new Event('input',{bubbles:true}));el.focus();});
      await editor.evaluate(el=>{const t=el.firstChild.firstChild, r=document.createRange(); r.setStart(t,6); r.collapse(true); const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'));});
      const menu = async (name, item) => {await page.locator('#menubar .menu-item').filter({hasText:name}).click();await page.locator('#menuDropdown .mi').filter({hasText:item}).click()};
      await page.locator('#menubar .menu-item').filter({hasText:'Insert'}).click();
      for(const label of ['Page break','Emoji & special characters']) {const item=page.locator('#menuDropdown .mi').filter({hasText:label});assert.equal(await item.locator('svg').count(),1);const box=await item.locator('svg').boundingBox();assert.ok(box.width<=20 && box.height<=20);}
      await page.locator('#menuDropdown .mi').filter({hasText:'Page break'}).click();
      assert.equal(await editor.locator('[data-megadoc-page-break]').count(),1);
      const before=await editor.innerHTML();
      await menu('View','Page view / pageless'); assert.equal(await page.locator('input[value=pages]').isChecked(),true);
      await page.locator('input[value=pageless]').check(); await page.locator('#mOk').click();
      assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('pageless-view')),true);
      assert.equal(await editor.innerHTML(),before); await page.locator('[data-cmd=undo]').click(); assert.equal(await editor.locator('[data-megadoc-page-break]').count(),0); await page.locator('[data-cmd=redo]').click(); assert.equal(await editor.innerHTML(),before); assert.equal(await editor.locator('[data-megadoc-page-break]').isVisible(),false); assert.equal(await page.locator('#ruler').isVisible(),false);
      let geom=await page.evaluate(()=>{const wrap=document.querySelector('#pageWrap').getBoundingClientRect(),scroll=document.querySelector('#pageScroll').getBoundingClientRect();return {wrap:wrap.width,scroll:scroll.width,left:wrap.left-scroll.left}}); assert.ok(Math.abs(geom.wrap-geom.scroll)<2 && Math.abs(geom.left)<2,JSON.stringify(geom));
      await menu('Insert','Page break'); assert.equal(await editor.locator('[data-megadoc-page-break]').count(),1); assert.match(await page.locator('#toastWrap').innerText(),/Switch to page view/);
      await menu('View','Zoom out'); await menu('View','Zoom out');
      let scroll = await page.locator('#pageScroll').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth})); assert.ok(scroll.scroll <= scroll.width+1,JSON.stringify(scroll));
      await menu('View','Zoom in'); await menu('View','Zoom in'); await menu('View','Zoom in'); await menu('View','Zoom in');
      geom=await page.evaluate(()=>{const wrap=document.querySelector('#pageWrap').getBoundingClientRect(),scroll=document.querySelector('#pageScroll').getBoundingClientRect();return {wrap:wrap.width,scroll:scroll.width,left:wrap.left-scroll.left}}); assert.ok(Math.abs(geom.wrap-geom.scroll)<2 && Math.abs(geom.left)<2,JSON.stringify(geom));
      await page.waitForTimeout(600); let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('megadoc-v2')));let id=saved.activeTabId;assert.equal(saved.tabs[id].pageView,'pageless');
      await page.reload(); assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('pageless-view')),true);assert.equal(await editor.innerHTML(),before);
      // A new child starts in page view, independently of the parent.
      if (mobile) await page.locator('#panelReopen').click();
      const parent=page.locator('.tab-row').filter({hasText:'Parent'}); await parent.hover();await parent.locator('.tab-dots').click();await page.locator('[data-a=addchild]').click();await page.locator('.tab-rename').fill('Child');await page.locator('.tab-rename').press('Enter');
      assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('pageless-view')),false); assert.equal(await page.locator('#ruler').isVisible(),true);
      // Badge retains readable contrast in dark mode, including active state.
      await menu('Settings','Appearance'); await page.locator('input[value=dark]').check();await page.locator('#appearanceDone').click();
      let badge=parent.locator('.tab-badge'); let colors=await badge.evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor})); assert.notEqual(colors.bg,'rgb(232, 234, 237)');
      const contrast=({fg,bg})=>{const l=s=>{let v=s.match(/\d+/g).slice(0,3).map(x=>Number(x)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]};let a=l(fg),b=l(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};assert.ok(contrast(colors)>=4.5,JSON.stringify(colors));
      await parent.locator('.tab-title').click(); assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('pageless-view')),true);colors=await badge.evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));assert.ok(contrast(colors)>=4.5,JSON.stringify(colors));
      if(mobile) await page.locator('#panelBack').click();
      await menu('View','Paginated preview'); await page.waitForFunction(()=>!document.querySelector('#paginationPrint').disabled,{timeout:45000}); assert.ok(await page.frameLocator('#paginationFrame').locator('.pagedjs_page').count()>=2);await page.locator('#paginationClose').click();
      await menu('View','Page view / pageless');await page.locator('input[value=pages]').check();await page.locator('#mOk').click();assert.equal(await page.locator('#ruler').isVisible(),true);assert.equal(await editor.locator('[data-megadoc-page-break]').isVisible(),true);assert.equal(await editor.innerHTML(),before);
      await menu('View','Page view / pageless');await page.locator('input[value=pageless]').check();await page.locator('#mOk').click();
      if(mobile) await page.locator('#panelReopen').click(); await parent.hover();await parent.locator('.tab-dots').click(); await page.locator('[data-a=duplicate]').click();assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('pageless-view')),true);assert.equal(await editor.locator('[data-megadoc-page-break]').count(),1);
      await page.waitForTimeout(600); saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('megadoc-v2')));assert.equal(saved.tabs[saved.activeTabId].pageView,'pageless');
      await editor.evaluate(el=>{el.innerHTML='<p><img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22100%22%3E%3C/svg%3E" width="200" height="100"></p>';el.dispatchEvent(new Event('input',{bubbles:true}));});
      const img=editor.locator('img'); await img.evaluate(el=>el.decode()); await img.click(); assert.equal(await page.locator('#imageControls').isVisible(),true);
      const original=await img.boundingBox(), controls=await page.locator('#imageControls').boundingBox(); assert.ok(Math.abs(original.x-controls.x)<2 && Math.abs(original.width-controls.width)<2,JSON.stringify({original,controls}));
      await page.locator('#imageResize').focus(); await page.keyboard.press('ArrowRight'); const larger=await img.boundingBox(); assert.ok(larger.width>original.width+3,JSON.stringify({original,larger})); await page.locator('[data-cmd=undo]').click(); const undone=await img.boundingBox(); assert.ok(Math.abs(undone.width-original.width)<2);
      assert.deepEqual(errors,[]);await page.close(); console.log(`${mobile?'Mobile':'Desktop'} pageless persistence, zoom, tabs, break, print, icons and badge passed`);
    }
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
