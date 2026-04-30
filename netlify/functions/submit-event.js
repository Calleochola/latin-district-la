// netlify/functions/submit-event.js
// Receives event form data from the website.
// Uploads the flyer to ImageKit, then forwards everything to the
// Apps Script web app which writes the row to the Events sheet.

const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: 'Method Not Allowed' }
  }

  try {
    const body = JSON.parse(event.body)
    const {
      eventName,
      venue,
      date,
      time,
      genre,
      eventType,
      ticketLink,
      description,
      flyerBase64,    // full data URI: "data:image/jpeg;base64,..."
      flyerFileName,  // original filename e.g. "flyer.jpg"
    } = body

    const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY
    const APPS_SCRIPT_URL      = process.env.APPS_SCRIPT_URL

    if (!IMAGEKIT_PRIVATE_KEY) throw new Error('IMAGEKIT_PRIVATE_KEY not set')
    if (!APPS_SCRIPT_URL)      throw new Error('APPS_SCRIPT_URL not set')

    // ── 1. Upload flyer to ImageKit ──────────────────────────────────────────
    let flyerUrl = ''

    if (flyerBase64 && flyerFileName) {
      const auth = Buffer.from(IMAGEKIT_PRIVATE_KEY + ':').toString('base64')

      // Build a safe filename: timestamp + sanitised original name
      const safeName = `${Date.now()}-${flyerFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

      const formData = new FormData()
      formData.append('file',            flyerBase64)           // base64 data URI
      formData.append('fileName',        safeName)
      formData.append('folder',          '/latin-district-flyers/')
      formData.append('useUniqueFileName', 'false')             // we already made it unique

      const ikRes = await fetch(IMAGEKIT_UPLOAD_URL, {
        method:  'POST',
        headers: { Authorization: `Basic ${auth}` },
        body:    formData,
      })

      if (ikRes.ok) {
        const ikData = await ikRes.json()
        flyerUrl = ikData.url || ''
        console.log('[submit-event] ImageKit upload OK:', flyerUrl)
      } else {
        const ikErr = await ikRes.text()
        console.error('[submit-event] ImageKit upload failed:', ikErr)
        // Don't block the submission — row will just have no flyer URL
      }
    }

    // ── 2. Forward to Apps Script web app ────────────────────────────────────
    const payload = {
      eventName,
      venue,
      date,
      time,
      genre,
      eventType,
      ticketLink,
      description,
      flyerImageUrl: flyerUrl,
    }

    const asRes = await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      redirect: 'follow',
    })

    if (!asRes.ok) {
      const asErr = await asRes.text()
      console.error('[submit-event] Apps Script error:', asErr)
      throw new Error('Apps Script write failed')
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ success: true, flyerUrl }),
    }

  } catch (err) {
    console.error('[submit-event] ERROR:', err.message)
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ success: false, error: err.message }),
    }
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
}
