/**
 * Latin District LA — Event Submission Web App
 *
 * PURPOSE:
 *   Receives event submissions from the website and writes them to the
 *   "Event Submissions" intake sheet for manual review. Nothing goes
 *   directly to the live "Events" sheet. An assistant approves rows
 *   using the approveRow() function below.
 *
 * HOW TO DEPLOY:
 *   1. Go to script.google.com → open this project
 *   2. Paste this entire file, replacing all existing code
 *   3. Click Save (floppy disk)
 *   4. Click Deploy → New deployment
 *   5. Type: Web app
 *   6. Description: Event Submission v2
 *   7. Execute as: Me
 *   8. Who has access: Anyone
 *   9. Click Deploy → copy the /exec URL
 *  10. Paste that URL into Netlify → Site settings → Environment variables
 *      as APPS_SCRIPT_URL (scope: All deploy contexts)
 *
 * SHEET TABS USED:
 *   "Event Submissions" — intake (created automatically on first submission)
 *   "Events"            — live website data (read-only from this script)
 *
 * APPROVAL WORKFLOW:
 *   See approveRow() below. Run it manually from Apps Script to move a
 *   submission from intake into the live Events sheet.
 */

// ── Config ────────────────────────────────────────────────────────────────────
// Leave SPREADSHEET_ID blank — the script runs bound to the sheet, so it
// uses getActiveSpreadsheet() automatically. Only set this if you deploy
// as a standalone (unbound) script.
const SPREADSHEET_ID   = ''
const INTAKE_TAB_NAME  = 'Event Submissions'
const EVENTS_TAB_NAME  = 'Events'

// Intake sheet column order (must match appendRow call in doPost)
const INTAKE_HEADERS = [
  'submitted_at',    // A — ISO timestamp of submission
  'event_name',      // B
  'venue',           // C
  'date',            // D — YYYY-MM-DD
  'time',            // E
  'genre',           // F
  'event_type',      // G
  'ticket_link',     // H
  'flyer_image_url', // I
  'description',     // J
  'status',          // K — pending | approved | rejected
  'reviewer_notes',  // L — assistant fills this in
]

// Events sheet column order (must match website's expected schema exactly)
const EVENTS_HEADERS = [
  'event_name', 'venue', 'date', 'time', 'genre', 'event_type',
  'ticket_link', 'flyer_image_url', 'featured', 'active',
  'tailgate_time', 'status', 'venue_image_url', 'video_url',
  'crowd_level', 'description',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── doGet — health check ──────────────────────────────────────────────────────
// Visiting the /exec URL in a browser should return {"status":"ok",...}
// Use this to confirm the URL is correct before anything else.

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
    // Parse the JSON body sent by the Netlify function
    const data = JSON.parse(e.postData.contents)

    // Validate required fields (belt-and-suspenders — Netlify function also checks)
    const required = ['event_name', 'venue', 'date', 'time', 'genre', 'event_type', 'flyer_image_url', 'description']
    const missing  = required.filter(k => !data[k] || !String(data[k]).trim())
    if (missing.length) {
      return jsonResponse({ result: 'error', message: 'Missing required fields: ' + missing.join(', ') })
    }

    const sheet = getOrCreateIntakeSheet()

    // Append one row in INTAKE_HEADERS column order
    sheet.appendRow([
      new Date().toISOString(),          // submitted_at
      String(data.event_name      || '').trim(),
      String(data.venue           || '').trim(),
      String(data.date            || '').trim(),
      String(data.time            || '').trim(),
      String(data.genre           || '').trim(),
      String(data.event_type      || '').trim(),
      String(data.ticket_link     || '').trim(),
      String(data.flyer_image_url || '').trim(),
      String(data.description     || '').trim(),
      'pending',   // status — always starts as pending
      '',          // reviewer_notes — blank until assistant reviews
    ])

    Logger.log('Submission received: ' + data.event_name + ' @ ' + data.venue)

    return jsonResponse({ result: 'success' })

  } catch (err) {
    Logger.log('doPost error: ' + err.toString())
    return jsonResponse({ result: 'error', message: err.toString() })
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

// ── approveRow — assistant runs this to publish an approved submission ─────────
//
// HOW TO USE:
//   1. Open Apps Script (Extensions → Apps Script from the Google Sheet)
//   2. Look at the "Event Submissions" tab — find the row number to approve
//      (row 2 = first submission, row 3 = second, etc.)
//   3. In Apps Script editor, call: approveRow(2)
//      OR change the number in the call at the bottom of this function
//   4. Click Run ▶ — the row is copied to Events with active=TRUE
//   5. The row in "Event Submissions" is marked "approved"
//
// WHAT IT SETS in Events:
//   active    = TRUE   (row appears on website immediately)
//   featured  = FALSE  (you can manually set to TRUE in Events sheet after)
//   status    = approved
//   All media/moderation fields default to empty strings

function approveRow(rowNumber) {
  const ss          = getSpreadsheet()
  const intakeSheet = ss.getSheetByName(INTAKE_TAB_NAME)
  const eventsSheet = ss.getSheetByName(EVENTS_TAB_NAME)

  if (!intakeSheet) throw new Error('Sheet not found: ' + INTAKE_TAB_NAME)
  if (!eventsSheet) throw new Error('Sheet not found: ' + EVENTS_TAB_NAME)

  // Read the intake row (columns A–L)
  const row = intakeSheet.getRange(rowNumber, 1, 1, INTAKE_HEADERS.length).getValues()[0]

  // Map intake columns by name for clarity
  // INTAKE_HEADERS: submitted_at(0) event_name(1) venue(2) date(3) time(4)
  //                 genre(5) event_type(6) ticket_link(7) flyer_image_url(8)
  //                 description(9) status(10) reviewer_notes(11)
  const [
    , event_name, venue, date, time, genre, event_type,
    ticket_link, flyer_image_url, description,
  ] = row

  if (!event_name) {
    throw new Error('Row ' + rowNumber + ' appears empty — check the row number')
  }

  // Append to Events in the exact column order the website expects
  eventsSheet.appendRow([
    event_name,       // event_name
    venue,            // venue
    date,             // date
    time,             // time
    genre,            // genre
    event_type,       // event_type
    ticket_link,      // ticket_link
    flyer_image_url,  // flyer_image_url
    'FALSE',          // featured — set to TRUE manually in Events if needed
    'TRUE',           // active   — visible on website immediately
    '',               // tailgate_time
    'approved',       // status
    '',               // venue_image_url
    '',               // video_url
    '',               // crowd_level
    description,      // description
  ])

  // Mark the intake row as approved
  const statusCol = INTAKE_HEADERS.indexOf('status') + 1  // 1-based
  intakeSheet.getRange(rowNumber, statusCol).setValue('approved')

  Logger.log('✅ Approved row ' + rowNumber + ': ' + event_name + ' @ ' + venue)
  SpreadsheetApp.getUi().alert('✅ Approved!\n\n' + event_name + ' @ ' + venue + '\n\nNow visible on the website.')
}

// ── rejectRow — mark a submission as rejected without deleting it ──────────────

function rejectRow(rowNumber, notes) {
  const ss          = getSpreadsheet()
  const intakeSheet = ss.getSheetByName(INTAKE_TAB_NAME)
  if (!intakeSheet) throw new Error('Sheet not found: ' + INTAKE_TAB_NAME)

  const statusCol = INTAKE_HEADERS.indexOf('status') + 1        // K
  const notesCol  = INTAKE_HEADERS.indexOf('reviewer_notes') + 1 // L

  intakeSheet.getRange(rowNumber, statusCol).setValue('rejected')
  if (notes) intakeSheet.getRange(rowNumber, notesCol).setValue(notes)

  Logger.log('❌ Rejected row ' + rowNumber)
}

// ── Quick test — run this from Apps Script to verify the sheet works ───────────
// It adds a fake submission to "Event Submissions" so you can verify
// the sheet is created and the column structure is correct, then
// call approveRow(2) to test the full approval flow.

function testSubmission() {
  const sheet = getOrCreateIntakeSheet()
  sheet.appendRow([
    new Date().toISOString(),
    'TEST EVENT — DELETE ME',
    'Test Venue',
    '2026-04-01',
    '9:00 PM',
    'Reggaeton',
    'friday_night',
    '',
    '',
    'This is a test submission. Delete this row after verifying.',
    'pending',
    '',
  ])
  SpreadsheetApp.getUi().alert('✅ Test row added to "Event Submissions" tab.\n\nTo test approval: call approveRow(2) from the script editor.')
}
