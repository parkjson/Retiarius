// Loads your rules: private/Rules.js, else src/Rules.js, else the example.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const file = [
  path.join(root, 'private', 'Rules.js'),
  path.join(root, 'src', 'Rules.js'),
  path.join(root, 'rules.example.js'),
].find((f) => fs.existsSync(f));
module.exports = { RULES: require(file).RULES, rulesFile: file };
