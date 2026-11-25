// Optional browser regression test; see README for the Chromium setup.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22100%22%3E%3C/svg%3E';
const image = `<img src="${src}" width="200" height="100" alt="original" data-custom="kept">`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack));
  const editor = page.locator('#page');
  const img = () => editor.locator('img').first();
  const width = async () => (await img().boundingBox()).width;
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1.5, `${message}: ${actual} vs ${expected}`);
  const setup = async html => {
    await page.goto(process.env.MEGADOC_URL || 'http://localhost:8000');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('#emptyNewTab').click();
    await page.locator('.tab-rename').press('Enter');
    await editor.evaluate((el, html) => { el.innerHTML = html; el.dispatchEvent(new Event('input', { bubbles: true })); }, html);
    await img().evaluate(el => el.decode());
  };
  const drag = async dx => {
    await img().click();
    const handle = await page.locator('#imageResize').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + dx, handle.y + handle.height / 2, { steps: 8 });
    await page.mouse.up();
  };
  const align = async direction => {
    await page.locator('#alignBtn').scrollIntoViewIfNeeded();
    await page.locator('#alignBtn').click();
    await page.locator(`#alignMenu [data-align="justify${direction}"]`).click();
  };
  try {
    await setup(`<p>before <a href="https://example.com"><strong>${image}</strong> link text</a> after</p>`);
    await drag(70);
    near(await width(), 270, 'drag width');
    assert.equal(await img().getAttribute('data-custom'), 'kept');
    assert.equal(await editor.locator('a strong img').count(), 1, 'inline wrappers retained');
    assert.match(await editor.innerText(), /before.*link text.*after/);
    await page.locator('[data-cmd=undo]').click();
    near(await width(), 200, 'one undo restores drag');
    assert.equal(await editor.locator('a strong img').count(), 1);
    await page.locator('[data-cmd=redo]').click();
    near(await width(), 270, 'redo restores drag');
    await img().click();
    await page.locator('#imageResize').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    near(await width(), 280, 'keyboard increments');
    await page.keyboard.press('Control+z');
    near(await width(), 275, 'keyboard undo');
    await page.locator('[data-cmd=undo]').click();
    near(await width(), 270, 'second keyboard undo');
    await page.locator('[data-cmd=redo]').click();
    near(await width(), 275, 'keyboard redo');
    await page.waitForTimeout(500);
    await page.reload();
    await img().evaluate(el => el.decode());
    near(await width(), 275, 'resized image survives reload');
    assert.equal(await editor.locator('a strong img').count(), 1);

    await setup(`<p>Some text ${image} more text</p>`);
    await img().click();
    const original = await img().boundingBox();
    await align('Center');
    const center = await img().boundingBox();
    assert.ok(center.x > original.x + 100, `center should move image: ${original.x} -> ${center.x}`);
    assert.equal(await editor.locator('p').evaluate(el => getComputedStyle(el).textAlign), 'center');
    assert.equal(await page.locator('#imageControls').isVisible(), true);
    await align('Right');
    const right = await img().boundingBox();
    assert.ok(right.x > center.x + 100, 'right alignment moves image');
    await align('Left');
    near((await img().boundingBox()).x, original.x, 'left alignment');
    await page.locator('[data-cmd=undo]').click();
    near((await img().boundingBox()).x, right.x, 'undo alignment');
    await page.locator('[data-cmd=redo]').click();
    near((await img().boundingBox()).x, original.x, 'redo alignment');

    // Text selection also aligns an inline image in the same paragraph.
    await editor.evaluate(el => {
      const r = document.createRange(); r.selectNodeContents(el.firstChild);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await align('Center');
    assert.ok((await img().boundingBox()).x > original.x + 100, 'text selection aligns image');
    await page.waitForTimeout(500);
    await page.reload();
    await img().evaluate(el => el.decode());
    assert.ok((await img().boundingBox()).x > original.x + 100, 'alignment survives reload');
    // Imported block images should follow alignment as well as inline images.
    await setup(`<p>${image.replace('<img ', '<img style="display:block" ')}</p>`);
    await img().click();
    const blockLeft = (await img().boundingBox()).x;
    await align('Center');
    const blockCenter = (await img().boundingBox()).x;
    assert.ok(blockCenter > blockLeft + 100, 'block image centers');
    await align('Right');
    assert.ok((await img().boundingBox()).x > blockCenter + 100, 'block image right-aligns');
    await page.locator('[data-cmd=undo]').click();
    near((await img().boundingBox()).x, blockCenter, 'block alignment undo');
    await page.waitForTimeout(500); await page.reload(); await img().evaluate(el => el.decode());
    near((await img().boundingBox()).x, blockCenter, 'block alignment persists');

    // A no-op or cancelled drag must not create an undo entry or persist a preview.
    await setup(`<p>${image}</p>`);
    await drag(0);
    near(await width(), 200, 'no-op drag');
    await img().click();
    let handle = await page.locator('#imageResize').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 70, handle.y + handle.height / 2, { steps: 3 });
    near(await width(), 270, 'drag preview');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    near(await width(), 200, 'cancelled drag restores original');
    await page.waitForTimeout(500);
    await page.reload(); await img().evaluate(el => el.decode());
    near(await width(), 200, 'cancelled drag does not persist');

    // Switching tabs during a preview restores the original before saving.
    await page.locator('.tab-row').first().hover();
    await page.locator('.tab-row').first().locator('.tab-add').click();
    await page.locator('.tab-rename').fill('Other'); await page.locator('.tab-rename').press('Enter');
    await page.locator('.tab-row').first().click(); await img().evaluate(el => el.decode());
    await img().click(); handle = await page.locator('#imageResize').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 + 50, handle.y + handle.height / 2);
    await page.locator('.tab-row').nth(1).evaluate(el => el.click());
    await page.mouse.up(); await page.locator('.tab-row').first().click();
    await img().evaluate(el => el.decode()); near(await width(), 200, 'tab switch cancels preview');
    await page.waitForTimeout(500); await page.reload(); await img().evaluate(el => el.decode());
    near(await width(), 200, 'tab switch does not persist preview');

    // Zoomed dragging uses document coordinates, including inside table cells.
    await setup(`<table><tbody><tr><td>${image}</td><td>keep</td></tr></tbody></table>`);
    await page.locator('#zoomBtn').click();
    await page.locator('#zoomMenu [data-zoom="150"]').click();
    await drag(60);
    near(await width(), 360, 'zoom drag changes width by 60 screen pixels');
    assert.equal(await editor.locator('td').count(), 2);
    await page.locator('[data-cmd=undo]').click();
    near(await width(), 300, 'zoom undo');
    await page.locator('[data-cmd=redo]').click();
    near(await width(), 360, 'zoom redo');
    await img().click(); await align('Center');
    assert.equal(await img().evaluate(el => getComputedStyle(el.closest('td')).textAlign), 'center');
    assert.equal(await editor.locator('td').count(), 2);

    // Resizing the second image must not change the first image or its wrapper.
    await setup(`<p>${image}<a href="https://example.com">${image}</a></p>`);
    const second = editor.locator('img').nth(1);
    await second.evaluate(el => el.decode()); await second.click();
    handle = await page.locator('#imageResize').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 + 45, handle.y + handle.height / 2); await page.mouse.up();
    near(await width(), 200, 'first image unchanged');
    near((await second.boundingBox()).width, 245, 'second image resized');
    assert.equal(await editor.locator('a img').count(), 1);
    await page.locator('[data-cmd=undo]').click();
    near((await second.boundingBox()).width, 200, 'second image undone');
    // Resizing participates in the same native history as ordinary typing and insertion.
    await page.goto(process.env.MEGADOC_URL || 'http://localhost:8000');
    await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.locator('#emptyNewTab').click(); await page.locator('.tab-rename').press('Enter');
    await editor.click(); await page.keyboard.type('hello');
    await page.locator('[data-cmd=image]').click();
    await page.locator('#imgFile').setInputFiles({ name: 'image.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"></svg>') });
    await page.locator('#mOk').click(); await img().evaluate(el => el.decode());
    await img().click(); await page.locator('#imageResize').focus(); await page.keyboard.press('ArrowRight');
    await page.locator('[data-cmd=undo]').click(); assert.equal(await img().count(), 1);
    await page.locator('[data-cmd=undo]').click(); assert.equal(await img().count(), 0);
    await page.locator('[data-cmd=undo]').click(); assert.ok(!(await editor.innerText()).includes('hello'));
    await page.locator('[data-cmd=redo]').click(); await page.locator('[data-cmd=redo]').click(); await page.locator('[data-cmd=redo]').click();
    assert.equal(await img().evaluate(el => el.style.width), '205px');
    assert.deepEqual(errors, []);
    console.log('Image resize undo/redo and alignment checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
