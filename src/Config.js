var CONFIG = {
  // true = only add labels and write the log; never trash or trim.
  // Flip to false once the log looks right for a few days.
  dryRun: false,

  // How often installTrigger schedules `run`: 1, 5, 10, 15 or 30 minutes
  // (Google's only options). An idle run takes about a second, so 1 minute
  // stays well inside the free account's 90 min/day trigger runtime.
  triggerMinutes: 1,

  // Also log listings that are KEPT, so the sheet shows every listing and
  // its verdict. Set false to log only dropped listings.
  logKept: true,

  query: 'from:results@automatedsearches.com -label:retiarius/processed newer_than:1d',

  // Filter rules live in src/Rules.js (gitignored; see rules.example.js).

  labels: {
    processed: 'retiarius/processed', // looked at (also on trimmed copies)
    kept: 'retiarius/kept',           // nothing excluded; left as-is
    trimmed: 'retiarius/trimmed',     // some excluded; original trashed, trimmed copy in inbox
    filtered: 'retiarius/filtered',   // everything excluded; trashed
    unparsed: 'retiarius/unparsed',   // no listings found; left alone
  },
};

if (typeof module !== 'undefined') module.exports = { CONFIG };
