// Loads your private src/Rules.js, or the example rules if you don't have one.
const fs = require('node:fs');
const path = require('node:path');

const mine = path.join(__dirname, '..', 'src', 'Rules.js');
const file = fs.existsSync(mine) ? mine : path.join(__dirname, '..', 'rules.example.js');
module.exports = { RULES: require(file).RULES, rulesFile: file };
