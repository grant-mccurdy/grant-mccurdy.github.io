import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(process.env.QA_OUTPUT || '../../tmp/report-mirror');fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{let file=path.join(root,new URL(req.url,'http://localhost').pathname);if(file.endsWith('/'))file+='index.html';try{res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=process.env.REPORT_BASE_URL || `http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(origin+'/demos/math-program-report/');
  assert.equal(await page.locator('[role="tab"]').count(),6);
  assert.deepEqual(await page.locator('[role="tab"]').allTextContents(),['Priorities','Overview','Courses & Tracks','Classes','Comparisons','Math Domains']);
  assert.equal(await page.locator('#tab-priorities').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('.guide-strength').count(),0);
  assert.equal(await page.locator('.intro h1').innerText(),'Mathematics Program Evaluation');
  assert.equal(await page.locator('.intro .eyebrow').count(),0);
  assert.equal(await page.locator('.intro .subtitle').innerText(),'Schoolwide mathematics assessment results, with comparisons across courses, Honors and Regular tracks, classes, and mathematics domains.');
  assert.equal(await page.locator('#report-guide h2').innerText(),'Priorities for the mathematics program');
  assert.equal(await page.locator('main > p.assessment-preview-link a[href*="supporting-evidence"]').count(),0);
  assert.equal(await page.locator('#report-guide dl').count(),0);
  assert.equal(await page.locator('#report-guide .guide-evidence').count(),0);
  const recommendations=await page.locator('#report-guide .guide-findings > li > p').allTextContents();
  assert.match(recommendations[0],/46%.*77%.*31 percentage points/);
  assert.match(recommendations[1],/Both differences are statistically significant after adjustment across all 14 planned class comparisons/);
  assert.doesNotMatch(recommendations[2],/Small observed gaps do not establish equivalent performance/);
  assert.match(recommendations[0],/Geometry and Algebra II teams.*short follow-up task.*reassess/);
  assert.match(recommendations[1],/department lead and Geometry teachers.*one rubric/);
  assert.match(recommendations[2],/Course leads should compare Regular and Honors assignments and student work/);
  const significant=JSON.parse(fs.readFileSync(path.join(root,'demos/math-program-report/class-comparisons.json'),'utf8')).pairs.filter(p=>p.p_holm<0.05);
  assert.deepEqual(significant.map(p=>[p.a,p.b,p.course,p.track]),[['SEC-06','SEC-08','Geometry','Regular'],['SEC-07','SEC-08','Geometry','Regular']]);
  assert(significant.every(p=>Math.abs(p.difference)>14 && Math.abs(p.difference)<16));
  assert.equal(await page.locator('#report-guide .guide-findings > li > p').count(),3);
  assert.doesNotMatch(await page.locator('#report-guide').innerText(),/adjusted comparisons|\bQ\d+\b/);
  assert(await page.locator('#report-guide').isVisible());
  assert.equal(await page.locator('#workspace').isVisible(),false);
  const evidence=await page.evaluate(()=>{
   const rows=window.ADDITIONAL_DATA.domain_rows.filter(r=>r.course==='Algebra II');
   const pooled=domain=>{const rs=rows.filter(r=>r.domain===domain);return Math.round(100*rs.reduce((s,r)=>s+r.correct_responses,0)/rs.reduce((s,r)=>s+r.assigned_responses,0));};
   const gaps=window.TRIAL_DATA.courses.map(course=>{const groups=window.ADDITIONAL_DATA.course_groups.filter(g=>g.course===course);return groups.find(g=>g.track==='Honors/AP').mean-groups.find(g=>g.track==='Regular').mean;});
   const courseMean=course=>{const groups=window.ADDITIONAL_DATA.course_groups.filter(g=>g.course===course);return Math.round(groups.reduce((sum,g)=>sum+g.mean*g.n,0)/groups.reduce((sum,g)=>sum+g.n,0));};
   return {algebra:pooled('Algebra'),geometry:pooled('Geometry & trigonometry'),classMeans:window.TRIAL_DATA.classes.filter(c=>c.course==='Geometry'&&c.track==='Regular').map(c=>Math.round(c.mean)),gapRange:[Math.min(...gaps).toFixed(1),Math.max(...gaps).toFixed(1)],courseMeans:[courseMean('Algebra I'),courseMean('AP Calculus AB')],blueprint:window.REVIEWED_DATA.source_form.domain_item_counts};
  });
  assert.deepEqual(evidence,{algebra:77,geometry:46,classMeans:[52,52,67],gapRange:['-1.6','2.5'],courseMeans:[48,82],blueprint:{Algebra:10,'Advanced Math':10,'Problem-Solving/Data Analysis':5,'Geometry/Trigonometry':5}});
  await page.locator('#tab-overview').click();
  assert.doesNotMatch(await page.locator('#report-guide').innerText(),/This does not establish that the tracks perform equivalently/);
  assert.deepEqual(await page.locator('#report-guide .guide-findings h3').allTextContents(),await page.locator('#tab-courses, #tab-classes, #tab-comparisons, #tab-content').allTextContents());
  const patterns=await page.evaluate(()=>{
   const d=window.REVIEWED_DATA,groups=d.course_distributions.groups;
   const mean=course=>{const g=groups.filter(x=>x.course===course);return g.reduce((s,x)=>s+x.summary.mean*x.n,0)/g.reduce((s,x)=>s+x.n,0);};
   const domainMeans=d.course_distributions.course_order.slice(0,5).map(course=>d.content_accuracy.domains.map(domain=>{const rows=d.content_accuracy.cells.filter(r=>r.course===course&&r.domain_id===domain.id);return Math.round(100*rows.reduce((s,r)=>s+r.correct_responses,0)/rows.reduce((s,r)=>s+r.assigned_responses,0));}));
   return {means:['Algebra I','Geometry','Algebra II','Precalculus','AP Calculus AB'].map(mean),stats:Math.round(mean('AP Statistics')),domainMeans,tracks:groups.filter(g=>['Geometry','Precalculus'].includes(g.course)).map(g=>Math.round(g.summary.mean))};
  });
  assert(patterns.means.every((m,i,a)=>i===0||m>a[i-1]));
  assert.equal(patterns.stats,69);
  assert.deepEqual(patterns.domainMeans,[[58,43,44,39],[62,54,48,57],[77,65,54,46],[83,80,62,57],[90,85,77,62]]);
  assert.deepEqual(patterns.tracks,[57,55,73,76]);
  for(const domain of [0,1,2])assert(patterns.domainMeans.every((row,i,all)=>i===0||row[domain]>all[i-1][domain]));
  assert.deepEqual(await page.locator('#report-guide .guide-findings li').evaluateAll(items=>items.map(item=>item.querySelectorAll('p').length)),[3,3,3,3]);
  assert.doesNotMatch(await page.locator('#report-guide').innerText(),/25 to 28 percentage points/);
  assert.match(await page.locator('[aria-labelledby="report-scope-title"]').innerText(),/Scores represent the percentage of questions answered correctly/);
  assert.deepEqual(await page.locator('.guide-assessment h3').allTextContents(),['Scope and scoring','Assessment design and mapping']);
  const overall=await page.evaluate(()=>{
   const d=window.REVIEWED_DATA;
   return {cohort:d.cohort,mean:(d.course_distributions.groups.reduce((sum,g)=>sum+g.summary.mean*g.n,0)/d.cohort.students).toFixed(1),domains:d.content_accuracy.domains.map(domain=>{const rows=d.content_accuracy.cells.filter(r=>r.domain_id===domain.id);return Math.round(100*rows.reduce((s,r)=>s+r.correct_responses,0)/rows.reduce((s,r)=>s+r.assigned_responses,0));})};
  });
  assert.deepEqual(overall,{cohort:{students:500,classes:21,course_track_groups:10,class_view_students:440,class_view_classes:19},mean:'61.8',domains:[71,62,54,51]});
  assert.equal(await page.locator('.guide-assessment .guide-link').count(),0);
  assert.doesNotMatch(await page.locator('#report-guide').innerText(),/\bR[123]\b|class pairs/);
  assert.deepEqual((await page.locator('#report-guide [data-open-view]').allTextContents()).map(s=>s.replace(/\s*\u2192$/, '').trim()),['View Courses & Tracks','View Classes: Regular Geometry','View Comparisons','View Math Domains: Algebra II']);
  assert.match(await page.locator('[aria-labelledby="assessment-basis-title"]').innerText(),/30 original questions in 45 minutes/);
  assert.match(await page.locator('[aria-labelledby="assessment-basis-title"]').innerText(),/skill, prerequisite, and provisional course mappings/);
  assert.equal(await page.locator('#report-guide .guide-context').count(),0);
  assert.match(await page.locator('.preview-label').innerText(),/Fictional data/);
  assert.match(await page.locator('.foot').innerText(),/Independent review and pilot pending/);
  for(const guide of ['overview','priorities']){
   await page.locator('#tab-'+guide).click();
   assert.doesNotMatch(await page.locator('#report-guide').innerText(),/These profiles point to|This gives leaders a specific starting point|The wide distributions make a case|This warrants a department-led review|Focus the next program review on these findings/);
   assert.equal(await page.locator('#report-guide .guide-findings li').count(),guide==='overview'?4:3);
   assert.match(await page.locator('#report-guide').innerText(),/Within each of the four courses offering both tracks, Honors and Regular students' average assessment scores differ by no more than 2.5 percentage points on the same assessment/);
   assert((await page.locator('#report-guide').innerText()).split(/\s+/).length<(guide==='overview'?750:300));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(out,`${guide}-${width}.png`),fullPage:true});
   for(const view of (guide==='overview'?['courses','classes','comparisons','content']:['courses','classes','content'])){
    await page.locator('#tab-'+guide).click();
    await page.locator(`#report-guide [data-open-view="${view}"]`).click();
    assert.equal(await page.locator('#tab-'+view).getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('#report-guide').isVisible(),false);
    if(view==='classes'){assert.equal(await page.locator('#class-course').inputValue(),'Geometry');assert.equal(await page.locator('#class-track').inputValue(),'Regular');}
    if(view==='content'){assert.equal(await page.locator('#content-course').inputValue(),'Algebra II');assert.equal(await page.locator('#content-track').inputValue(),'all');}
    if(view==='courses')assert.equal(await page.locator('#course-track').inputValue(),'all');
   }
  }
  await page.locator('#tab-priorities').click();await page.locator('#tab-priorities').focus();
  await page.keyboard.press('End');assert.equal(await page.locator('#tab-content').getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-priorities').getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#tab-content').getAttribute('aria-selected'),'true');
  await page.keyboard.press('Home');assert.equal(await page.locator('#tab-priorities').getAttribute('aria-selected'),'true');
  await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-overview').getAttribute('aria-selected'),'true');
  await page.locator('#tab-classes').click();
  await page.locator('.within-pair').first().waitFor();
  for(const course of ['Algebra I','Geometry','Algebra II','Precalculus']){
   await page.locator('#class-course').selectOption(course);
   for(const track of ['all','Regular','Honors/AP']){
    await page.locator('#class-track').selectOption(track);
    const expected=track==='all'?(course==='Precalculus'?2:4):(track==='Regular'&&course!=='Precalculus'?3:1);
    await page.waitForFunction(n=>document.querySelectorAll('.within-pair').length===n,expected);
    assert.equal(await page.locator('.within-group').count(),track==='all'?2:1);
    const colors=await page.locator('.within-group').evaluateAll(groups=>groups.map(g=>({track:g.dataset.track,band:getComputedStyle(g.querySelector('.within-band')).backgroundColor,point:getComputedStyle(g.querySelector('.within-point')).backgroundColor})));
    for(const color of colors){const expected=color.track==='Regular'?'rgb(83, 136, 180)':'rgb(52, 125, 112)';assert.equal(color.band,expected);assert.equal(color.point,expected);}
    assert.match(await page.locator('.within-method').first().innerText(),/all 14/);
    const actual=await page.locator('.within-pair').allTextContents();
    assert.equal(actual.filter(t=>t.includes('Difference detected')).length,course==='Geometry'&&track!=='Honors/AP'?2:0);
   }
  }
  await page.locator('#class-course').selectOption('Geometry');await page.locator('#class-track').selectOption('all');
  await page.waitForFunction(()=>document.querySelectorAll('.within-pair').length===4);
  const before=await page.locator('.within-track').innerText();
  await page.locator('#tab-priorities').click();assert.equal(await page.locator('.within-track').isVisible(),false);
  await page.locator('#tab-classes').click();assert.equal(await page.locator('.within-track').innerText(),before);
  await page.locator('#mode-data').click();assert.equal(await page.locator('.within-track').innerText(),before);
  await page.locator('#mode-chart').click();await page.locator('#choice-violin').click();
  await page.screenshot({path:path.join(out,`within-track-${width}.png`),fullPage:true});
  await page.locator('#tab-courses').click();assert.equal(await page.locator('.within-track').isVisible(),false);
  for(const view of ['courses','classes','comparisons','content']){
   await page.locator('#tab-'+view).click();
   await page.locator('#reset-view').click();
   await page.locator('#mode-data').click();assert(await page.locator('#workspace tbody tr').count()>0);
   if(view==='comparisons')assert.equal(await page.locator('#workspace tbody tr').count(),45);
   await page.locator('#mode-chart').click();
   if(view==='courses'||view==='classes'){
    await page.locator('#choice-violin').click();assert(await page.locator('#workspace .violin-shape polygon').count()>0);
    await page.locator(view==='courses'?'#course-track':'#class-track').selectOption('Regular');
    const trigger=page.locator('[data-distribution]').first();await trigger.click();assert(await page.locator('#detail-dialog').evaluate(e=>e.open));
    await page.keyboard.press('Escape');assert.equal(await page.locator('#detail-dialog').evaluate(e=>e.open),false);
   }else if(view==='comparisons'){
    await page.locator('#choice-heatmap').click();assert.equal(await page.locator('.matrix-cell').count(),45);
    await page.locator('.matrix-cell').first().click();assert.equal(await page.locator('.matrix-cell[aria-pressed="true"]').count(),1);
    await page.locator('#choice-pair').click();await page.locator('#compare-row').selectOption({index:0});
   }else{
    // The canonical mobile profile has overlapping series targets; filter first.
    if(width<720)await page.locator('#content-track').selectOption('Regular');
    await page.locator('.profile-point').first().click();assert(await page.locator('#detail-dialog').evaluate(e=>e.open));await page.keyboard.press('Escape');
    await page.locator('#choice-bars').click();await page.locator('#content-course').selectOption('Geometry');
    assert(await page.locator('.bar-row').count()>0);
   }
   await page.locator('#reset-view').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${view}: document overflow at ${width}`);
   await page.screenshot({path:path.join(out,`${view}-${width}.png`),fullPage:true});
  }
  await page.locator('#tab-courses').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-classes').getAttribute('aria-selected'),'true');
  assert(requests.every(url=>url.startsWith(origin)), 'Report requires external network requests');assert.deepEqual(errors,[]);
  await page.locator('.portfolio-report-nav a').first().click();assert(page.url().endsWith('/projects/assessment-intelligence.html'));
  assert.equal(await page.locator('h1').innerText(),'Mathematics Program Evaluation');
  assert.match(await page.locator('.case-meta').innerText(),/Pacifica Christian High School/);
  assert.match(await page.locator('.case-meta').innerText(),/synthetic, not school records/);
  assert.equal(await page.title(),'Mathematics Program Evaluation | Grant McCurdy');
  await page.screenshot({path:path.join(out,`evaluation-case-${width}.png`),fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(origin+'/');
  const feature=page.locator('[data-home-project-id="assessment-intelligence"]');
  await feature.scrollIntoViewIfNeeded();
  assert.equal(await feature.locator('h2').innerText(),'Mathematics Program Evaluation');
  assert.match(await feature.locator('.project-heading').innerText(),/schoolwide mathematics program review/);
  assert.match(await feature.locator('.project-context').innerText(),/Pacifica Christian High School/);
  assert.match(await feature.locator('.project-context').innerText(),/500-student synthetic dataset, not school records/);
  await page.waitForFunction(()=>{const img=document.querySelector('[data-gallery="report"] img');return img.complete&&img.naturalWidth>0;});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await feature.screenshot({path:path.join(out,`evaluation-home-${width}.png`)});
  console.log(`PASS ${width}: four views, data tables, filters, violins, 45 comparisons, dialogs, reset, keyboard, navigation, no external requests or overflow`);
  await page.close();
 }
 const page=await browser.newPage({javaScriptEnabled:false});await page.goto(origin+'/demos/math-program-report/');assert(await page.locator('noscript a').isVisible());assert.equal(await page.locator('noscript a').getAttribute('href'),'https://logoseducation.group/sample-report/supporting-evidence/');await page.close();
 const failed=await browser.newPage();await failed.route('**/class-comparisons.json',r=>r.fulfill({status:503,body:'Unavailable'}));await failed.goto(origin+'/demos/math-program-report/');await failed.locator('#tab-classes').click();await failed.getByText('Reviewed class comparisons could not be loaded.').waitFor();assert(await failed.locator('[data-distribution]').count()>0);await failed.close();
 for(const view of ['overview','priorities','classes']){
  const linked=await browser.newPage();await linked.goto(origin+'/demos/math-program-report/#'+view);
  assert.equal(await linked.locator('#tab-'+view).getAttribute('aria-selected'),'true');await linked.close();
 }
 console.log('PASS no-JavaScript methods link and initial deep links');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
