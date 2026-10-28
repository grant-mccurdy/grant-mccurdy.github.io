import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'tmp/walkthrough-20261028');
fs.mkdirSync(output, {recursive:true});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.gif':'image/gif','.png':'image/png','.jpg':'image/jpeg'};
const server = http.createServer((req,res)=>{
  let file = path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(file!==root&&!file.startsWith(root+path.sep))return res.writeHead(403).end();
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file))return res.writeHead(404).end();
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=process.env.LIVE_PORTFOLIO_URL || 'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try {
  for(const route of ['index.html','projects/logos-learning-systems.html']){
    for(const width of [1440,390,320]){
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.fulfill({status:200,contentType:'application/json',body:'{}'}));
      const page=await context.newPage();
      const errors=[], gifs=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(r.url().endsWith('.gif'))gifs.push(r.url());});
      await page.goto(origin+'/'+route,{waitUntil:'networkidle'});
      const container=page.locator('[data-walkthrough]');
      const image=container.locator('[data-walkthrough-image]');
      const button=container.locator('button');
      await container.scrollIntoViewIfNeeded();
      await image.evaluate(img=>img.decode());
      assert.equal(await container.getAttribute('data-playing'),'false');
      assert.equal(gifs.length,0,'Reduced motion must not load animation');
      const size=await container.boundingBox();
      await button.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(()=>document.querySelector('[data-walkthrough]').dataset.playing==='true');
      await image.evaluate(img=>img.decode());
      if(width===1440){
        const before=await image.screenshot();
        await page.waitForTimeout(4000);
        const after=await image.screenshot();
        assert(!before.equals(after),'Walkthrough must visibly animate');
      }
      await page.keyboard.press('Space');
      await image.evaluate(img=>img.decode());
      assert.equal(await container.getAttribute('data-playing'),'false');
      assert((await image.getAttribute('src')).endsWith('-poster.png'));
      const paused=await image.screenshot();
      await page.waitForTimeout(300);
      assert(paused.equals(await image.screenshot()),'Paused image must stay still');
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.reload({waitUntil:'networkidle'});
      await container.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelector('[data-walkthrough]').dataset.playing==='true');
      await image.evaluate(img=>img.decode());
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForFunction(()=>document.querySelector('[data-walkthrough]').dataset.playing==='false');
      await image.evaluate(img=>img.decode());
      assert(Math.abs((await container.boundingBox()).height-size.height)<1,'No layout shift');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      const audit=await new AxeBuilder({page}).include('[data-walkthrough]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(audit.violations.map(v=>v.id),[]);
      assert.deepEqual(errors,[]);
      await container.screenshot({path:path.join(output,route.replaceAll('/','-')+'-'+width+'.png')});
      await context.close();
      console.log('PASS '+route+' '+width+': motion, keyboard, pause, reduced motion, stable dimensions, accessibility');
    }
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
    const page=await context.newPage();
    await page.goto(origin+'/'+route);
    await page.locator('[data-walkthrough]').scrollIntoViewIfNeeded();
    await page.locator('[data-walkthrough-image]').evaluate(img=>img.decode());
    assert(await page.locator('[data-walkthrough-toggle]').isHidden());
    assert((await page.locator('[data-walkthrough-image]').getAttribute('src')).endsWith('-poster.png'));
    await context.close();
    console.log('PASS '+route+': no-JavaScript static fallback');
  }
} finally {
  await browser.close();
  await new Promise(r=>server.close(r));
}
