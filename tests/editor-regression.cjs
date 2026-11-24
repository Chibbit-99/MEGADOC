// Run against a local MegaDoc server. See README for the optional browser setup.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(process.env.MEGADOC_URL || 'http://localhost:8000');
    await page.locator('#emptyNewTab').click();
    await page.locator('.tab-rename').fill('First');
    await page.locator('.tab-rename').press('Enter');
    let first = page.locator('.tab-row').first();
    await first.hover();
    await first.locator('.tab-add').click();
    await page.locator('.tab-rename').fill('Second');
    await page.locator('.tab-rename').press('Enter');
    await first.locator('.tab-title').dblclick();
    assert.equal(await page.locator('.tab-rename').isVisible(), true);
    await page.locator('.tab-rename').press('Enter');
    first = page.locator('.tab-row').first();
    await first.hover();
    await first.locator('.tab-dots').click();
    await page.locator('[data-a=icon]').click();
    await page.locator('#tabEmojiInput').fill('👩🏽‍🚀');
    await page.locator('#tabEmojiApply').click();
    assert.equal(await first.locator('.tab-emoji').innerText(), '👩🏽‍🚀');
    await page.waitForTimeout(500);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('megadoc-v2')));
    assert.equal(saved.roots.length, 2);
    assert.equal(saved.tabs[saved.roots[0]].children.length, 0);
    assert.equal(saved.tabs[saved.roots[0]].tabEmoji, '👩🏽‍🚀');

    const editor = page.locator('#page');
    await editor.click();
    await page.locator('[data-cmd=bold]').click();
    await page.locator('[data-cmd=italic]').click();
    assert.equal(await page.locator('[data-cmd=bold]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-cmd=italic]').getAttribute('aria-pressed'), 'true');
    await page.keyboard.type('hello');
    await page.keyboard.press('ArrowLeft');
    await page.locator('[data-cmd=clear]').click();
    await page.keyboard.type('X');
    assert.equal(await page.locator('[data-cmd=bold]').getAttribute('aria-pressed'), 'false');
    assert.equal(await editor.evaluate(el => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) if (node.data.includes('X')) {
        const style = getComputedStyle(node.parentElement);
        return Number(style.fontWeight) < 600 && style.fontStyle === 'normal';
      }
      return false;
    }), true);
    assert.equal((await editor.innerHTML()).includes('\u200b'), false);

    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']) {
      await editor.evaluate((el, tag) => {
        el.innerHTML = `<${tag}>hello</${tag}>`;
        el.focus();
        const range = document.createRange();
        range.setStart(el.firstChild.firstChild, 2); range.collapse(true);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      }, tag);
      await page.keyboard.press('Enter');
      await page.keyboard.type('X');
      assert.match(await editor.innerHTML(), /<p>Xllo<\/p>/);
    }
    await editor.evaluate(el => {
      el.innerHTML = '<h2>hello</h2>'; el.focus();
      const range = document.createRange(); range.selectNodeContents(el.firstChild); range.collapse(false);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    });
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('X');
    assert.match(await editor.innerHTML(), /^<h2>hello<br>X<\/h2>/);

    await editor.evaluate(el => {
      el.innerHTML = '<p>Color me</p>'; el.focus();
      const range = document.createRange(); range.selectNodeContents(el.firstChild);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await page.locator('#colorBtn').click();
    assert.ok(await page.locator('#colorMenu .swatch').count() >= 60);
    await page.locator('#colorMenu .custom-color-hex').fill('#19ABCD');
    await page.locator('#colorMenu .custom-color-apply').click();
    assert.match(await editor.innerHTML(), /#19abcd/i);

    await editor.evaluate(el => {
      el.innerHTML = '<p><img width="200" height="100" alt="test" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22100%22%3E%3C/svg%3E"></p>';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const img = editor.locator('img');
    await img.evaluate(el => el.decode());
    await img.click();
    const before = await img.boundingBox();
    await page.locator('#imageResize').focus();
    await page.keyboard.press('ArrowRight');
    const after = await img.boundingBox();
    assert.ok(after.width >= before.width + 4);
    assert.ok(Math.abs(after.width / after.height - 2) < 0.05);
    await page.locator('#imageDelete').click();
    assert.equal(await editor.locator('img').count(), 0);
    await page.locator('[data-cmd=undo]').click();
    assert.equal(await editor.locator('img').count(), 1);
    assert.deepEqual(errors, []);
    console.log('Editor regressions passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
