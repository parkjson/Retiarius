// Usage: npm run check -- <alert.eml> [more.eml ...]
// Shows which listings Retiarius would keep or drop, and which rule hit.
const fs = require('node:fs');
const path = require('node:path');
const P = require('../src/Parser.js');
const { RULES } = require('./rules.js');

const files = process.argv.slice(2);
if (!files.length) { console.error('Usage: npm run check -- <alert.eml> ...'); process.exit(1); }
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const subject = (raw.match(/^Subject: (.*)$/m) || [, path.basename(f)])[1];
  const search = P.searchName(subject);
  const { kept, excluded } = P.splitListings(P.parseListings(raw), search, RULES);
  console.log(`\n${subject}  [search: ${search}]`);
  if (!kept.length && !excluded.length) console.log('  (no listings found: would be left alone)');
  for (const i of kept) console.log(`  keep  $${i.total}  ${i.title}`);
  for (const i of excluded) {
    console.log(`  DROP  $${i.total}  ${i.title}`);
    for (const h of i.hits) console.log(`          ${h.rule}: "${h.keyword}"`);
    console.log(`          ${i.url}`);
  }
}
