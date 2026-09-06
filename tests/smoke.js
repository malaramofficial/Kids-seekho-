const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  if (!(await page.title()).toLowerCase().includes('kids seekho')) {
    throw new Error('Unexpected page title');
  }

  await page.getByText('English', { exact: true }).click();
  await page.waitForTimeout(300);

  const letter = (await page.locator('#letter').textContent() || '').trim();
  if (!letter) throw new Error('English lesson did not open');

  const canvas = page.locator('#traceCanvas');
  if (!(await canvas.isVisible())) throw new Error('Trace canvas is not visible');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Could not measure trace canvas');

  await page.mouse.move(box.x + box.width * 0.30, box.y + box.height * 0.30);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.70, box.y + box.height * 0.70, { steps: 8 });
  await page.mouse.up();

  const check = page.getByText(/Check|जाँच/i).first();
  if (await check.count()) await check.click();
  if (errors.length) throw new Error(`Browser page errors: ${errors.join(' | ')}`);

  console.log(`Browser smoke test OK: first English item = ${letter}`);
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
