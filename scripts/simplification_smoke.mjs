import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'tmp/simplification-20261028');
fs.mkdirSync(out, {recursive:true});
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server = http.createServer((req,res)=>{
  let file = path.resolve(root, '.'+new URL(req.url,'http://localhost').pathname);
  if (!file.startsWith(root+path.sep) && file !== root) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200,{'content-type':mime[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin = 'http://127.0.0.1:'+server.address().port;
const browser = await chromium.launch({headless:true});
const results = [];
try {
  for (const width of [1440,768,390,320]) {
    for (const route of ['index.html','demos/index.html','projects/index.html','about.html','projects/assessment-intelligence.html']) {
      const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await context.route('**/*',r=>new URL(r.request().url()).origin===origin ? r.continue() : r.fulfill({status:200,contentType:'application/json',body:'{}'}));
      const page = await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
      await page.goto(origin+'/'+route,{waitUntil:'networkidle'});
      await page.locator('img').evaluateAll(async imgs=>{for(const img of imgs){img.loading='eager';await img.decode();}});
      assert.deepEqual(await page.locator('[data-nav-links] a').allTextContents(),['Work','About','Contact']);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,route+' overflow '+width);
      assert.equal(await page.locator('h1').count(),1);
      assert.equal(await page.locator('[aria-current="page"]').count(),1,route+' active navigation');
      if(width<=960){
        await page.locator('[data-nav-toggle]').click();
        assert(await page.locator('[data-nav-links]').isVisible());
        await page.keyboard.press('Escape');
        assert(await page.locator('[data-nav-links]').isHidden());
      }
      const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(audit.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})),[],route+' accessibility '+width);
      assert.deepEqual(errors,[]);
      await page.locator('body').click({position:{x:2,y:2}});
      await page.screenshot({path:path.join(out,route.replaceAll('/','-')+'-'+width+'.png'),fullPage:true});
      results.push({route,width,pass:true});
      console.log('PASS '+route+' '+width);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');
