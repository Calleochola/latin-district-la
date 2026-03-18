// netlify/functions/contact.js
// Receives contact form submission from the frontend and forwards it to the
// Contact Form Apps Script Web App, which sends an email notification.
// Nothing is written to any Google Sheet.
//
// Required Netlify env var (Netlify dashboard → Site settings → Environment variables):
//   CONTACT_SCRIPT_URL — the deployed contact.gs /exec URL
//
// Uses the same redirect-safe POST pattern as submit-event.js:
// Apps Script /exec responds with a 302 before executing. Re-POSTing to the
// Location URL preserves the request body (redirect:'follow' strips it).

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  const contactScriptUrl = process.env.CONTACT_SCRIPT_URL
  if (!contactScriptUrl) {
    console.error('[contact] CONTACT_SCRIPT_URL env var is not set')
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Contact endpoint not configured. Contact site admin.' }),
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

  // Only pass known fields — never forward arbitrary data
  const safePayload = {
    name:    String(payload.name    || '').trim(),
    email:   String(payload.email   || '').trim(),
    company: String(payload.company || '').trim(),
    type:    String(payload.type    || '').trim(),
    subject: String(payload.subject || '').trim(),
    message: String(payload.message || '').trim(),
  }

  const required = ['name', 'email', 'subject', 'message']
  const missing  = required.filter(k => !safePayload[k])
  if (missing.length) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` }),
    }
  }

  const fetchBody    = JSON.stringify(safePayload)
  const fetchHeaders = { 'Content-Type': 'application/json' }

  try {
    let res = await fetch(contactScriptUrl, {
      method: 'POST',
      headers: fetchHeaders,
      body: fetchBody,
      redirect: 'manual',
    })

    console.log('[contact] Initial response status:', res.status)

    let hops = 0
    while ((res.status >= 300 && res.status < 400) && hops < 2) {
      const location = res.headers.get('location') || res.headers.get('Location')
      if (!location) throw new Error(`Redirect (${res.status}) had no Location header`)
      console.log(`[contact] Redirect hop ${hops + 1} → ${location}`)
      res = await fetch(location, { method: 'POST', headers: fetchHeaders, body: fetchBody, redirect: 'manual' })
      hops++
    }

    const responseText = await res.text()
    console.log('[contact] Apps Script response status:', res.status, '| body:', responseText.substring(0, 300))

    // Only treat a genuine server error (5xx) as failure.
    // Apps Script /exec can return 405 after the redirect chain even when it
    // already ran and sent the email — throwing on !res.ok causes a false failure.
    if (res.status >= 500) {
      throw new Error(`Contact endpoint returned ${res.status}: ${responseText.substring(0, 200)}`)
    }

    // Parse response if JSON, but don't fail on non-JSON (405 returns HTML)
    let scriptResult = {}
    try { scriptResult = JSON.parse(responseText) } catch { /* non-JSON from redirect quirk — ok */ }

    if (scriptResult.result === 'error') {
      throw new Error(scriptResult.message || 'Contact Apps Script reported an error')
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    }

  } catch (err) {
    console.error('[contact] Error:', err.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Contact form failed. Please try again.' }),
    }
  }
}
