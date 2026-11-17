# Retiarius

Google Apps Script that filters individual listings inside batched
[AutomatedSearches.com](https://automatedsearches.com) eBay alert emails.

AutomatedSearches batches every new listing from a 15-minute window into one
email. A Gmail filter can only keep or trash the whole email, so excluding
`blazer` throws away every other listing that happened to arrive with one.
Retiarius checks each listing on its own and rebuilds the email with only
the listings you want.

| Alert contains | What happens |
|---|---|
| no excluded listings | label `retiarius/kept`, stays in inbox |
| some excluded | trimmed copy (with a "Retiarius removed" note) into inbox, original to Trash |
| only excluded | original to Trash, label `retiarius/filtered` |
| no listings found | label `retiarius/unparsed`, left alone |

Every listing is logged (search, rule, matched text, title, price, link) to a
**Retiarius log** Google Sheet in your Drive. Run `logSheetUrl` to find it.

## How it works

- **Finding listings:** each listing in an alert sits between a
  `<!--dta:ITEMID-->` marker and a divider row. The parser reads the title,
  price, link and the seller's condition notes from each block.
- **Trimming:** dropped listings' blocks are cut out of the HTML. Gmail
  doesn't allow editing a received email, so the trimmed version goes into
  the inbox with Gmail's `messages.insert`. That doesn't send mail, so the
  sending quota doesn't apply. The original goes to Trash.
- **Schedule:** a time trigger runs every 1–30 minutes (`triggerMinutes`).

## Setup

1. Install [clasp](https://github.com/google/clasp), turn on the Apps Script
   API at https://script.google.com/home/usersettings, then run `clasp login`.
2. Create the script: `clasp create --type standalone --title Retiarius --rootDir src`.
   If clasp overwrites `src/appsscript.json`, restore it with
   `git checkout src/appsscript.json`, because it enables the Gmail advanced service.
3. Make your rules: `cp rules.example.js src/Rules.js` and edit them. The
   file is gitignored and only goes to Apps Script.
4. Deploy with `npm run push`. In the Apps Script editor, run `run` once to
   grant access, then `installTrigger`. `removeTrigger` stops it.

Settings are in `src/Config.js`. With `dryRun: true` it only labels and logs,
so you can check the sheet before anything is trashed.

## Rules

```js
{ name, searches?: [...], requires?: [...], any: [...], unless?: [...] }
```

A rule drops a listing when its saved search is in scope, the title
contains an `any` term, and neither the title nor the condition notes
contain an `unless` term. Strings match whole words or phrases, ignoring
case, including plurals and hyphens. A RegExp is used as-is, e.g. for sizes.
See [`rules.example.js`](rules.example.js).

## Tools

- `npm test`: engine tests, plus your own tests in `test/private/` and real
  emails in `test/fixtures/` if present. Both folders are gitignored.
- `npm run check -- alert.eml`: shows which listings in a downloaded alert
  would be kept or dropped, and why.
- `npm run replay -- "Retiarius log - Sheet1.csv"`: re-checks a downloaded
  log against edited rules and lists every listing whose verdict changes.
