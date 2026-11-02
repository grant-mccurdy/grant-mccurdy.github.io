import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const origin='https://logoseducation.group/sample-report/';
const output=path.join(root,'demos/math-program-report');
const source=path.join(root,'sources/logos-report');
const files=['index.html','workspace.css','workspace.js','reviewed-data.js','density-extension.js'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const extensions='class-comparisons.js displays the existing 14 planned class comparisons. See class-comparisons.json for published evidence provenance; no new inferential tests. report-guide.js adds portfolio-only Overview and Priorities editorial tabs without modifying canonical analysis.';
function shell(html){
 const replace=(from,to)=>{assert.equal(html.split(from).length,2,`Upstream shell changed: ${from}`);html=html.replace(from,to);};
 replace('<title>Sample Mathematics Report | Logos Education Group</title>','<title>Mathematics Program Evaluation | Grant McCurdy</title>');
 replace('<p class="eyebrow">Math Program Evaluation</p><h1>Mathematics, in focus.</h1>','<h1>Mathematics Program Evaluation</h1>');
 replace('Explore how assessment results can inform curriculum alignment, student support, and instructional priorities.','Schoolwide mathematics assessment results, with comparisons across courses, Honors and Regular tracks, classes, and mathematics domains.');
 replace('<a href="/" aria-label="Logos Education Group home">Logos<span>Education Group</span></a>','<a href="../../index.html" aria-label="Grant McCurdy portfolio home">Grant McCurdy<span>Portfolio / Logos report</span></a>');
 // Historical Logos fragment redirects belong to the original supporting report.
 html=html.replace(/<script src="legacy-links\.js[^\"]*"><\/script>/,'');
 assert(!html.includes('legacy-links.js'));
 html=html.replaceAll('href="supporting-evidence/"',`href="${origin}supporting-evidence/"`);
 replace('</header>','</header><nav class="portfolio-report-nav" aria-label="Portfolio report navigation"><a href="../../projects/assessment-intelligence.html">Case study</a><a href="https://logoseducation.group/sample-report/">Original report at Logos</a></nav>');
 replace('</head>','<link rel="stylesheet" href="portfolio-shell.css"></head>');
 replace('<p class="assessment-preview-link"><a href="https://logoseducation.group/sample-report/supporting-evidence/">Supporting report, evidence &amp; methods <span aria-hidden="true">↗</span></a></p>','');
 replace('<footer class="foot"><span>Fictional records. Real questions.</span><span>Illustrative example using synthetic data, not results from a client school.</span></footer>','<footer class="foot"><span>Development assessment &middot; Independent review and pilot pending</span></footer>');
 replace('</body>','<script src="class-comparisons.js?v=1"></script><script src="report-guide.js?v=1"></script></body>');
 return html;
}
if(process.argv.includes('--rebuild-shell')){
 const manifest=JSON.parse(fs.readFileSync(path.join(output,'source-manifest.json')));
 const html=shell(fs.readFileSync(path.join(source,'index.html'),'utf8'));
 fs.writeFileSync(path.join(output,'index.html'),html);
 manifest.files['index.html'].mirrorSha256=hash(html);
 manifest.presentationExtension=extensions;
 fs.writeFileSync(path.join(output,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}else if(process.argv.includes('--check')){
 const manifest=JSON.parse(fs.readFileSync(path.join(output,'source-manifest.json')));
 for(const file of files){const upstream=fs.readFileSync(path.join(source,file));assert.equal(hash(upstream),manifest.files[file].sourceSha256);const local=fs.readFileSync(path.join(output,file));assert.equal(hash(local),manifest.files[file].mirrorSha256);assert.equal(local.toString(),file==='index.html'?shell(upstream.toString()):upstream.toString());}
 console.log('PASS: canonical snapshot hashes; analytical code/data unchanged; shell reproducible.');
}else{
 // Download all inputs before replacing the snapshot; no private checkout is used.
 const inputs={};
 for(const file of files){const r=await fetch(new URL(file,origin));assert(r.ok,`${file}: HTTP ${r.status}`);inputs[file]=Buffer.from(await r.arrayBuffer());}
 const html=shell(inputs['index.html'].toString());
 fs.mkdirSync(output,{recursive:true});fs.mkdirSync(source,{recursive:true});
 const manifest={sourceUrl:origin,retrievedAt:new Date().toISOString(),policy:'Versioned public Logos snapshot. Analytical JavaScript, CSS, and data are byte-identical. Only index.html navigation/title and a separate portfolio shell stylesheet are adapted. Supporting evidence remains at Logos.',files:{}};
 manifest.presentationExtension=extensions;
 for(const file of files){const b=inputs[file],out=file==='index.html'?Buffer.from(html):b;fs.writeFileSync(path.join(source,file),b);fs.writeFileSync(path.join(output,file),out);manifest.files[file]={sourceSha256:hash(b),mirrorSha256:hash(out)};}
 fs.writeFileSync(path.join(output,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Snapshot imported from public Logos report. Run --check and browser tests before deploying.');
}
