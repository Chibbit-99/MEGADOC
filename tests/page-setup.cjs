const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
  const p=await browser.newPage({viewport:{width:1800,height:1000}}), errors=[];
  p.on('pageerror',e=>errors.push(e.stack));
  try{
    await p.goto(process.env.MEGADOC_URL||'http://localhost:8000');
    await p.locator('#emptyNewTab').click(); await p.locator('.tab-rename').press('Enter');
    await p.locator('#menubar .menu-item').filter({hasText:'File'}).click();
    await p.locator('#menuDropdown .mi').filter({hasText:'Page setup'}).click();
    await p.locator('#paperSize').selectOption('a4'); await p.locator('#pageOrientation').selectOption('landscape'); await p.locator('#mOk').click();
    const wrap=p.locator('#pageWrap'), rect=await wrap.boundingBox();
    assert.ok(Math.abs(rect.width-1122.5)<2, 'A4 landscape width');
    assert.match(await p.locator('#printPageSetup').textContent(), /size: A4 landscape/);
    await p.waitForTimeout(500); await p.reload();
    assert.match(await p.locator('#printPageSetup').textContent(), /size: A4 landscape/);
    assert.ok(Math.abs((await wrap.boundingBox()).width-1122.5)<2);
    const pdf = await p.pdf({preferCSSPageSize:true});
    const media = /\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf.toString('latin1'));
    assert.ok(media && Math.abs(+media[1] - 842) < 3 && Math.abs(+media[2] - 595) < 3, 'PDF uses A4 landscape');
    const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('megadoc-v2')));
    assert.equal(saved.pageSetup.paper,'a4'); assert.equal(saved.pageSetup.orientation,'landscape');
    await p.locator('#zoomBtn').click(); await p.locator('#zoomMenu [data-zoom="125"]').click();
    assert.ok(Math.abs((await wrap.boundingBox()).width-1122.5*1.25)<2);
    await p.setViewportSize({width:390,height:844});
    assert.ok((await wrap.boundingBox()).width<490, 'mobile respects viewport with zoom');
    assert.deepEqual(errors,[]); console.log('Page setup persistence, geometry and zoom passed');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
