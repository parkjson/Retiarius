// Example rules. Copy to src/Rules.js (gitignored) and make them yours:
//   cp rules.example.js src/Rules.js
//
// Each rule drops a LISTING (not the whole alert email) when:
//   - `searches` (optional): the saved-search name, i.e. the subject before
//     " - N Search Results", contains one of these as a whole word
//   - `requires` (optional): the title contains one of these
//   - `any`: the listing TITLE contains one of these
//   - `unless` (optional): and neither the title nor the listing's
//     description (seller's condition notes) contains one of these
// Strings match whole words/phrases, ignoring case, plurals included, and a
// space also matches a hyphen ("button up" hits "Button-Up"). A RegExp is
// used as-is. Every rule that hits is logged with the text it matched.
var RULES = [
  {
    // Words that always mean "not interested"
    name: 'Unwanted items',
    any: ['necktie', 'tie', 'shorts', 'sleeveless', 'short sleeve'],
  },
  {
    // Exceptions: a linen blazer is fine, any other blazer isn't
    name: 'Jackets',
    any: ['blazer', 'sport coat', 'sportcoat'],
    unless: ['linen'],
  },
  {
    // Only for saved searches whose name contains "Shirts"
    name: 'Shirts: skip polos',
    searches: ['Shirts'],
    any: ['polo'],
  },
  {
    // Sizes via RegExp; `requires` limits it to pants listings so a jacket's
    // chest size isn't read as a waist
    name: 'Pants too big',
    requires: ['pants', 'trousers'],
    any: [/\b(?:3[8-9]|4\d)\s*[x×\/]\s*\d{2}\b/i, /\bW\s?(?:3[8-9]|4\d)\b/i],
  },
];

if (typeof module !== 'undefined') module.exports = { RULES };
