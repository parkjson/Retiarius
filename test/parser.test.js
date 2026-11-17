const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/Parser.js');

const block = (id, n, title, total) => `<tr><td> <!--dta:${id}-${n}--> <A id="title-link"
href="https://automatedsearches.com/g/?x" target="_blank"><strong> <font face="Arial" size="2">${title}</font></strong></A>
<br></td></tr> <tr><td><table><tr><td>Total:&nbsp;$${total}</td></tr></table></td></tr>
<tr><td><hr noshade align="left" width="100%" size="1"
color="#800000"></td></tr>`;

const email = (...blocks) => `<p>header</p><!--alert_start--> <table> <tr><td><hr noshade
size="1"></td></tr> ${blocks.join(' ')} </TABLE><!--alert_end--><p>footer</p>`;

const SAMPLE = email(
  block('111111111111', 1, 'Vintage Silk Necktie', '56.47'),
  block('222222222222', 2, 'Mens Oxford Dress Shirt', '106.95'),
);

test('parses id, title and total of each listing', () => {
  assert.deepStrictEqual(P.parseListings(SAMPLE), [
    { id: '111111111111', title: 'Vintage Silk Necktie', url: 'https://automatedsearches.com/g/?x', description: '', total: 56.47 },
    { id: '222222222222', title: 'Mens Oxford Dress Shirt', url: 'https://automatedsearches.com/g/?x', description: '', total: 106.95 },
  ]);
});

test('removeListings cuts only the excluded listing', () => {
  const out = P.removeListings(SAMPLE, ['111111111111']);
  assert.ok(!out.includes('Necktie'));
  assert.ok(out.includes('Dress Shirt'));
  assert.ok(out.includes('header') && out.includes('footer'));
  assert.deepStrictEqual(P.parseListings(out).map((i) => i.id), ['222222222222']);
});

// Generic rules for testing the engine. Your real rules live in src/Rules.js.
const R = [
  { name: 'Jackets', any: ['blazer', 'sport coat'], unless: ['linen'] },
  { name: 'Unwanted', any: ['necktie', 'button down'] },
  { name: 'Coats search', searches: ['Coats'], any: ['wool'] },
  { name: 'Big pants', requires: ['pants', 'trousers'], any: [/\b4\d\s*x\s*\d{2}\b/i] },
];
const drop = (title, search = 'Anything', desc) =>
  P.matchRules(title, search, R, desc).map((h) => `${h.rule}: ${h.keyword}`);

test('search name and retitle', () => {
  assert.strictEqual(P.searchName('Example Search - 2 Search Results'), 'Example Search');
  assert.strictEqual(P.retitle('Example Search - 2 Search Results', 1),
    'Example Search - 1 Search Result');
});

test('matching: whole words, any case, plurals, hyphens', () => {
  assert.deepStrictEqual(drop('Navy BLAZER'), ['Jackets: BLAZER']);
  assert.deepStrictEqual(drop('Lot of 3 Silk Neckties'), ['Unwanted: Neckties']);
  assert.deepStrictEqual(drop('Oxford Button-Down Shirt'), ['Unwanted: Button-Down']);
  assert.deepStrictEqual(drop('Blazermania tee'), []);
});

test('unless terms check title and description; any terms only the title', () => {
  assert.deepStrictEqual(drop('Linen Blazer'), []);
  assert.deepStrictEqual(drop('Cream Blazer', 'Anything', 'Fabric: 100% linen'), []);
  assert.deepStrictEqual(drop('Cashmere Overcoat', 'Anything', 'See my other blazers'), []);
});

test('searches and requires scope a rule', () => {
  assert.deepStrictEqual(drop('Wool Overcoat', 'Coats 2'), ['Coats search: Wool']);
  assert.deepStrictEqual(drop('Wool Overcoat', 'Sweaters'), []);
  assert.deepStrictEqual(drop('Wool Pants 42x30'), ['Big pants: 42x30']);
  assert.deepStrictEqual(drop('Wool Suit 42x30'), []);
});

test('every matching rule is reported', () => {
  const { excluded } = P.splitListings(
    [{ id: '1', title: 'Wool Blazer and Pants 44x32 with Necktie' }], 'Coats', R);
  assert.deepStrictEqual(excluded[0].hits.map((h) => h.rule),
    ['Jackets', 'Unwanted', 'Coats search', 'Big pants']);
  assert.strictEqual(excluded[0].term,
    'Jackets: Blazer; Unwanted: Necktie; Coats search: Wool; Big pants: 44x32');
});

test('example rules load and parse', () => {
  const { RULES } = require('../rules.example.js');
  assert.ok(Array.isArray(RULES) && RULES.length > 0);
  for (const r of RULES) assert.ok(r.name && r.any && r.any.length);
});

test('description comes from condition notes, minus the upgrade filler', () => {
  const html = email(block('333333333333', 1, 'Shirt', '10').replace('</table></td></tr>',
    `<tr><td><font color="green"><strong>Condition
Description:</strong> Pure Linen.</font><br><font face="Arial"><strong>Short Description:</strong>
<span>To receive Item Quantity, Item Description, and Item Specifics, <a href="x"><strong>Upgrade to
Business or Premium</strong></a>.</span></font></td></tr></table></td></tr>`));
  assert.strictEqual(P.parseListings(html)[0].description, 'Pure Linen.');
});

