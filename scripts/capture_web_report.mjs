import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Capture the published interactive report, never a rendered R Markdown figure.
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'assets/images/previews');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const response = await page.goto('https://logoseducation.group/sample-report/', { waitUntil: 'networkidle' });
  if (!response.ok()) throw new Error('Report unavailable: ' + response.status());
  await page.locator('#workspace .surface').first().waitFor();
  for (const view of ['courses', 'comparisons', 'classes', 'content']) {
    await page.locator('[data-view="' + view + '"]').click();
    if (view === 'courses') await page.getByRole('button', {name:'Violin', exact:true}).click();
    await page.waitForTimeout(300);
    await page.locator('#workspace').scrollIntoViewIfNeeded();
    const bounds = await page.locator('#workspace').boundingBox();
    await page.screenshot({ path: path.join(output, 'report-' + view + '.png'), clip: {...bounds, height: Math.min(bounds.height, 720)} });
    console.log(view + ': ' + await page.locator('#workspace h2').innerText());
  }
} finally {
  await browser.close();
}
