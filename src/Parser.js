/**
 * Parses AutomatedSearches.com alert emails (results@automatedsearches.com).
 *
 * Layout: listings sit between <!--alert_start--> and <!--alert_end-->.
 * Each listing begins with <tr><td> <!--dta:ITEMID-N--> and its title is
 * the <A id="title-link"> anchor. Listings are separated by <tr><td><hr>
 * rows, which lets us cut a single listing out of the email.
 */

// One listing: from its dta marker up to and including the next <hr> row.
var LISTING_BLOCK_RE =
  /<tr>\s*<td>\s*<!--dta:(\d+)-\d+-->[\s\S]*?<tr>\s*<td>\s*<hr[^>]*>\s*<\/td>\s*<\/tr>/gi;

var TITLE_RE = /<a\b[^>]*\bid\s*=\s*["']title-link["'][^>]*>([\s\S]*?)<\/a>/i;
var HREF_RE = /href\s*=\s*["']([^"']*)["']/i;
var PRICE_RE = /Total:(?:&nbsp;|\s)*\$([\d,.]+)/i;
// "Condition Description:", "Short Description:", "Item Description:" sections.
var DESC_RE = /(?:Condition|Short|Item)\s+Description:\s*<\/strong>([\s\S]*?)<\/(?:font|td)>/gi;
// Free-plan filler inside Short Description; not real listing text.
var UPSELL_RE = /To receive Item Quantity[\s\S]*?Premium\s*\.?/i;

function parseListings(html) {
  var out = [];
  var m;
  LISTING_BLOCK_RE.lastIndex = 0;
  while ((m = LISTING_BLOCK_RE.exec(html)) !== null) {
    var block = m[0];
    var t = block.match(TITLE_RE);
    var p = block.match(PRICE_RE);
    var h = t ? t[0].match(HREF_RE) : null;
    out.push({
      id: m[1],
      title: t ? cleanText_(t[1]) : '',
      url: h ? decodeEntities_(h[1]) : '',
      description: descriptionOf_(block),
      total: p ? parseFloat(p[1].replace(/,/g, '')) : null,
    });
  }
  return out;
}

function descriptionOf_(block) {
  var parts = [];
  var d;
  DESC_RE.lastIndex = 0;
  while ((d = DESC_RE.exec(block)) !== null) {
    var t = cleanText_(d[1]).replace(UPSELL_RE, '').trim();
    if (t) parts.push(t);
  }
  return parts.join(' ');
}

/** Returns the html with the given item ids' listing blocks removed. */
function removeListings(html, ids) {
  var drop = {};
  ids.forEach(function (id) { drop[id] = true; });
  return html.replace(LISTING_BLOCK_RE, function (block, id) {
    return drop[id] ? '' : block;
  });
}

/** "Example Search - 2 Search Results" -> "Example Search" */
function searchName(subject) {
  var m = (subject || '').match(/^(.*?)\s+-\s+\d+\s+Search Results?\s*$/i);
  return m ? m[1].trim() : (subject || '').trim();
}

/** Subject with the result count replaced, e.g. "... - 1 Search Results". */
function retitle(subject, count) {
  return subject.replace(/-\s+\d+\s+Search Results?/i,
    '- ' + count + ' Search Result' + (count === 1 ? '' : 's'));
}

/**
 * Rules (see Config.js):
 *   { name, searches?: [...], requires?: [...], any: [...], unless?: [...] }
 * `requires`: the title must also contain one of these for the rule to apply.
 * A listing is dropped by a rule when the search is in scope, its TITLE
 * hits any `any` term, and neither its title nor its description hits an
 * `unless` term. (`any` stays title-only so a seller writing "see my other
 * blazers" in the description doesn't drop an unrelated listing.)
 *
 * Terms: a string is a whole word/phrase, any case, plural allowed, and
 * spaces also match hyphens ("button up" hits "Button-Up"). A RegExp is
 * used as-is.
 */
function termRegex_(term, allowPlural) {
  if (term instanceof RegExp) return term;
  var body = term.trim().split(/\s+/).map(function (w) {
    return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('[\\s-]+');
  return new RegExp('\\b' + body + (allowPlural ? '(?:s|es)?' : '') + '\\b', 'i');
}

/** Returns the text a term list matched in `text`, or null. */
function firstHit_(text, terms, allowPlural) {
  for (var i = 0; i < (terms || []).length; i++) {
    var m = text.match(termRegex_(terms[i], allowPlural));
    if (m) return m[0];
  }
  return null;
}

/** True if the rule applies to this saved search. No `searches` = all. */
function ruleInScope_(rule, search) {
  return !rule.searches || !rule.searches.length ||
    firstHit_(search, rule.searches, false) !== null;
}

/**
 * Every rule that drops this listing: [{rule, keyword}] (empty = keep).
 * `description` is optional extra text checked for `unless` terms only.
 */
function matchRules(title, search, rules, description) {
  var hits = [];
  var all = title + ' ' + (description || '');
  rules.forEach(function (r) {
    if (!ruleInScope_(r, search)) return;
    if (r.requires && firstHit_(title, r.requires, true) === null) return;
    var kw = firstHit_(title, r.any, true);
    if (kw && firstHit_(all, r.unless, true) === null) {
      hits.push({ rule: r.name, keyword: kw });
    }
  });
  return hits;
}

/**
 * Splits listings into kept / excluded. Excluded ones get `hits` and a
 * readable `term` ("Tailoring: Blazer; Big sizes: 54 R"). Untitled = kept.
 */
function splitListings(listings, search, rules) {
  var kept = [];
  var excluded = [];
  listings.forEach(function (it) {
    var hits = it.title ? matchRules(it.title, search, rules, it.description) : [];
    if (!hits.length) { kept.push(it); return; }
    excluded.push(Object.assign({}, it, {
      hits: hits,
      term: hits.map(function (h) { return h.rule + ': ' + h.keyword; }).join('; '),
    }));
  });
  return { kept: kept, excluded: excluded };
}

function cleanText_(fragment) {
  return decodeEntities_(fragment.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities_(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
    .replace(/&amp;/g, '&');
}

if (typeof module !== 'undefined') {
  module.exports = {
    parseListings, removeListings, searchName, retitle,
    matchRules, splitListings,
  };
}
