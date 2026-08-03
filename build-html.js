// Renders IVR_Escalation_Chain_PRD.md -> ivr-escalation-chain-prd.html
//
// The markdown is canon. This script adds presentation only: the org change-spec
// CSS/skeleton (style.css, verbatim from p2-installation-items/CHANGE-SPEC-TEMPLATE.html),
// a TOC built from the markdown's own headings, and mermaid init. It adds NO content
// of its own and drops none — every block in the markdown becomes exactly one block here.
//
// Run: node build-html.js && node check-parity.js
//
// Derived from decline-retrigger-spec/build-html.js with four corrections:
//   1. code-span placeholder uses private-use sentinels, not " N " (a standalone
//      digit elsewhere in the same string used to restore as "undefined")
//   2. ordered lists (1. 2. 3.) render as <ol>, not as loose paragraphs
//   3. indented bullets nest inside their parent <li>
//   4. blockquotes render as <blockquote>, not as a paragraph starting with ">"

const fs = require('fs');

const MD = 'IVR_Escalation_Chain_PRD.md';
const OUT = 'ivr-escalation-chain-prd.html';
const CSS = fs.readFileSync('style.css', 'utf8');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const S0 = '', S1 = ''; // sentinels no document text can contain

// inline: protect code spans, escape, then bold/italic, then restore code
function inline(s) {
  const code = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { code.push(c); return `${S0}${code.length - 1}${S1}`; });
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(new RegExp(`${S0}(\\d+)${S1}`, 'g'), (_, i) => `<code>${esc(code[+i])}</code>`);
  return s;
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

const LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

// Consumes a run of list lines and returns nested <ul>/<ol>. Indentation nests.
function renderList(lines, start) {
  let i = start;
  const baseIndent = lines[i].match(LIST_RE)[1].length;
  const ordered = /^\d+\./.test(lines[i].match(LIST_RE)[2]);
  const items = [];
  while (i < lines.length) {
    const m = lines[i].match(LIST_RE);
    if (!m) break;
    const indent = m[1].length;
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      const [nested, next] = renderList(lines, i);
      items[items.length - 1] += nested;
      i = next;
      continue;
    }
    items.push(`<li>${inline(m[3])}`);
    i++;
  }
  const tag = ordered ? 'ol' : 'ul';
  return [`<${tag}>${items.map(it => it + '</li>').join('')}</${tag}>`, i];
}

const lines = fs.readFileSync(MD, 'utf8').replace(/\r\n/g, '\n').split('\n');
const out = [];
const toc = [];
let i = 0, title = null, inSection = false, headerTableDone = false;

const closeSection = () => { if (inSection) { out.push('</section>'); inSection = false; } };

while (i < lines.length) {
  const line = lines[i];

  // fenced code (mermaid or plain)
  if (/^```/.test(line)) {
    const lang = line.slice(3).trim();
    const buf = [];
    i++;
    while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
    i++;
    out.push(lang === 'mermaid'
      ? `<pre class="mermaid">\n${esc(buf.join('\n'))}\n</pre>`
      : `<pre><code>${esc(buf.join('\n'))}</code></pre>`);
    continue;
  }

  // headings
  const h = line.match(/^(#{1,4})\s+(.*)$/);
  if (h) {
    const level = h[1].length, text = h[2];
    if (level === 1) { title = text; i++; continue; }
    if (level === 2) {
      closeSection();
      const id = slug(text);
      const num = text.match(/^(\d+)\.\s*(.*)$/);
      toc.push({ level: 2, id, text });
      out.push(`<section class="spec" id="${id}">`);
      inSection = true;
      out.push(num
        ? `<h2><span class="num">${num[1]}.</span> ${inline(num[2])}</h2>`
        : `<h2>${inline(text)}</h2>`);
    } else {
      const id = slug(text);
      toc.push({ level: 3, id, text });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
    }
    i++; continue;
  }

  // table
  if (/^\|/.test(line)) {
    const rows = [];
    while (i < lines.length && /^\|/.test(lines[i])) {
      rows.push(lines[i].replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      i++;
    }
    const isSep = r => r.every(c => /^:?-{2,}:?$/.test(c));
    const sepAt = rows.findIndex(isSep);
    const head = sepAt > 0 ? rows.slice(0, sepAt) : [];
    const body = rows.filter((r, ix) => !isSep(r) && ix >= (sepAt > 0 ? sepAt : 0));
    // the document's first table is the PRD header block
    const headerBlock = !headerTableDone && !inSection;
    if (headerBlock) headerTableDone = true;
    const cls = headerBlock ? ' class="delta"' : '';
    let tbl = `<table${cls}>`;
    if (head.length && head.some(r => r.some(c => c !== ''))) {
      tbl += '<thead>' + head.map(r => '<tr>' + r.map(c => `<th>${inline(c)}</th>`).join('') + '</tr>').join('') + '</thead>';
    }
    tbl += '<tbody>' + body.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
    out.push(tbl);
    continue;
  }

  // blockquote
  if (/^>/.test(line)) {
    const buf = [];
    while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
    out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`);
    continue;
  }

  // list (ordered, unordered, nested)
  if (LIST_RE.test(line)) {
    const [html, next] = renderList(lines, i);
    out.push(html);
    i = next;
    continue;
  }

  // horizontal rule
  if (/^-{3,}$/.test(line)) { out.push('<hr class="sect-end">'); i++; continue; }

  // blank
  if (!line.trim()) { i++; continue; }

  // paragraph
  const para = [];
  while (i < lines.length && lines[i].trim()
         && !/^(\||#{1,4}\s|```|>|-{3,}$)/.test(lines[i])
         && !LIST_RE.test(lines[i])) para.push(lines[i++]);
  out.push(`<p>${inline(para.join(' '))}</p>`);
}
closeSection();

const tocHtml = toc.map(t =>
  t.level === 2
    ? `  <h2 class="what"><a href="#${t.id}">${esc(t.text)}</a></h2>`
    : `  <ol><li><a href="#${t.id}"><span class="ix"></span>${esc(t.text)}</a></li></ol>`
).join('\n');

const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · PRD</title>
<!--
  GENERATED FILE — do not edit by hand.
  Rendered from ${MD} by build-html.js. That markdown is the single source of
  truth; this page adds presentation only and contains no content the markdown
  does not have. To change the spec, edit the markdown and re-run:
      node build-html.js && node check-parity.js
-->
<style>
${CSS}
</style>
</head>
<body>
<div class="layout">

<nav class="toc" aria-label="Table of contents">
${tocHtml}
  <a class="back" href="./${MD}">&larr; Markdown source (canon)</a>
</nav>

<main>

<header class="doc">
  <div class="eyebrow">Wiom &middot; PRD &middot; Template v3</div>
  <h1>${inline(title)}</h1>
</header>

${out.join('\n')}

</main>
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose', flowchart: { curve: 'basis' } });
  }
</script>
</body>
</html>
`;

fs.writeFileSync(OUT, html);
console.log(`${OUT} written from ${MD} — ${toc.filter(t => t.level === 2).length} sections, ${(html.match(/<table/g) || []).length} tables, ${(html.match(/<ol>|<ul>/g) || []).length} lists`);
