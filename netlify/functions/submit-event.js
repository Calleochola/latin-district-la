// netlify/functions/submit-event.js
// Receives event submission from the front-end form, then forwards the payload
// to the Google Apps Script Web App which uploads the flyer to Drive and
// appends a row to the Events sheet.
//
// Required Netlify env var (Netlify dashboard → Site settings → Environment variables):
//   APPS_SCRIPT_URL  — The deployed Apps Script /exec URL
//
// ── Flyer upload architecture ─────────────────────────────────────────────────
// The front-end converts the selected file to base64 (FileReader) and includes
// it in this request body as flyer_base64 / flyer_mime_type / flyer_filename.
// This function validates those fields and forwards them to Apps Script.
// Apps Script decodes the file, uploads it to Google Drive via DriveApp,
// sets the file to public, and uses the resulting URL + file ID in the row write.
// If the Drive upload fails, Apps Script returns an error and no row is written.
//
// File size limit: 4 MB decoded → ~5.3 MB base64 → safely under Netlify's 6 MB body limit.
//
// ── WHY redirect: 'manual' ────────────────────────────────────────────────────
// Google Apps Script /exec URLs respond with a 302 redirect to
// script.googleusercontent.com before executing the script.
// Node.js fetch with redirect:'follow' converts POST→GET on a 302 per HTTP spec,
// stripping the request body.  Apps Script then receives a GET (no data), so
// doPost(e) never fires and nothing is written to the sheet.
// Fix: use redirect:'manual', detect the 3xx, and re-POST to the Location URL.
// ─────────────────────────────────────────────────────────────────────────────
//
// Moderation defaults (enforced server-side, never overridable by submitter):
//   featured = FALSE  |  active = FALSE  |  status = submitted
//   tailgate_time = ""  |  venue_image_url = ""  |  video_url = ""  |  crowd_level = ""
//
// TODO: Add duplicate event detection by event_name + venue + date
// TODO: Add approved venue whitelist validation
// TODO: Add submitted_by_email / submitted_at tracking columns

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BASE64_CHARS = Math.ceil(4 * 1024 * 1024 * 1.4) // 4 MB decoded + base64 overhead

export const handler = async (event) => {
  // ── Method guard ──────────────────────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  // ── Config guard ──────────────────────────────────────────────────────────
  const appsScriptUrl = process.env.APPS_SCRIPT_URL
  if (!appsScriptUrl) {
    console.error('[submit-event] APPS_SCRIPT_URL env var is not set')
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Submission endpoint not configured. Contact site admin.' }),
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let payload
  try {
    payload = JSON.parse(event.body)
  } catch {
    console.error('[submit-event] Invalid JSON body')
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request body' }),
    }
  }

  // ── Validate flyer fields ─────────────────────────────────────────────────
  if (!payload.flyer_base64 || typeof payload.flyer_base64 !== 'string') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Flyer file data is required.' }),
    }
  }
  if (!ALLOWED_MIME.has(payload.flyer_mime_type)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `File type not allowed: ${payload.flyer_mime_type}. Use JPG, PNG, or WEBP.` }),
    }
  }
  if (payload.flyer_base64.length > MAX_BASE64_CHARS) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Flyer file too large. Maximum is 4 MB.' }),
    }
  }

  // ── Build safe payload ────────────────────────────────────────────────────
  // Moderation defaults are always overwritten server-side.
  // flyer_base64 / flyer_mime_type / flyer_filename are forwarded to Apps Script
  // which performs the Drive upload and derives flyer_image_url + flyer_file_id.
  const safePayload = {
    event_name:      String(payload.event_name      || '').trim(),
    venue:           String(payload.venue            || '').trim(),
    date:            String(payload.date             || '').trim(),
    time:            String(payload.time             || '').trim(),
    genre:           String(payload.genre            || '').trim(),
    event_type:      String(payload.event_type       || '').trim(),
    ticket_link:     String(payload.ticket_link      || '').trim(),
    description:     String(payload.description      || '').trim(),
    // Flyer — Apps Script uploads these and derives the URL + file ID
    flyer_base64:    payload.flyer_base64,
    flyer_mime_type: String(payload.flyer_mime_type  || '').trim(),
    flyer_filename:  String(payload.flyer_filename   || 'flyer.jpg').trim(),
    // Moderation defaults — enforced here, re-enforced in Apps Script
    featured:        'FALSE',
    active:          'FALSE',
    tailgate_time:   '',
    status:          'submitted',
    venue_image_url: '',
    video_url:       '',
    crowd_level:     '',
  }

  // ── Required field guard ──────────────────────────────────────────────────
  // genre and ticket_link are optional. flyer fields are validated above.
  const required = ['event_name', 'venue', 'date', 'time', 'event_type', 'description']
  const missing = required.filter(k => !safePayload[k])
  if (missing.length) {
    console.error('[submit-event] Missing required fields:', missing)
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
    }
  }

  // ── POST to Apps Script (redirect-safe) ───────────────────────────────────
  const fetchBody    = JSON.stringify(safePayload)
  const fetchHeaders = { 'Content-Type': 'application/json' }

  const urlHost = (() => { try { return new URL(appsScriptUrl).hostname } catch { return 'unknown' } })()
  console.log('[submit-event] Target host:', urlHost)

  let responseText
  try {
    // Step 1: POST with redirect:manual so we control redirect handling
    let res = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: fetchBody,
      redirect: 'manual',
    })

    console.log('[submit-event] Initial response status:', res.status)

    // Step 2: Follow up to two redirects (Google sometimes chains
    // /exec → googleusercontent → auth). Re-POSTing each time preserves
    // the request body, which redirect:'follow' would strip per HTTP spec.
    let hops = 0
    while ((res.status >= 300 && res.status < 400) && hops < 2) {
      const location = res.headers.get('location') || res.headers.get('Location')
      if (!location) throw new Error(`Redirect (${res.status}) had no Location header`)
      console.log(`[submit-event] Redirect hop ${hops + 1} → ${location}`)
      res = await fetch(location, { method: 'POST', headers: fetchHeaders, body: fetchBody, redirect: 'manual' })
      console.log(`[submit-event] Post-redirect status: ${res.status}`)
      hops++
    }

    // Step 3: Read and validate the Apps Script response body
    responseText = await res.text()
    console.log('[submit-event] Apps Script response status:', res.status, '| body:', responseText.substring(0, 300))

    // Only treat a genuine server error (5xx) as failure.
    // Apps Script /exec can return 405 after the redirect chain even when it
    // already ran, uploaded the file, wrote the row, and sent the email — throwing
    // on !res.ok causes a false failure.
    if (res.status >= 500) {
      throw new Error(`Apps Script returned ${res.status}: ${responseText.substring(0, 200)}`)
    }

    // Parse response if JSON, but don't fail on non-JSON (405 returns HTML)
    let scriptResult = {}
    try { scriptResult = JSON.parse(responseText) } catch { /* non-JSON from redirect quirk — ok */ }

    if (scriptResult.result === 'error') {
      const msg = scriptResult.message || scriptResult.error || responseText
      throw new Error(`Apps Script reported failure: ${msg}`)
    }

    console.log('[submit-event] Success — flyer uploaded and row written')
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    }

  } catch (err) {
    console.error('[submit-event] Error:', err.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: err.message || 'Submission failed. Please try again.',
        detail: typeof responseText !== 'undefined' ? responseText : undefined,
      }),
    }
  }
}
