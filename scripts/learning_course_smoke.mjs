import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'tmp/learning-course'); fs.mkdirSync(out, { recursive: true });
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webm':'video/webm', '.vtt':'text/vtt' };
const server = http.createServer((req,res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = origin + '/demos/assessment-evidence/index.html';
const browser = await chromium.launch({ headless:true });
const checks = [];
try {
  for (const width of [1440, 552, 390, 320]) {
    const context = await browser.newContext({ viewport:{width,height:900} });
    const page = await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    for (const id of ['start','compare','missing','decide','brief']) {
      await page.goto(url+'#'+id); await page.locator('#'+id).waitFor({state:'visible'});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), `${width}/${id} overflows`);
      const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      assert.deepEqual(a11y.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${width}/${id} accessibility`);
      await page.screenshot({path:path.join(out,`${width}-${id}.png`),fullPage:true});
      checks.push({width,module:id,automatedAccessibility:'passed',overflow:false});
    }
    assert.deepEqual(errors,[]); await context.close();
  }
  const context=await browser.newContext({viewport:{width:1100,height:850},acceptDownloads:true});
  const page=await context.newPage(); await page.goto(url);
  await page.locator('aside a[href="#compare"]').focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.activeElement.id==='compare-title');
  await page.locator('[data-check="compare"] button').click();
  assert.match(await page.locator('[data-check="compare"] .feedback').innerText(),/Choose a response/);
  await page.locator('input[value="same"]').check(); await page.locator('[data-check="compare"] button').click();
  assert.match(await page.locator('[data-check="compare"] .feedback').innerText(),/Equal means/);
  for (const [id,answer] of [['compare','spread'],['missing','denominator'],['decide','targeted']]) {
    await page.locator(`aside a[href="#${id}"]`).click();
    await page.locator(`input[value="${answer}"]`).check(); await page.locator(`[data-check="${id}"] button`).click();
  }
  assert.equal(await page.locator('#meter').evaluate(el=>el.value),3);
  await page.reload(); assert.equal(await page.locator('#meter').evaluate(el=>el.value),3);
  await page.locator('aside a[href="#brief"]').click();
  await page.locator('#reflection').fill('6/8 correct; 2/10 missing. One item cannot establish mastery. Check the sign error and access separately; collect a fresh item and explanation.');
  await page.locator('[data-rubric="evidence"]').check();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);
  await download.saveAs(path.join(out,'learner-brief.txt'));
  assert.match(fs.readFileSync(path.join(out,'learner-brief.txt'),'utf8'),/6\/8 correct/);
  await page.locator('#model-toggle').click(); assert.equal(await page.locator('#model').isVisible(),true);
  await page.emulateMedia({media:'print'}); assert.equal(await page.locator('.lesson:visible').count(),5); await page.emulateMedia({media:'screen'});
  await page.locator('#reset').click(); await page.getByRole('button',{name:'Keep my work'}).click(); assert.equal(await page.locator('#meter').evaluate(el=>el.value),3);
  await page.locator('#reset').click(); await page.locator('#confirm-reset').click(); await page.waitForFunction(()=>document.querySelector('#meter').value===0);
  await page.reload(); assert.equal(await page.locator('#reflection').inputValue(),'');
  await context.close();
  const blocked=await browser.newContext(); await blocked.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('blocked');};Storage.prototype.getItem=()=>{throw new Error('blocked');};});
  const fallback=await blocked.newPage(); await fallback.goto(url+'#compare'); await fallback.locator('input[value="spread"]').check(); await fallback.locator('[data-check="compare"] button').click(); assert.equal(await fallback.locator('#meter').evaluate(el=>el.value),1); assert.match(await fallback.locator('#save-status').innerText(),/unavailable/); await blocked.close();
  const nojs=await browser.newContext({javaScriptEnabled:false}); const plain=await nojs.newPage(); await plain.goto(url); assert.equal(await plain.locator('.lesson:visible').count(),5); assert(await plain.locator('.answer-guide').isVisible()); await nojs.close();
  if (process.env.RECORD_COURSE === '1') {
    const recording=await browser.newContext({viewport:{width:1100,height:800},recordVideo:{dir:out,size:{width:1100,height:800}}});
    const start=Date.now(), page=await recording.newPage(), captions=[];
    async function step(text, action, hold=4500) { const from=(Date.now()-start)/1000; await action(); await page.waitForTimeout(hold); captions.push({from,to:(Date.now()-start)/1000,text}); }
    await step('A new web-course demonstration for teachers. This is not Canvas.',()=>page.goto(url));
    await step('Module 1 pairs a score-distribution graphic with the full data table.',()=>page.locator('aside a[href="#compare"]').click());
    await step('Each option receives explanatory feedback. Incorrect reasoning can be revised.',async()=>{await page.locator('input[value="same"]').check();await page.locator('[data-check="compare"] button').click();});
    await step('Module 2 distinguishes accuracy among respondents from missing evidence.',()=>page.locator('aside a[href="#missing"]').click());
    await step('Module 3 connects tentative interpretation to a targeted action and fresh check.',()=>page.locator('aside a[href="#decide"]').click());
    await step('The final decision brief uses a transparent self-review rubric, not AI scoring.',()=>page.locator('aside a[href="#brief"]').click());
    await step('Learners can compare a model response, download their brief, or print the packet.',()=>page.locator('#model-toggle').click());
    const video=page.video(); await recording.close();
    const target=path.join(root,'demos/assessment-evidence'); await video.saveAs(path.join(target,'walkthrough.webm'));
    const stamp=n=>new Date(Math.round(n*1000)).toISOString().slice(11,23);
    fs.writeFileSync(path.join(target,'walkthrough.vtt'),'WEBVTT\n\n'+captions.map((c,i)=>`${i+1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${c.text}\n`).join('\n'));
    fs.writeFileSync(path.join(target,'walkthrough-transcript.txt'),'Silent web-course walkthrough. Descriptive captions; no spoken narration.\n\n'+captions.map(c=>`${stamp(c.from)}: ${c.text}`).join('\n')+'\n');
  }
  for (const width of [1440,390]) {
    const ctx=await browser.newContext({viewport:{width,height:900}}), p=await ctx.newPage();
    await p.goto(origin+'/projects/instructional-design.html');
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Case study overflow');
    const audit=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v=>v.id),[],'Case study accessibility');
    await p.screenshot({path:path.join(out,`case-${width}.png`),fullPage:true});
    const video=p.locator('video'); await video.scrollIntoViewIfNeeded();
    await video.evaluate(v=>{v.load();});
    await p.waitForFunction(()=>document.querySelector('video').readyState>=2);
    await video.evaluate(v=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=12;}));
    await p.waitForFunction(()=>document.querySelector('video').textTracks[0].cues?.length===7);
    await video.screenshot({path:path.join(out,`walkthrough-${width}.png`)});
    await ctx.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,caseStudyViews:2,captionCues:7,keyboard:true,feedback:true,progress:true,reload:true,reset:true,download:true,print:true,noJavaScript:true,blockedStorage:true,manualScreenReader:false},null,2)+'\n');
  console.log('Learning course: 20 layout/accessibility views plus keyboard, feedback, persistence, reset, download, print, no-JS and blocked-storage checks passed.');
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
