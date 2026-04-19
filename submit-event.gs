/**
 * Latin District LA — Event Submission Web App
 *
 * PURPOSE:
 *   Receives event submissions from the website, uploads the flyer to Google
 *   Drive, and writes the row directly to the live "Events" tab with
 *   active=FALSE and status=submitted.
 *
 *   The flyer upload and row write are atomic: if the Drive upload fails,
 *   no row is written and the submission is rejected with a clear error.
 *   If the row write fails after a successful upload, the Drive file remains
 *   (orphaned) but flyer_file_id in the sheet enables future cleanup.
 *
 *   Events are visible on the website only after an admin sets active=TRUE
 *   and status=approved directly in the Events sheet.
 *   An email notification is sent to NOTIFY_EMAIL on every accepted submission.
 *
 * ── HOW TO DEPLOY ────────────────────────────────────────────────────────────
 *   Updating an existing deployment (most common):
 *   1. script.google.com → open this project
 *   2. Paste this entire file, replacing all existing code
 *   3. Click Save (floppy disk icon)
 *   4. Deploy → Manage deployments → pencil icon on current deployment
 *   5. Change Version to "New version"
 *   6. Click Deploy
 *   The /exec URL stays the same — no Netlify env var change needed.
 *
 *   First-time deploy (no existing deployment):
 *   1–3. Same as above
 *   4. Deploy → New deployment
 *   5. Type: Web app
 *   6. Description: Event Submission v5 — Drive upload + Events write
 *   7. Execute as: Me
 *   8. Who has access: Anyone
 *   9. Click Deploy → copy the /exec URL
 *  10. Netlify → Site settings → Environment variables → APPS_SCRIPT_URL = (paste URL)
 *
 * ── DRIVE FOLDER SETUP ───────────────────────────────────────────────────────
 *   1. In Google Drive, create a folder (e.g. "Latin District Flyers")
 *   2. Copy the folder ID from its URL:
 *        drive.google.com/drive/folders/FOLDER_ID_IS_HERE
 *   3. Paste the folder ID into FLYER_FOLDER_ID below.
 *   No special sharing needed — DriveApp uses the script owner's Drive account.
 *
 * ── APPROVAL WORKFLOW ────────────────────────────────────────────────────────
 *   New submissions land in the Events tab with active=FALSE, status=submitted.
 *   To publish:
 *     1. Open the Events tab in the Google Sheet
 *     2. Find the row (most recent submission is at the bottom)
 *     3. Set active   → TRUE
 *        Set status   → approved
 *     4. Event is immediately live on the website (within cache TTL)
 *
 * ── EMAIL ────────────────────────────────────────────────────────────────────
 *   Every accepted submission sends an email to NOTIFY_EMAIL with full details
 *   and a direct link to the sheet. Email failure is non-fatal — the row is
 *   still written even if Gmail fails.
 *
 * ── GmailApp PERMISSION ──────────────────────────────────────────────────────
 *   On the first execution after deploying, Google will prompt for Gmail and
 *   Drive authorization. Run testSubmission() from the script editor once to
 *   trigger and approve both auth dialogs before the first real submission.
 *
 * ── WHAT THE NETLIFY FUNCTION MUST SEND ──────────────────────────────────────
 *   The Netlify submit-event function must forward these fields to this script:
 *     flyer_base64    — base64-encoded file contents (no data: prefix)
 *     flyer_mime_type — MIME type, e.g. "image/jpeg"
 *     flyer_filename  — original filename, e.g. "flyer.jpg"
 *     event_name, venue, date, time, event_type, description (required)
 *     genre, ticket_link (optional)
 *   See companion changes to submit-event.js and App.jsx.
 */

// ── Config ────────────────────────────────────────────────────────────────────
const SPREADSHEET_ID  = ''                       // blank = bound script (recommended)
const EVENTS_TAB_NAME = 'Events'
const NOTIFY_EMAIL    = 'latindistrictla@gmail.com'
const FLYER_FOLDER_ID = '1XSKvg5ZzxMRUOQ6OZ-byKZ0ednwU4CmE' // Drive folder for uploaded flyers
                                                 // Get from: drive.google.com/drive/folders/XXXX
                                                 // Leave blank to upload to Drive root (not recommended)

// Allowed MIME types — HEIC blocked because browsers cannot render it.
// Must match the client-side and Netlify-side validation lists.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Max file size in bytes (decoded). 4 MB keeps base64-encoded payload under
// Netlify's 6 MB request body limit (4 MB × 1.333 ≈ 5.3 MB base64).
const MAX_FLYER_BYTES = 4 * 1024 * 1024

// ── Events sheet column schema ────────────────────────────────────────────────
// Exact column order — must match the website's gviz reads and appendRow below.
// Columns Q and R were added for the Drive upload flow.
//
// To add these headers to an existing sheet:
//   1. Open the Events tab
//   2. Click on cell Q1 → type: flyer_file_id
//   3. Click on cell R1 → type: flyer_source
//   (Existing rows will just have blank values in those columns — backward compatible)
const EVENTS_HEADERS = [
  'event_name',      // A — required
  'venue',           // B — required
  'date',            // C — YYYY-MM-DD, required
  'time',            // D — required
  'genre',           // E — optional
  'event_type',      // F — required
  'ticket_link',     // G — optional
  'flyer_image_url', // H — Drive direct-serve URL, set by this script
  'featured',        // I — always FALSE on submission; admin sets TRUE if needed
  'active',          // J — always FALSE on submission; admin sets TRUE to publish
  'tailgate_time',   // K — blank on submission
  'status',          // L — 'submitted' on arrival; admin sets 'approved' to publish
  'venue_image_url', // M — blank on submission
  'video_url',       // N — blank on submission
  'crowd_level',     // O — blank on submission
  'description',     // P — required
  'flyer_file_id',   // Q — Drive file ID; enables future deletion via flyer_file_id
  'flyer_source',    // R — always 'upload' for form submissions
]

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── doGet — health check ──────────────────────────────────────────────────────
// Visit the /exec URL in a browser to confirm the script is live.
// Should return: { "status": "ok", "service": "Latin District Event Submit", ... }

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status:  'ok',
      service: 'Latin District Event Submit',
      target:  EVENTS_TAB_NAME,
      version: 'v5-drive-upload',
    }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ── uploadFlyerToDrive ────────────────────────────────────────────────────────
// Decodes a base64-encoded image, saves it to the configured Drive folder,
// sets it to public (anyone with link can view), and returns the file ID
// and a stable direct-serve URL.
//
// Throws on any failure — caller must handle and reject the submission.

function uploadFlyerToDrive(base64, mimeType, filename) {
  // Validate MIME type
  if (ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) {
    throw new Error('File type not allowed: ' + mimeType + '. Use JPG, PNG, or WEBP.')
  }

  // Decode and size-check
  const decoded = Utilities.base64Decode(base64)
  if (decoded.length > MAX_FLYER_BYTES) {
    const mb = (decoded.length / 1024 / 1024).toFixed(1)
    throw new Error('File too large (' + mb + ' MB). Maximum is 4 MB.')
  }

  // Build the Drive file
  const blob = Utilities.newBlob(decoded, mimeType, filename)

  let file
  if (FLYER_FOLDER_ID) {
    const folder = DriveApp.getFolderById(FLYER_FOLDER_ID)
    file = folder.createFile(blob)
  } else {
    // Fallback: root of Drive. Set FLYER_FOLDER_ID to keep flyers organised.
    Logger.log('[upload-flyer] WARNING: FLYER_FOLDER_ID is not set. Uploading to Drive root.')
    file = DriveApp.createFile(blob)
  }

  // Make the file publicly readable so the image renders on the website
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

  const fileId   = file.getId()
  const imageUrl = 'https://drive.google.com/uc?export=view&id=' + fileId

  Logger.log('[upload-flyer] Uploaded: ' + filename + ' → ' + fileId)
  return { fileId: fileId, imageUrl: imageUrl }
}

// ── doPost — receive submission, upload flyer, write row ──────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents)

    // ── Validate required form fields ─────────────────────────────────────────
    // genre and ticket_link are optional — excluded from this check.
    // flyer fields are validated separately below.
    const requiredFields = ['event_name', 'venue', 'date', 'time', 'event_type', 'description']
    const missing = requiredFields.filter(function(k) {
      return !data[k] || !String(data[k]).trim()
    })
    if (missing.length) {
      return jsonResponse({ result: 'error', message: 'Missing required fields: ' + missing.join(', ') })
    }

    // ── Validate flyer data ───────────────────────────────────────────────────
    if (!data.flyer_base64 || typeof data.flyer_base64 !== 'string') {
      return jsonResponse({ result: 'error', message: 'Flyer file data is required. Upload failed or was not included.' })
    }
    if (!data.flyer_mime_type) {
      return jsonResponse({ result: 'error', message: 'Flyer MIME type is required.' })
    }

    // ── Upload flyer to Google Drive ──────────────────────────────────────────
    // This is atomic with the row write: if the upload fails, no row is written.
    var flyer_image_url
    var flyer_file_id
    try {
      const safeName = 'flyer_' + Date.now() + '_' +
        String(data.flyer_filename || 'upload.jpg').replace(/[^a-zA-Z0-9._-]/g, '_')
      const result = uploadFlyerToDrive(data.flyer_base64, data.flyer_mime_type, safeName)
      flyer_image_url = result.imageUrl
      flyer_file_id   = result.fileId
    } catch (uploadErr) {
      Logger.log('[doPost] Flyer upload failed: ' + uploadErr.toString())
      return jsonResponse({
        result:  'error',
        message: 'Flyer upload failed — submission rejected. ' + uploadErr.toString(),
      })
    }

    // ── Write row to Events sheet ─────────────────────────────────────────────
    // Column order must match EVENTS_HEADERS exactly (A → R).
    const sheet = getEventsSheet()
    sheet.appendRow([
      String(data.event_name  || '').trim(),  // A: event_name
      String(data.venue       || '').trim(),  // B: venue
      String(data.date        || '').trim(),  // C: date
      String(data.time        || '').trim(),  // D: time
      String(data.genre       || '').trim(),  // E: genre       — may be blank
      String(data.event_type  || '').trim(),  // F: event_type
      String(data.ticket_link || '').trim(),  // G: ticket_link — may be blank
      flyer_image_url,                        // H: flyer_image_url — set by Drive upload
      'FALSE',                                // I: featured   — admin sets TRUE if needed
      'FALSE',                                // J: active     — admin sets TRUE to publish
      '',                                     // K: tailgate_time
      'submitted',                            // L: status     — admin sets 'approved' to publish
      '',                                     // M: venue_image_url
      '',                                     // N: video_url
      '',                                     // O: crowd_level
      String(data.description || '').trim(),  // P: description
      flyer_file_id,                          // Q: flyer_file_id — Drive ID for future deletion
      'upload',                               // R: flyer_source  — always 'upload' for form submissions
    ])

    Logger.log('[doPost] Row written: ' + data.event_name + ' @ ' + data.venue)

    // ── Send notification email ───────────────────────────────────────────────
    // Non-fatal: Gmail failure never blocks the row write.
    try {
      sendSubmissionEmail(data, flyer_image_url, flyer_file_id)
    } catch (emailErr) {
      Logger.log('[doPost] Email failed (non-fatal): ' + emailErr.toString())
    }

    return jsonResponse({ result: 'success' })

  } catch (err) {
    Logger.log('[doPost] Uncaught error: ' + err.toString())
    return jsonResponse({ result: 'error', message: err.toString() })
  }
}

// ── sendSubmissionEmail ───────────────────────────────────────────────────────
// Sends a notification email to NOTIFY_EMAIL on every successful submission.
// Non-fatal — wrapped in try/catch at the call site in doPost.

function sendSubmissionEmail(data, flyer_image_url, flyer_file_id) {
  const sheetId  = SPREADSHEET_ID || SpreadsheetApp.getActiveSpreadsheet().getId()
  const sheetUrl = 'https://docs.google.com/spreadsheets/d/' + sheetId

  const subject = '[Latin District LA] New submission: ' + data.event_name + ' @ ' + data.venue

  const body = [
    'A new event submission was received on Latin District LA.',
    'The flyer has been uploaded to Google Drive and the row has been written',
    'to the Events tab with active=FALSE and status=submitted.',
    '',
    'To publish: open the sheet, find the row, set active=TRUE and status=approved.',
    '',
    'Event:       ' + (data.event_name   || '—'),
    'Venue:       ' + (data.venue        || '—'),
    'Date:        ' + (data.date         || '—'),
    'Time:        ' + (data.time         || '—'),
    'Type:        ' + (data.event_type   || '—'),
    'Genre:       ' + (data.genre        || '—'),
    'Ticket Link: ' + (data.ticket_link  || '—'),
    'Flyer URL:   ' + (flyer_image_url   || '—'),
    'Flyer ID:    ' + (flyer_file_id     || '—'),
    '',
    'Description:',
    (data.description || '—'),
    '',
    'Open the sheet:',
    sheetUrl,
  ].join('\n')

  GmailApp.sendEmail(NOTIFY_EMAIL, subject, body)
  Logger.log('[sendSubmissionEmail] Sent to ' + NOTIFY_EMAIL)
}

// ── testSubmission ────────────────────────────────────────────────────────────
// Run this from the Apps Script editor to verify the full flow end-to-end:
//   1. Creates a real 1×1 white JPEG and uploads it to Drive
//   2. Adds a test row to the Events tab (active=FALSE, status=submitted)
//   3. Sends a notification email to NOTIFY_EMAIL
//   4. Shows an alert with the result
//
// IMPORTANT: Run this once after every new deployment to:
//   - Trigger and approve Gmail + Drive authorization dialogs
//   - Confirm the folder ID is correct and writable
//   - Delete the test row when done
//
// The tiny test JPEG is a real file — check that it appears in your Drive folder.

function testSubmission() {
  // Minimal valid JPEG (1×1 white pixel) in base64
  const tinyJpegBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
    'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwh' +
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAB' +
    'AAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/' +
    'xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A' +
    'JQAB/9k='

  const fakeData = {
    event_name:      'TEST EVENT — DELETE ME',
    venue:           'Test Venue DTLA',
    date:            '2026-04-01',
    time:            '9:00 PM',
    genre:           'Reggaeton',
    event_type:      'friday_night',
    ticket_link:     '',
    flyer_base64:    tinyJpegBase64,
    flyer_mime_type: 'image/jpeg',
    flyer_filename:  'test_flyer.jpg',
    description:     'This is a test submission to verify the Drive upload flow. Delete this row and the Drive file when done.',
  }

  var flyer_image_url = '(upload skipped)'
  var flyer_file_id   = '(no file)'
  var uploadNote      = ''

  try {
    const result = uploadFlyerToDrive(fakeData.flyer_base64, fakeData.flyer_mime_type, 'test_flyer_DELETE_ME.jpg')
    flyer_image_url = result.imageUrl
    flyer_file_id   = result.fileId
    uploadNote = 'Drive upload: ✅ ' + flyer_image_url
  } catch (uploadErr) {
    uploadNote = 'Drive upload: ❌ ' + uploadErr.toString()
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
    flyer_image_url,
    'FALSE',
    'FALSE',
    '',
    'submitted',
    '', '', '',
    fakeData.description,
    flyer_file_id,
    'upload',
  ])

  try {
    sendSubmissionEmail(fakeData, flyer_image_url, flyer_file_id)
    SpreadsheetApp.getUi().alert(
      'Test complete',
      uploadNote + '\n\n' +
      'Row written to Events tab.\n' +
      'Notification email sent to ' + NOTIFY_EMAIL + '.\n\n' +
      'Check the Events tab and your Drive folder, then delete the test row and file.',
      SpreadsheetApp.getUi().ButtonSet.OK
    )
  } catch (emailErr) {
    SpreadsheetApp.getUi().alert(
      'Row written — email failed',
      uploadNote + '\n\n' +
      'The test row was written but the email failed:\n' + emailErr.toString() + '\n\n' +
      'Re-authorize GmailApp: Apps Script → Services, or run this function again.',
      SpreadsheetApp.getUi().ButtonSet.OK
    )
  }
}
