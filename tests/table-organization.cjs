// Optional Chromium regressions for table row/column organization.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.stack));
  try {
    await p.goto(process.env.MEGADOC_URL || 'http://localhost:8000');
    await p.locator('#emptyNewTab').click(); await p.locator('.tab-rename').press('Enter');
    const editor = p.locator('#page');
    await editor.evaluate(el => {
      el.innerHTML = '<p>before</p><table data-test="keep"><thead><tr><th>Names</th><th>Values</th></tr></thead><tbody><tr data-id="b"><td>Banana</td><td><b>2</b></td></tr><tr data-id="a"><td>Apple</td><td><a href="https://example.com">10</a></td></tr><tr data-id="c"><td>Cherry</td><td>1</td></tr></tbody></table><p>after</p>';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const rows = () => editor.locator('tbody tr');
    const ids = async () => rows().evaluateAll(nodes => nodes.map(n => n.dataset.id));
    const action = async (row, col, name) => {
      await rows().nth(row).locator('td').nth(col).click({ button:'right' });
      await p.locator(`[data-editor-action="${name}"]`).click();
    };
    await action(1, 0, 'row-up'); assert.deepEqual(await ids(), ['a','b','c']);
    await p.locator('[data-cmd=undo]').click(); assert.deepEqual(await ids(), ['b','a','c']);
    await p.locator('[data-cmd=redo]').click(); assert.deepEqual(await ids(), ['a','b','c']);
    await action(0, 0, 'row-down'); assert.deepEqual(await ids(), ['b','a','c']);
    await action(0, 0, 'col-right');
    assert.equal(await editor.locator('thead th').first().innerText(), 'Values');
    assert.equal(await rows().first().locator('td').first().innerText(), '2');
    assert.equal(await editor.locator('a').getAttribute('href'), 'https://example.com');
    await action(0, 1, 'col-left');
    assert.equal(await editor.locator('thead th').first().innerText(), 'Names');
    await action(0, 0, 'sort-ascending'); assert.deepEqual(await ids(), ['a','b','c']);
    await action(0, 0, 'sort-descending'); assert.deepEqual(await ids(), ['c','b','a']);
    await action(0, 1, 'sort-ascending'); assert.deepEqual(await ids(), ['c','b','a']);
    await p.locator('[data-cmd=undo]').click(); assert.deepEqual(await ids(), ['c','b','a']);
    await p.waitForTimeout(500); await p.reload(); assert.deepEqual(await ids(), ['c','b','a']);
    assert.equal(await editor.locator('table').getAttribute('data-test'), 'keep');
    assert.equal(await editor.locator('thead th').first().innerText(), 'Names');
    assert.match(await editor.innerText(), /before[\s\S]*after/);
    // Unsupported column groups and merged cells are left untouched.
    await editor.evaluate(el => { el.innerHTML='<table><colgroup><col><col></colgroup><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';el.dispatchEvent(new Event('input',{bubbles:true})); });
    const table = editor.locator('table'); const original = await table.evaluate(el => el.outerHTML);
    await action(0, 0, 'col-right'); assert.equal(await table.evaluate(el => el.outerHTML), original);
    await editor.evaluate(el => { el.innerHTML='<table><tbody><tr><td colspan="2">merged</td></tr><tr><td>a</td><td>b</td></tr></tbody></table>';el.dispatchEvent(new Event('input',{bubbles:true})); });
    const merged = await table.evaluate(el=>el.outerHTML);
    await action(1, 0, 'sort-ascending'); assert.equal(await table.evaluate(el=>el.outerHTML), merged);
    assert.deepEqual(errors, []); console.log('Table organization checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
