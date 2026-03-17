// netlify/functions/submit-event.js
// Receives event submission from the front-end form, then forwards the payload
// to a Google Apps Script Web App which appends a row to the Events sheet.
//
// Required Netlify env var (Netlify dashboard → Site settings → Environment variables):
//   APPS_SCRIPT_URL  — The deployed Apps Script /exec URL
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
// Events sheet column schema (exact order — must match Apps Script appendRow):
//   event_name, venue, date, time, genre, event_type, ticket_link,
//   flyer_image_url, featured, active, tailgate_time, status,
//   venue_image_url, video_url, crowd_level, description
//
// Moderation defaults (enforced server-side, never overridable by submitter):
//   featured = FALSE  |  active = FALSE  |  status = pending
//   tailgate_time = ""  |  venue_image_url = ""  |  video_url = ""  |  crowd_level = ""
//
// TODO: Add duplicate event detection by event_name + venue + date
// TODO: Add approved venue whitelist validation
// TODO: Add submitted_by_email / submitted_at tracking columns

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

  // ── Enforce moderation defaults ───────────────────────────────────────────
  // These values are always overwritten server-side regardless of what the
  // front-end sends. Admin sets featured/active/status in the sheet directly.
  const safePayload = {
    event_name:      String(payload.event_name      || '').trim(),
    venue:           String(payload.venue            || '').trim(),
    date:            String(payload.date             || '').trim(),
    time:            String(payload.time             || '').trim(),
    genre:           String(payload.genre            || '').trim(),
    event_type:      String(payload.event_type       || '').trim(),
    ticket_link:     String(payload.ticket_link      || '').trim(),
    flyer_image_url: String(payload.flyer_image_url  || '').trim(),
    featured:        'FALSE',
    active:          'FALSE',
    tailgate_time:   '',
    status:          'pending',
    venue_image_url: '',
    video_url:       '',
    crowd_level:     '',
    description:     String(payload.description      || '').trim(),
  }

  // ── Required field guard ──────────────────────────────────────────────────
  const required = ['event_name', 'venue', 'date', 'time', 'genre', 'event_type', 'flyer_image_url', 'description']
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
  const fetchBody = JSON.stringify(safePayload)
  const fetchHeaders = { 'Content-Type': 'application/json' }

  const urlHost = (() => { try { return new URL(appsScriptUrl).hostname } catch { return 'unknown' } })()
  console.log('[submit-event] Target host:', urlHost)

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
    const responseText = await res.text()
    console.log('[submit-event] Apps Script raw response:', responseText)

    if (!res.ok) {
      throw new Error(`Apps Script returned HTTP ${res.status}: ${responseText}`)
    }

    // Verify Apps Script confirms success in its response body
    let scriptResult
    try {
      scriptResult = JSON.parse(responseText)
    } catch {
      throw new Error(`Apps Script returned non-JSON response: ${responseText}`)
    }

    if (scriptResult.result !== 'success') {
      const msg = scriptResult.message || scriptResult.error || responseText
      throw new Error(`Apps Script reported failure: ${msg}`)
    }

    console.log('[submit-event] Success — row written to sheet')
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
