// netlify/functions/submit-event.js
// Receives event submission from the front-end form, then forwards the payload
// to a Google Apps Script web-app URL which appends a row to the Events sheet.
//
// Required Netlify env var (set in Netlify dashboard → Site settings → Env vars):
//   APPS_SCRIPT_URL  — The deployed Apps Script URL ending in /exec
//
// The Apps Script should:
//   1. Accept POST with Content-Type: application/json
//   2. Append the payload as a new row in the Events sheet using the column order:
//      event_name, venue, date, time, genre, event_type, ticket_link,
//      flyer_image_url, featured, active, tailgate_time, status,
//      venue_image_url, video_url, crowd_level, description
//   3. Return { "result": "success" } on success
//
// Moderation flow (enforced by front-end defaults, never overridable by submitter):
//   status = pending   → submitted, not yet live
//   status = approved  → admin-approved, visible on site when active = TRUE
//   status = rejected  → hidden
//   active = FALSE     → never displayed even if approved (admin must flip to TRUE)
//
// TODO: Add duplicate event detection by event_name + venue + date
// TODO: Add approved venue whitelist validation
// TODO: Add submitted_by_email / submitted_at tracking columns

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_URL
  if (!appsScriptUrl) {
    console.error('APPS_SCRIPT_URL env var is not set')
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Submission endpoint not configured. Contact site admin.' }),
    }
  }

  let payload
  try {
    payload = JSON.parse(event.body)
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid request body' }),
    }
  }

  // Enforce moderation defaults — these values must never be overridable by
  // the submitter, regardless of what the front-end sends.
  const safePayload = {
    event_name:      String(payload.event_name      || '').trim(),
    venue:           String(payload.venue            || '').trim(),
    date:            String(payload.date             || '').trim(),
    time:            String(payload.time             || '').trim(),
    genre:           String(payload.genre            || '').trim(),
    event_type:      String(payload.event_type       || '').trim(),
    ticket_link:     String(payload.ticket_link      || '').trim(),
    flyer_image_url: String(payload.flyer_image_url  || '').trim(),
    // These are always forced to safe defaults — admin sets them in Sheets
    featured:        'FALSE',
    active:          'FALSE',
    tailgate_time:   '',
    status:          'pending',
    venue_image_url: '',  // Future: support venue image upload
    video_url:       '',
    crowd_level:     '',
    description:     String(payload.description      || '').trim(),
  }

  // Basic server-side required field guard
  const required = ['event_name', 'venue', 'date', 'time', 'genre', 'event_type', 'flyer_image_url', 'description']
  const missing = required.filter(k => !safePayload[k])
  if (missing.length) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
    }
  }

  try {
    const res = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safePayload),
      redirect: 'follow',
    })
    const text = await res.text()

    if (!res.ok) {
      console.error('Apps Script error:', res.status, text)
      throw new Error(`Apps Script returned ${res.status}`)
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    }
  } catch (err) {
    console.error('submit-event error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Submission failed. Please try again.' }),
    }
  }
}
