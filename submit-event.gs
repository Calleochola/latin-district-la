/**
 * Latin District LA — Event Submission Web App
 *
 * PURPOSE:
 *   Receives event submissions from the website and writes them directly
 *   to the live "Events" tab with active=FALSE and status=submitted.
 *   Events are visible on the website only after an admin sets active=TRUE
 *   and status=approved directly in the Events sheet.
 *   An email notification is sent to NOTIFY_EMAIL on every submission.
 *
 * HOW TO DEPLOY:
 *   1. Go to script.google.com → open this project
 *   2. Paste this entire file, replacing all existing code
 *   3. Click Save (floppy disk)
 *   4. Click Deploy → Manage deployments
 *   5. Click the pencil icon on the current deployment
 *   6. Change Version to "New version"
 *   7. Click Deploy
 *   The /exec URL stays the same — no Netlify env var change needed.
 *
 * FIRST-TIME DEPLOY (no existing deployment):
 *   4. Click Deploy → New deployment
 *   5. Type: Web app
 *   6. Description: Event Submission v4 — direct to Events
 *   7. Execute as: Me
 *   8. Who has access: Anyone
 *   9. Click Deploy → copy the /exec URL
 *  10. Paste into Netlify → Site settings → Environment variables as APPS_SCRIPT_URL
 *
 * APPROVAL WORKFLOW:
 *   New submissions land in the Events tab with active=FALSE, status=submitted.
 *   To publish:
 *     1. Open the Events tab in the Google Sheet
 *     2. Find the row (sorted to bottom — most recent submission is last)
 *     3. Set active   → TRUE
 *        Set status   → approved
 *     4. Event is immediately live on the website
 *
 * SHEET TAB USED:
 *   "Events" — live website data. New rows default to active=FALSE so they
 *   are invisible on the site until manually activated.
 *
 * EMAIL:
 *   Every accepted submission sends an email to NOTIFY_EMAIL with full details
 *   and a direct link to the sheet. Email failure is non-fatal — the row is
 *   still written even if Gmail fails.
 *
 * GmailApp PERMISSION:
 *   On the first execution after deploying a version that includes GmailApp,
 *   Google will prompt for Gmail authorization. Run testSubmission() from the
 *   script editor once to trigger and approve the auth dialog before the first
 *   real submission arrives.
 */

// ── Config ─────────────────────────────────────────────────────────────────────
const SPREADSHEET_ID = ''                       // blank = bound script (recommended)
const EVENTS_TAB_NAME = 'Events'
const NOTIFY_EMAIL    = 'latindistrictla@gmail.com'

// Events sheet column order — must match the website's expected schema exactly.
// New submissions are written in this exact column order via appendRow.
const EVENTS_HEADERS = [
  'event_name',      // A
  'venue',           // B
  'date',            // C — YYYY-MM-DD
  'time',            // D
  'genre',           // E — optional
  'event_type',      // F
  'ticket_link',     // G — optional
  'flyer_image_url', // H
  'featured',        // I — always FALSE on submission
  'active',          // J — always FALSE on submission; set TRUE to publish
  'tailgate_time',   // K — blank on submission
  'status',          // L — submitted on arrival; set approved to publish
  'venue_image_url', // M — blank on submission
  'video_url',       // N — blank on submission
  'crowd_level',     // O — blank on submission
  'description',     // P
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getSpreadsheet() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet()
}

function getEventsSheet() {
  const sheet = getSpreadsheet().getSheetByName(EVENTS_TAB_NAME)
  if (!sheet) throw new Error('Sheet not found: ' + EVENTS_TAB_NAME)
  return sheet
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

// ── doGet — health check ───────────────────────────────────────────────────────
// Visit the /exec URL in a browser — should return {"status":"ok",...}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status:  'ok',
      service: 'Latin District Event Submit',
      target:  EVENTS_TAB_NAME,
    }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ── doPost — receive submission and write directly to Events ───────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents)

    // Validate required fields.
    // genre and ticket_link are optional — excluded from this check.
    const required = ['event_name', 'venue', 'date', 'time', 'event_type', 'flyer_image_url', 'description']
    const missing  = required.filter(k => !data[k] || !String(data[k]).trim())
    if (missing.length) {
      return jsonResponse({ result: 'error', message: 'Missing required fields: ' + missing.join(', ') })
    }

    const sheet = getEventsSheet()

    // Write directly to Events in the exact column order the website reads.
    // Moderation defaults (active=FALSE, status=submitted) are enforced by the
    // Netlify function before this point and accepted here as-is.
    sheet.appendRow([
      String(data.event_name      || '').trim(),  // event_name
      String(data.venue           || '').trim(),  // venue
      String(data.date            || '').trim(),  // date
      String(data.time            || '').trim(),  // time
      String(data.genre           || '').trim(),  // genre      — may be blank
      String(data.event_type      || '').trim(),  // event_type
      String(data.ticket_link     || '').trim(),  // ticket_link — may be blank
      String(data.flyer_image_url || '').trim(),  // flyer_image_url
      'FALSE',                                    // featured   — admin sets TRUE if needed
      'FALSE',                                    // active     — admin sets TRUE to publish
      '',                                         // tailgate_time
      'submitted',                                // status     — admin sets approved to publish
      '',                                         // venue_image_url
      '',                                         // video_url
      '',                                         // crowd_level
      String(data.description     || '').trim(),  // description
    ])

    Logger.log('Submission written to Events: ' + data.event_name + ' @ ' + data.venue)

    // Send notification email — non-fatal: Gmail failure never blocks the write
    try {
      sendSubmissionEmail(data)
    } catch (emailErr) {
      Logger.log('Email notification failed (non-fatal): ' + emailErr.toString())
    }

    return jsonResponse({ result: 'success' })

  } catch (err) {
    Logger.log('doPost error: ' + err.toString())
    return jsonResponse({ result: 'error', message: err.toString() })
  }
}

// ── sendSubmissionEmail ────────────────────────────────────────────────────────
// Sends a notification email to NOTIFY_EMAIL on every successful submission.
// Non-fatal — wrapped in try/catch at the call site in doPost.

function sendSubmissionEmail(data) {
  const sheetId  = SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId()
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + sheetId

  const subject = '[Latin District LA] New submission: ' + data.event_name + ' @ ' + data.venue

  const body = [
    'A new event submission was received on Latin District LA.',
    'The row has been written to the Events tab with active=FALSE.',
    '',
    'To publish: open the sheet, find the row, set active=TRUE and status=approved.',
    '',
    'Event:       ' + (data.event_name  || '—'),
    'Venue:       ' + (data.venue       || '—'),
    'Date:        ' + (data.date        || '—'),
    'Time:        ' + (data.time        || '—'),
    'Type:        ' + (data.event_type  || '—'),
    'Genre:       ' + (data.genre       || '—'),
    'Ticket Link: ' + (data.ticket_link || '—'),
    'Flyer URL:   ' + (data.flyer_image_url || '—'),
    '',
    'Description:',
    (data.description || '—'),
    '',
    'Open the sheet:',
    sheetUrl,
  ].join('\n')

  GmailApp.sendEmail(NOTIFY_EMAIL, subject, body)
  Logger.log('Notification email sent to ' + NOTIFY_EMAIL)
}

// ── testSubmission ─────────────────────────────────────────────────────────────
// Run this from the Apps Script editor to verify the full flow end-to-end:
//   1. Adds a fake row to the Events tab (active=FALSE, status=submitted)
//   2. Sends a notification email to NOTIFY_EMAIL
//   3. You should see the row at the bottom of the Events tab
//   4. Delete the test row when done
//
// Also use this to trigger Gmail authorization on first deploy.

function testSubmission() {
  const fakeData = {
    event_name:      'TEST EVENT — DELETE ME',
    venue:           'Test Venue DTLA',
    date:            '2026-04-01',
    time:            '9:00 PM',
    genre:           'Reggaeton',
    event_type:      'friday_night',
    ticket_link:     '',
    flyer_image_url: '',
    description:     'This is a test submission to verify the direct-to-Events flow. Delete this row after testing.',
  }

  const sheet = getEventsSheet()
  sheet.appendRow([
    fakeData.event_name,
    fakeData.venue,
    fakeData.date,
    fakeData.time,
    fakeData.genre,
    fakeData.event_type,
    fakeData.ticket_link,
    fakeData.flyer_image_url,
    'FALSE',
    'FALSE',
    '',
    'submitted',
    '', '', '',
    fakeData.description,
  ])

  try {
    sendSubmissionEmail(fakeData)
    SpreadsheetApp.getUi().alert(
      '✅ Test complete',
      'A test row was written to the Events tab and a notification email was sent to ' + NOTIFY_EMAIL + '.\n\n' +
      'Check the Events tab and your inbox, then delete the test row.',
      SpreadsheetApp.getUi().ButtonSet.OK
    )
  } catch (emailErr) {
    SpreadsheetApp.getUi().alert(
      '⚠️ Row written, email failed',
      'The test row was written to Events but the email failed:\n\n' + emailErr.toString() + '\n\n' +
      'You may need to re-authorize GmailApp. Check Apps Script → Services.',
      SpreadsheetApp.getUi().ButtonSet.OK
    )
  }
}
