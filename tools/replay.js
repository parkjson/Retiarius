// Usage: npm run replay -- "<Retiarius log>.csv"
// Re-checks every listing in a downloaded log sheet against the current
// rules (titles only: the sheet has no descriptions) and lists what changed.
const fs = require('node:fs');
const P = require('../src/Parser.js');
const { RULES } = require('./rules.js');

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const rows = parseCsv(fs.readFileSync(process.argv[2], 'utf8'));
const listings = new Map();
for (const r of rows) {
  const l = listings.get(r.Link) || { search: r.Search, title: r.Title, wasKept: true };
  if (r.Rule !== '(kept)') l.wasKept = false;
  listings.set(r.Link, l);
}
const nowKept = []; const nowDropped = [];
let kept = 0;
for (const l of listings.values()) {
  const hits = P.matchRules(l.title, l.search, RULES);
  if (!hits.length) kept++;
  if (!hits.length && !l.wasKept) nowKept.push(l);
  if (hits.length && l.wasKept) nowDropped.push({ ...l, why: hits.map((h) => `${h.rule}: ${h.keyword}`).join('; ') });
}
console.log(`${listings.size} listings: ${kept} kept, ${listings.size - kept} dropped`);
console.log(`\nNow KEPT (were dropped): ${nowKept.length}`);
for (const l of nowKept) console.log(`  + [${l.search}] ${l.title}`);
console.log(`\nNow DROPPED (were kept): ${nowDropped.length}`);
for (const l of nowDropped) console.log(`  - [${l.search}] ${l.title}\n      ${l.why}`);
