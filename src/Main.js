/**
 * Entry point for the time trigger. Works per message (not per thread),
 * because Gmail can group alerts with the same subject into one thread.
 *
 *   nothing excluded   -> label kept, leave in inbox
 *   some excluded      -> trimmed copy into inbox, original to Trash
 *   everything excluded-> original to Trash
 *   no listings found  -> label unparsed, leave alone
 *
 * Every dropped listing is written to the "Retiarius log" sheet.
 * With CONFIG.dryRun only labels and the log are written.
 */
function run() {
  var L = ensureLabels_(CONFIG.labels);
  var logRows = [];
  var counts = { kept: 0, trimmed: 0, filtered: 0, unparsed: 0 };

  // In dry run, also look in Trash so alerts your old Gmail filters already
  // trashed get checked too.
  listMessages_(CONFIG.query, CONFIG.dryRun).forEach(function (ref) {
    var msg = GmailApp.getMessageById(ref.id);
    var subject = msg.getSubject();
    var search = searchName(subject);
    var html = msg.getBody();
    var listings = parseListings(html);
    var add = [L.processed];
    var trash = false;
    var verdict;

    if (listings.length === 0) {
      verdict = 'unparsed';
      add.push(L.unparsed);
    } else {
      var split = splitListings(listings, search, RULES);
      if (split.excluded.length === 0) {
        verdict = 'kept';
        add.push(L.kept);
      } else if (split.kept.length === 0) {
        verdict = 'filtered';
        add.push(L.filtered);
        trash = true;
      } else {
        verdict = 'trimmed';
        add.push(L.trimmed);
        trash = true;
        if (!CONFIG.dryRun) {
          var ids = split.excluded.map(function (i) { return i.id; });
          insertTrimmedCopy_(msg, subject,
            addRemovedNote_(removeListings(html, ids), split.excluded),
            split.kept.length, [L.processed, L.kept]);
        }
      }
      var action = verdict + (CONFIG.dryRun ? ' (dry run)' : '');
      // One log row per rule hit, so you can filter the sheet by rule.
      split.excluded.forEach(function (i) {
        i.hits.forEach(function (h) {
          logRows.push([msg.getDate(), search, h.rule, h.keyword, i.title, i.total,
            i.url, action]);
        });
      });
      if (CONFIG.logKept) {
        split.kept.forEach(function (i) {
          logRows.push([msg.getDate(), search, '(kept)', '', i.title, i.total,
            i.url, action]);
        });
      }
    }

    Gmail.Users.Messages.modify({ addLabelIds: add }, 'me', ref.id);
    if (trash && !CONFIG.dryRun) Gmail.Users.Messages.trash('me', ref.id);
    counts[verdict.split(' ')[0]]++;
    console.log(subject + ' -> ' + verdict);
  });

  if (logRows.length) appendLog_(logRows);
  console.log('Done: ' + JSON.stringify(counts) + (CONFIG.dryRun ? ' (dry run)' : ''));
  if (logRows.length) logSheetUrl();
}

/** All message ids matching `q` (paged), optionally including Trash/Spam. */
function listMessages_(q, includeTrash) {
  var out = [];
  var pageToken;
  do {
    var res = Gmail.Users.Messages.list('me', {
      q: q, maxResults: 100, pageToken: pageToken, includeSpamTrash: !!includeTrash,
    });
    out = out.concat(res.messages || []);
    pageToken = res.nextPageToken;
  } while (pageToken && out.length < 500);
  return out;
}

/**
 * Removes every retiarius/* label so the next run re-checks those emails,
 * e.g. after changing rules during the dry run. Doesn't touch the log or
 * restore anything from Trash.
 */
function resetLabels() {
  var L = ensureLabels_(CONFIG.labels);
  var ids = Object.keys(L).map(function (k) { return L[k]; });
  var msgs = listMessages_('label:' + CONFIG.labels.processed, true);
  msgs.forEach(function (m) {
    Gmail.Users.Messages.modify({ removeLabelIds: ids }, 'me', m.id);
  });
  console.log('Cleared labels on ' + msgs.length + ' emails.');
}

/** Adds a "Retiarius removed:" list under the remaining listings. */
function addRemovedNote_(html, excluded) {
  var items = excluded.map(function (i) {
    return '<li><b>' + esc_(i.term) + '</b>: <a href="' + esc_(i.url) + '">' +
      esc_(i.title) + '</a>' + (i.total != null ? ' ($' + i.total + ')' : '') + '</li>';
  }).join('');
  var note = '<div style="font-family:Arial;font-size:12px;color:#666;' +
    'border:1px dashed #ccc;padding:6px;margin:8px 0">Retiarius removed ' +
    excluded.length + ':<ul style="margin:4px 0">' + items + '</ul></div>';
  return html.indexOf('<!--alert_end-->') !== -1
    ? html.replace('<!--alert_end-->', '<!--alert_end-->' + note)
    : html + note;
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Puts a copy of the alert, minus the excluded listings, straight into the
 * inbox. messages.insert doesn't send mail, so no daily sending quota.
 */
function insertTrimmedCopy_(msg, subject, html, keptCount, labelIds) {
  var mime = [
    'From: ' + msg.getFrom(),
    'To: ' + msg.getTo(),
    'Subject: ' + encodeHeader_(retitle(subject, keptCount)),
    'Date: ' + msg.getDate().toUTCString(),
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Utilities.base64Encode(html, Utilities.Charset.UTF_8),
  ].join('\r\n');
  Gmail.Users.Messages.insert({
    raw: Utilities.base64EncodeWebSafe(mime, Utilities.Charset.UTF_8),
    labelIds: ['INBOX', 'UNREAD'].concat(labelIds),
  }, 'me');
}

function encodeHeader_(s) {
  return /^[\x20-\x7e]*$/.test(s)
    ? s : '=?UTF-8?B?' + Utilities.base64Encode(s, Utilities.Charset.UTF_8) + '?=';
}

/** Appends rows to the log sheet, creating it in Drive on first use. */
function appendLog_(rows) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('LOG_SHEET_ID');
  var ss;
  try { ss = id && SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  if (!ss) {
    ss = SpreadsheetApp.create('Retiarius log');
    ss.getSheets()[0].appendRow(['Received', 'Search', 'Rule', 'Keyword', 'Title', 'Total', 'Link', 'Action'])
      .setFrozenRows(1);
    props.setProperty('LOG_SHEET_ID', ss.getId());
    console.log('Created log sheet: ' + ss.getUrl());
  }
  var sh = ss.getSheets()[0];
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/** Prints the log sheet's URL. */
function logSheetUrl() {
  var id = PropertiesService.getScriptProperties().getProperty('LOG_SHEET_ID');
  console.log(id ? SpreadsheetApp.openById(id).getUrl() : 'No log yet: nothing dropped so far.');
}

/** Creates any missing labels and returns {key: labelId}. */
function ensureLabels_(names) {
  var existing = {};
  (Gmail.Users.Labels.list('me').labels || []).forEach(function (l) {
    existing[l.name] = l.id;
  });
  var ids = {};
  Object.keys(names).forEach(function (key) {
    ids[key] = existing[names[key]] ||
      Gmail.Users.Labels.create({ name: names[key] }, 'me').id;
  });
  return ids;
}

/**
 * Run once by hand to start the schedule (CONFIG.triggerMinutes). Running it
 * again replaces the old schedule, so it's safe to rerun after a change.
 */
function installTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('run').timeBased().everyMinutes(CONFIG.triggerMinutes).create();
  console.log('run() now runs every ' + CONFIG.triggerMinutes + ' min.');
}

/** Stops the schedule. */
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'run') ScriptApp.deleteTrigger(t);
  });
}
