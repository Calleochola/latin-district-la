/**
 * Latin District LA — Contact Form Web App
 *
 * PURPOSE:
 *   Receives contact form submissions from the website and sends an email
 *   notification to NOTIFY_EMAIL. Nothing is written to any sheet.
 *
 * HOW TO DEPLOY:
 *   1. Go to script.google.com → create a NEW project (separate from submit-event)
 *   2. Paste this entire file, replacing all existing code
 *   3. Click Save (floppy disk)
 *   4. Click Deploy → New deployment
 *   5. Type: Web app
 *   6. Description: Contact Form v1
 *   7. Execute as: Me
 *   8. Who has access: Anyone
 *   9. Click Deploy → copy the /exec URL
 *  10. Paste into Netlify → Site settings → Environment variables
 *      as CONTACT_SCRIPT_URL (scope: All deploy contexts)
 *
 * GmailApp PERMISSION:
 *   Run testContact() from the script editor once after deploying to trigger
 *   the Gmail authorization prompt. Approve it before the first real submission.
 */

// ── Config ─────────────────────────────────────────────────────────────────────
const NOTIFY_EMAIL = 'calle8.losangeles@gmail.com'

// ── Helpers ────────────────────────────────────────────────────────────────────

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

// ── doGet — health check ───────────────────────────────────────────────────────

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status:  'ok',
      service: 'Latin District Contact Form',
    }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ── doPost — receive contact submission and send email ─────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents)

    const required = ['name', 'email', 'subject', 'message']
    const missing  = required.filter(k => !data[k] || !String(data[k]).trim())
    if (missing.length) {
      return jsonResponse({ result: 'error', message: 'Missing required fields: ' + missing.join(', ') })
    }

    sendContactEmail(data)

    Logger.log('Contact email sent: ' + data.subject + ' from ' + data.email)
    return jsonResponse({ result: 'success' })

  } catch (err) {
    Logger.log('doPost error: ' + err.toString())
    return jsonResponse({ result: 'error', message: err.toString() })
  }
}

// ── sendContactEmail ───────────────────────────────────────────────────────────

function sendContactEmail(data) {
  const subject = '[Latin District LA] Contact: ' + data.subject + ' — ' + data.name

  const body = [
    'New contact form submission on Latin District LA.',
    '',
    'Name:         ' + (data.name    || '—'),
    'Email:        ' + (data.email   || '—'),
    'Company:      ' + (data.company || '—'),
    'Type:         ' + (data.type    || '—'),
    'Subject:      ' + (data.subject || '—'),
    '',
    'Message:',
    (data.message || '—'),
    '',
    'Reply directly to this email or at: ' + (data.email || '—'),
  ].join('\n')

  GmailApp.sendEmail(NOTIFY_EMAIL, subject, body, {
    replyTo: data.email || NOTIFY_EMAIL,
  })
}

// ── testContact ────────────────────────────────────────────────────────────────
// Run from the Apps Script editor to trigger GmailApp auth and verify delivery.
// This is a STANDALONE script — SpreadsheetApp.getUi() is not available here.
// After running, check View → Logs (or Executions) for the result.

function testContact() {
  const fakeData = {
    name:    'Test User',
    email:   'test@example.com',
    company: 'Test Venue',
    type:    'venue',
    subject: 'TEST — delete this',
    message: 'This is a test contact submission. Ignore.',
  }

  sendContactEmail(fakeData)
  Logger.log('✅ Test email sent to ' + NOTIFY_EMAIL)
}
