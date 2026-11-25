// If you keep your rules in private/Rules.js (a separate private repo),
// copies them to src/Rules.js, where clasp deploys them from.
const fs = require('node:fs');
const path = require('node:path');

const from = path.join(__dirname, '..', 'private', 'Rules.js');
const to = path.join(__dirname, '..', 'src', 'Rules.js');
if (fs.existsSync(from)) {
  fs.writeFileSync(to, '// GENERATED from private/Rules.js by `npm run push`. Edit that file instead.\n' +
    fs.readFileSync(from, 'utf8'));
  console.log('Rules: private/Rules.js -> src/Rules.js');
} else if (!fs.existsSync(to)) {
  console.error('No rules found. Create them with: cp rules.example.js src/Rules.js');
  process.exit(1);
}
