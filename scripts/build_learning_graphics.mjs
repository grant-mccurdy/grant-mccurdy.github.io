import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(import.meta.dirname, '../demos/assessment-evidence');
fs.mkdirSync(out, { recursive: true });
const wrap = (w, h, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img"><title>${title}</title><rect width="${w}" height="${h}" fill="#fff"/><g font-family="Arial,sans-serif" fill="#24332f">${body}</g></svg>\n`;
const stages = ['Compare the pattern', 'Check missing evidence', 'Choose a response'];
fs.writeFileSync(path.join(out, 'evidence-path.svg'), wrap(960, 280, 'From assessment evidence to action', stages.map((text, i) => {
  const x = 24 + i * 312;
  return `<rect x="${x}" y="30" width="288" height="220" rx="6" fill="${['#e0eee7','#fff0ce','#e8edf5'][i]}"/><text x="${x + 22}" y="80" font-size="32">0${i+1}</text><text x="${x + 22}" y="136" font-size="21">${text}</text><text x="${x + 22}" y="182" font-size="16">${['Distribution, not just a mean','Observed versus unknown','Target, then check again'][i]}</text>`;
}).join('')));
const scores = [[5,5,6,6,6,6,7,7], [2,3,4,5,7,8,9,10]];
let plot = '<text x="28" y="32" font-size="20">Same mean. Different distributions.</text>';
scores.forEach((values, row) => {
  const baseline = 154 + row * 170, color = row ? '#80561a' : '#185c51';
  plot += `<text x="28" y="${baseline-30}" font-size="21">Class ${row?'B':'A'}</text><line x1="170" x2="890" y1="${baseline}" y2="${baseline}" stroke="#697b71"/><line x1="602" x2="602" y1="${baseline-100}" y2="${baseline}" stroke="#52635c" stroke-dasharray="4 4"/>`;
  const counts = new Map();
  for (const value of values) { const n = counts.get(value) || 0; counts.set(value,n+1); plot += `<circle cx="${170+value*72}" cy="${baseline-15-n*22}" r="8" fill="${color}"/>`; }
  for (let i=0;i<=10;i++) plot += `<text x="${170+i*72}" y="${baseline+26}" text-anchor="middle" font-size="15">${i}</text>`;
});
plot += '<text x="530" y="386" text-anchor="middle" font-size="16">Score out of 10 | One dot per student | Dashed line: mean = 6</text>';
fs.writeFileSync(path.join(out,'distributions.svg'),wrap(960,400,'Class A and Class B score distributions',plot));
console.log('Built two editable original SVG teaching graphics.');
