/**
 * Latin District LA — Event Submission & Approval Web App
 *
 * PURPOSE:
 *   Receives event submissions from the website and writes them to the
 *   "Event Submissions" intake sheet for review. Approved rows are
 *   published to the live "Events" sheet in one click via the custom menu.
 *
 * HOW TO DEPLOY:
 *   1. Go to script.google.com → open this project
 *   2. Paste this entire file, replacing all existing code
 *   3. Click Save (floppy disk)
 *   4. Click Deploy → New deployment
 *   5. Type: Web app
 *   6. Description: Event Submission v3
 *   7. Execute as: Me
 *   8. Who has access: Anyone
 *   9. Click Deploy → copy the /exec URL
 *  10. Paste that URL into Netlify → Site settings → Environment variables
 *      as APPS_SCRIPT_URL (scope: All deploy contexts)
 *
 * SHEET TABS USED:
 *   "Event Submissions" — intake (created automatically on first submission)
 *   "Events"            — live website data (only appended to, never deleted)
 *
 * APPROVAL WORKFLOW (1-click via custom menu):
 *   1. Open the Google Sheet
 *   2. Go to the "Event Submissions" tab
 *   3. Click any cell in the row you want to approve
 *   4. Click the "Latin District LA" menu at the top
 *   5. Click "Approve Selected Row"
 *   6. Done — event is live on the website
 *
 * APPROVAL WORKFLOW (script editor, if needed):
 *   approveRow(2)   ← row 2 = first data row (row 1 is header)
 */

// ── Config ─────────────────────────────────────────────────────────────────────
// Leave SPREADSHEET_ID blank — the script runs bound to the sheet.
// Only set it if running as a standalone (unbound) script.
const SPREADSHEET_ID  = ''
const INTAKE_TAB_NAME = 'Event Submissions'
const EVENTS_TAB_NAME = 'Events'

// Intake sheet column order (must match appendRow call in doPost exactly)
const INTAKE_HEADERS = [
  'submitted_at',    // A — ISO timestamp of submission
  'event_name',      // B
  'venue',           // C
  'date',            // D — YYYY-MM-DD
  'time',            // E
  'genre',           // F — optional
  'event_type',      // G
  'ticket_link',     // H — optional
  'flyer_image_url', // I
  'description',     // J
  'status',          // K — pending | approved | rejected
  'reviewer_notes',  // L — admin fills in if needed
]

// Events sheet column order (must match the website's expected schema exactly)
const EVENTS_HEADERS = [
  'event_name', 'venue', 'date', 'time', 'genre', 'event_type',
  'ticket_link', 'flyer_image_url', 'featured', 'active',
  'tailgate_time', 'status', 'venue_image_url', 'video_url',
  'crowd_level', 'description',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getSpreadsheet() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet()
}

function getOrCreateIntakeSheet() {
  const ss    = getSpreadsheet()
  let   sheet = ss.getSheetByName(INTAKE_TAB_NAME)

  if (!sheet) {
    sheet = ss.insertSheet(INTAKE_TAB_NAME)
    const headerRange = sheet.getRange(1, 1, 1, INTAKE_HEADERS.length)
    headerRange.setValues([INTAKE_HEADERS])
    headerRange.setFontWeight('bold')
    headerRange.setBackground('#1a1a2e')
    headerRange.setFontColor('#00E5FF')
    sheet.setFrozenRows(1)
    Logger.log('Created intake sheet: ' + INTAKE_TAB_NAME)
  }

  return sheet
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

// ── Custom Menu ────────────────────────────────────────────────────────────────
// Adds a "Latin District LA" menu to the Google Sheet when opened.
// This is the primary 1-click approval interface.

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Latin District LA')
    .addItem('✅ Approve Selected Row', 'approveSelectedRow')
    .addItem('❌ Reject Selected Row',  'rejectSelectedRow')
    .addSeparator()
    .addItem('Run Test Submission',     'testSubmission')
    .addToUi()
}

// Reads the currently active row in the sheet and calls approveRow().
// Must be on the "Event Submissions" tab with a data row selected.
function approveSelectedRow() {
  const ui    = SpreadsheetApp.getUi()
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()

  if (sheet.getName() !== INTAKE_TAB_NAME) {
    ui.alert(
      '⚠️ Wrong tab',
      'Please switch to the "' + INTAKE_TAB_NAME + '" tab and click a row to approve.',
      ui.ButtonSet.OK
    )
    return
  }

  const row = sheet.getActiveRange().getRow()
  if (row <= 1) {
    ui.alert('⚠️ Header row selected', 'Please click a data row (row 2 or below).', ui.ButtonSet.OK)
    return
  }

  approveRow(row)
}

// Reads the currently active row and calls rejectRow().
function rejectSelectedRow() {
  const ui    = SpreadsheetApp.getUi()
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()

  if (sheet.getName() !== INTAKE_TAB_NAME) {
    ui.alert(
      '⚠️ Wrong tab',
      'Please switch to the "' + INTAKE_TAB_NAME + '" tab and click a row to reject.',
      ui.ButtonSet.OK
    )
    return
  }

  const row = sheet.getActiveRange().getRow()
  if (row <= 1) {
    ui.alert('⚠️ Header row selected', 'Please click a data row (row 2 or below).', ui.ButtonSet.OK)
    return
  }

  const response = ui.alert(
    'Reject this row?',
    'Row ' + row + ' will be marked rejected. No data is deleted.',
    ui.ButtonSet.YES_NO
  )
  if (response !== ui.Button.YES) return

  rejectRow(row, 'Rejected via menu')
  ui.alert('❌ Rejected', 'Row ' + row + ' has been marked as rejected.', ui.ButtonSet.OK)
}

// ── doGet — health check ───────────────────────────────────────────────────────
// Visiting the /exec URL in a browser should return {"status":"ok",...}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status:  'ok',
      service: 'Latin District Event Submit',
      intake:  INTAKE_TAB_NAME,
    }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ── doPost — receive submission from website ───────────────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents)

    // Validate required fields.
    // genre is intentionally excluded — it is optional on the submission form.
    const required = ['event_name', 'venue', 'date', 'time', 'event_type', 'flyer_image_url', 'description']
    const missing  = required.filter(k => !data[k] || !String(data[k]).trim())
    if (missing.length) {
      return jsonResponse({ result: 'error', message: 'Missing required fields: ' + missing.join(', ') })
    }

    const sheet = getOrCreateIntakeSheet()

    sheet.appendRow([
      new Date().toISOString(),
      String(data.event_name      || '').trim(),
      String(data.venue           || '').trim(),
      String(data.date            || '').trim(),
      String(data.time            || '').trim(),
      String(data.genre           || '').trim(),  // optional — may be blank
      String(data.event_type      || '').trim(),
      String(data.ticket_link     || '').trim(),  // optional — may be blank
      String(data.flyer_image_url || '').trim(),
      String(data.description     || '').trim(),
      'pending',  // status — always starts as pending
      '',         // reviewer_notes — blank until admin reviews
    ])

    Logger.log('Submission received: ' + data.event_name + ' @ ' + data.venue)
    return jsonResponse({ result: 'success' })

  } catch (err) {
    Logger.log('doPost error: ' + err.toString())
    return jsonResponse({ result: 'error', message: err.toString() })
  }
}

// ── approveRow ─────────────────────────────────────────────────────────────────
//
// Copies a submission row from "Event Submissions" → "Events" and marks it
// as approved. This is the core of the publish system.
//
// Guards:
//   • Throws if the row is empty (no event_name)
//   • Throws if date is missing (required to appear on calendar)
//   • Throws if the row is already approved (prevents duplicate publishing)
//
// What it sets in the Events sheet:
//   active   = TRUE     → row appears on website immediately
//   featured = FALSE    → set to TRUE manually in Events sheet if needed
//   status   = approved
//   All other moderation fields (venue_image_url, video_url, etc.) = ""
//
// Usage from script editor:
//   approveRow(2)   ← approves row 2 (first data row after header)

function approveRow(rowNumber) {
  const ss          = getSpreadsheet()
  const intakeSheet = ss.getSheetByName(INTAKE_TAB_NAME)
  const eventsSheet = ss.getSheetByName(EVENTS_TAB_NAME)

  if (!intakeSheet) throw new Error('Sheet not found: ' + INTAKE_TAB_NAME)
  if (!eventsSheet) throw new Error('Sheet not found: ' + EVENTS_TAB_NAME)

  // Read the full intake row
  const row = intakeSheet.getRange(rowNumber, 1, 1, INTAKE_HEADERS.length).getValues()[0]

  // Map values by INTAKE_HEADERS index
  // [submitted_at(0), event_name(1), venue(2), date(3), time(4),
  //  genre(5), event_type(6), ticket_link(7), flyer_image_url(8),
  //  description(9), status(10), reviewer_notes(11)]
  const event_name      = String(row[1] || '').trim()
  const venue           = String(row[2] || '').trim()
  const date            = String(row[3] || '').trim()
  const time            = String(row[4] || '').trim()
  const genre           = String(row[5] || '').trim()
  const event_type      = String(row[6] || '').trim()
  const ticket_link     = String(row[7] || '').trim()
  const flyer_image_url = String(row[8] || '').trim()
  const description     = String(row[9] || '').trim()
  const currentStatus   = String(row[10] || '').trim().toLowerCase()

  // ── Guard: empty row ────────────────────────────────────────────────────────
  if (!event_name) {
    throw new Error(
      'Row ' + rowNumber + ' appears empty (no event_name). ' +
      'Check the row number — row 1 is the header, data starts at row 2.'
    )
  }

  // ── Guard: date required ────────────────────────────────────────────────────
  if (!date) {
    throw new Error(
      'Row ' + rowNumber + ' (' + event_name + ') has no date. ' +
      'A date is required before publishing to the calendar.'
    )
  }

  // ── Guard: no duplicate publishing ─────────────────────────────────────────
  // Once a row is approved it has already been appended to Events.
  // Approving it again would create a duplicate entry on the website.
  if (currentStatus === 'approved') {
    SpreadsheetApp.getUi().alert(
      '⚠️ Already approved',
      'Row ' + rowNumber + ' (' + event_name + ') was already approved and is live.\n\n' +
      'Nothing changed. To update the event, edit it directly in the Events sheet.',
      SpreadsheetApp.getUi().ButtonSet.OK
    )
    return
  }

  // ── Append to Events in the exact schema the website reads ─────────────────
  eventsSheet.appendRow([
    event_name,       // event_name
    venue,            // venue
    date,             // date      — YYYY-MM-DD
    time,             // time
    genre,            // genre     — may be blank, website handles gracefully
    event_type,       // event_type
    ticket_link,      // ticket_link — may be blank
    flyer_image_url,  // flyer_image_url
    'FALSE',          // featured  — set TRUE in Events sheet to pin to homepage
    'TRUE',           // active    — immediately visible on website
    '',               // tailgate_time
    'approved',       // status
    '',               // venue_image_url
    '',               // video_url
    '',               // crowd_level
    description,      // description
  ])

  // ── Mark intake row as approved ─────────────────────────────────────────────
  const statusCol = INTAKE_HEADERS.indexOf('status') + 1  // 1-based column index
  intakeSheet.getRange(rowNumber, statusCol).setValue('approved')

  Logger.log('✅ Approved row ' + rowNumber + ': ' + event_name + ' @ ' + venue)
  SpreadsheetApp.getUi().alert(
    '✅ Published!',
    event_name + '\n' + venue + ' · ' + date + '\n\nThis event is now live on the website.',
    SpreadsheetApp.getUi().ButtonSet.OK
  )
}

// ── rejectRow ──────────────────────────────────────────────────────────────────
// Marks a submission as rejected without deleting it.
// Optional notes param lets you record why it was rejected.
//
// Usage: rejectRow(3, 'Duplicate submission')

function rejectRow(rowNumber, notes) {
  const ss          = getSpreadsheet()
  const intakeSheet = ss.getSheetByName(INTAKE_TAB_NAME)
  if (!intakeSheet) throw new Error('Sheet not found: ' + INTAKE_TAB_NAME)

  const row           = intakeSheet.getRange(rowNumber, 1, 1, INTAKE_HEADERS.length).getValues()[0]
  const event_name    = String(row[1] || '').trim()
  const currentStatus = String(row[10] || '').trim().toLowerCase()

  if (!event_name) {
    throw new Error('Row ' + rowNumber + ' appears empty — check the row number.')
  }

  if (currentStatus === 'approved') {
    throw new Error(
      'Row ' + rowNumber + ' (' + event_name + ') is already approved and live. ' +
      'You cannot reject a published event from the intake sheet. ' +
      'To hide it, set active=FALSE directly in the Events sheet.'
    )
  }

  const statusCol = INTAKE_HEADERS.indexOf('status') + 1
  const notesCol  = INTAKE_HEADERS.indexOf('reviewer_notes') + 1

  intakeSheet.getRange(rowNumber, statusCol).setValue('rejected')
  if (notes) intakeSheet.getRange(rowNumber, notesCol).setValue(notes)

  Logger.log('❌ Rejected row ' + rowNumber + ': ' + event_name)
}

// ── testSubmission ─────────────────────────────────────────────────────────────
// Adds a fake submission row to "Event Submissions" so you can test
// the full approval flow end-to-end without a real form submission.
//
// After running this:
//   1. Look in Event Submissions tab — a test row appears
//   2. Click that row, then use the menu to "Approve Selected Row"
//   3. Verify the row appears in the Events tab
//   4. Delete the test row from both sheets when done

function testSubmission() {
  const sheet = getOrCreateIntakeSheet()
  sheet.appendRow([
    new Date().toISOString(),
    'TEST EVENT — DELETE ME',
    'Test Venue DTLA',
    '2026-04-01',
    '9:00 PM',
    'Reggaeton',
    'friday_night',
    '',
    '',
    'This is a test submission to verify the approval flow. Delete after testing.',
    'pending',
    '',
  ])
  SpreadsheetApp.getUi().alert(
    '✅ Test row added',
    'A test submission was added to "' + INTAKE_TAB_NAME + '".\n\n' +
    'To test approval:\n' +
    '1. Switch to the "' + INTAKE_TAB_NAME + '" tab\n' +
    '2. Click the test row\n' +
    '3. Use the "Latin District LA" menu → "Approve Selected Row"',
    SpreadsheetApp.getUi().ButtonSet.OK
  )
}
