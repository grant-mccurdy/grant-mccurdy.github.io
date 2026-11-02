import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'assets/images/previews');
const qa = path.resolve(process.env.QA_OUTPUT || '../../tmp/report-preview-refresh');
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml'};
const server = http.createServer((req, res) => {
  let file = path.join(root, new URL(req.url, 'http://localhost').pathname);
  if (file.endsWith('/')) file += 'index.html';
  try { res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const frames = [
  {view:'courses', mode:'violin', name:'report-courses.png'},
  {view:'comparisons', mode:'heatmap', name:'report-comparisons.png'},
  {view:'classes', mode:'box', name:'report-classes.png'},
  {view:'content', mode:'profile', name:'report-content.png'},
];
let browser;
try {
  fs.mkdirSync(qa, {recursive:true});
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440, height:1100}, deviceScaleFactor:2, reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(origin + '/demos/math-program-report/');
  await page.evaluate(() => document.fonts.ready);
  for (const frame of frames) {
    await page.locator('#tab-' + frame.view).click();
    await page.locator('#reset-view').click();
    await page.locator('#mode-chart').click();
    await page.locator('#choice-' + frame.mode).click();
    if (frame.view === 'classes') {
      await page.locator('#class-course').selectOption('Algebra I');
      await page.locator('#class-track').selectOption('all');
    }
    if (frame.view === 'comparisons') {
      await page.locator('#compare-row').selectOption({label:'Geometry H'});
      await page.locator('#compare-column').selectOption({label:'Geometry R'});
      assert.equal(await page.locator('.matrix-cell').count(), 45);
    }
    if (frame.view === 'courses') assert(await page.locator('.violin-shape polygon').count() > 0);
    if (frame.view === 'content') assert(await page.locator('.profile-point').count() > 0);
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bounds = await page.locator('#workspace').boundingBox();
    // Retain the existing carousel's figure framing, without page navigation.
    const clip = {x:bounds.x, y:bounds.y, width:bounds.width, height:720};
    const file = path.join(output, frame.name);
    await page.screenshot({path:file, clip, animations:'disabled'});
    frame.sha256 = digest(fs.readFileSync(file));
    frame.cssPixels = {width:clip.width, height:clip.height};
  }
  await page.close();
  for (const width of [1440, 390]) {
    const home = await browser.newPage({viewport:{width, height:900}, reducedMotion:'reduce'});
    home.on('pageerror', error => errors.push(error.message));
    await home.goto(origin + '/');
    const gallery = home.locator('[data-gallery="report"]');
    await gallery.scrollIntoViewIfNeeded();
    assert.equal(await gallery.getAttribute('data-paused'), 'true');
    for (let i = 0; i < frames.length; i++) {
      await home.waitForFunction(({name}) => {
        const image = document.querySelector('[data-gallery="report"] .project-preview img');
        return image.src.endsWith(name) && image.complete && image.naturalWidth > 0;
      }, {name:frames[i].name});
      await gallery.screenshot({path:path.join(qa, `carousel-${width}-${i + 1}.png`)});
      if (i < frames.length - 1) await gallery.getByRole('button', {name:'Next preview'}).click();
    }
    assert(await home.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await home.close();
  }
  assert.deepEqual(errors, []);
  const sourceHashes = Object.fromEntries(['index.html','workspace.js','workspace.css','reviewed-data.js','density-extension.js','portfolio-shell.css','report-guide.js','class-comparisons.js','class-comparisons.json'].map(name => [name, digest(fs.readFileSync(path.join(root, 'demos/math-program-report', name)))]));
  fs.writeFileSync(path.join(import.meta.dirname, 'report-preview-snapshots.json'), JSON.stringify({capturedAt:new Date().toISOString(), source:'demos/math-program-report/', deviceScaleFactor:2, sourceHashes, frames}, null, 2) + '\n');
  console.log('PASS: four current report snapshots; unchanged chart types and order; desktop/mobile carousel checks.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
