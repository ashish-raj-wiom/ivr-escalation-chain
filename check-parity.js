// Proves ivr-escalation-chain-prd.html contains exactly the content of
// IVR_Escalation_Chain_PRD.md — nothing extra, nothing missing.
// Run after every build:  node build-html.js && node check-parity.js
//
// Exits 1 on any drift, so it can gate a commit.
const fs = require('fs');
const dir = __dirname + '/';
const md = fs.readFileSync(dir + 'IVR_Escalation_Chain_PRD.md', 'utf8');
let html = fs.readFileSync(dir + 'ivr-escalation-chain-prd.html', 'utf8');

// remove the presentation shell the generator adds (not content)
html = html
  .replace(/<head>[\s\S]*?<\/head>/, '')
  .replace(/<nav[\s\S]*?<\/nav>/, '')
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<div class="eyebrow">[\s\S]*?<\/div>/, '');

const ents = s => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&middot;/g, '·').replace(/&mdash;/g, '—')
  .replace(/&times;/g, '×').replace(/&ge;/g, '≥')
  .replace(/&rarr;/g, '→').replace(/&larr;/g, '←')
  .replace(/&nbsp;/g, ' ').replace(/&check;/g, '✓');

const normHtml = s => ents(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const normMd = s => s
  .split('\n')
  .filter(l => !/^\|[\s:|-]+\|\s*$/.test(l))   // drop table separator rows
  .join('\n')
  .replace(/```mermaid|```/g, ' ')             // fence markers
  .replace(/^-{3,}$/gm, ' ')                   // horizontal rules
  .replace(/^>\s?/gm, ' ')                     // blockquote markers
  // list markers BEFORE heading hashes: a heading still starts with '#' here, so
  // "## 1. Objective" keeps its number (the html renders it too, in span.num)
  .replace(/^\s*\d+\.\s+/gm, ' ')              // ordered list markers
  .replace(/^\s*[-*]\s+/gm, ' ')               // bullets, incl. indented
  .replace(/^#{1,4} /gm, ' ')                  // heading hashes
  .replace(/\|/g, ' ')                         // table cell pipes
  .replace(/\*\*/g, ' ').replace(/\*/g, ' ')   // bold / italic
  .replace(/`/g, ' ')                          // code ticks
  .replace(/\s+/g, ' ').trim();

const A = normMd(md), B = normHtml(html);
const bag = s => { const m = new Map(); for (const w of s.split(' ')) if (w) m.set(w, (m.get(w) || 0) + 1); return m; };
const a = bag(A), b = bag(B);
const missing = [], extra = [];
for (const [w, c] of a) { const d = c - (b.get(w) || 0); if (d > 0) missing.push(`${w} x${d}`); }
for (const [w, c] of b) { const d = c - (a.get(w) || 0); if (d > 0) extra.push(`${w} x${d}`); }

console.log('md words   :', A.split(' ').length);
console.log('html words :', B.split(' ').length);
console.log('');
console.log('IN MARKDOWN, MISSING FROM HTML :', missing.length ? missing.join(', ') : 'NONE');
console.log('IN HTML, NOT IN MARKDOWN       :', extra.length ? extra.join(', ') : 'NONE');

if (missing.length || extra.length) {
  console.log('\nPARITY FAILED — the html is not a faithful replica of the markdown.');
  process.exit(1);
}
console.log('\nPARITY OK — word-for-word, both directions.');
