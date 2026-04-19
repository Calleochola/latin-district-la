// netlify/functions/upload-flyer.js
// Receives a base64-encoded image from the event submission form, uploads it
// to Google Drive via a service account, sets the file to public-read, and
// returns a stable URL + file ID for storage in the Events sheet.
//
// ── Required Netlify env vars ─────────────────────────────────────────────────
//   GOOGLE_SERVICE_ACCOUNT_KEY  — Full service account JSON as a single-line string
//                                 (paste the downloaded key file contents, minified)
//   DRIVE_FLYER_FOLDER_ID       — (optional) Drive folder ID to organise uploaded flyers.
//                                 If blank, files land in the service account's root.
//
// ── Setting up the service account ───────────────────────────────────────────
//   1. Google Cloud Console → IAM & Admin → Service Accounts → Create
//   2. Grant no roles (Drive uses per-file / per-folder permissions, not IAM roles)
//   3. Keys tab → Add Key → JSON → download the file
//   4. Enable Google Drive API in the project (APIs & Services → Library)
//   5. Copy the downloaded JSON content (minified) into GOOGLE_SERVICE_ACCOUNT_KEY
//   6. In Google Drive, create a folder for flyers, share it with the service
//      account email (client_email in the JSON) as Editor.
//   7. Copy the folder ID from its URL into DRIVE_FLYER_FOLDER_ID.
//
// ── File constraints (also enforced client-side) ─────────────────────────────
//   Max decoded size: 4 MB  (base64 overhead keeps the request under Netlify's 6 MB body limit)
//   Allowed types:    image/jpeg  image/png  image/webp  image/gif
//   HEIC is blocked   — browsers cannot render it even if Drive stores it fine.
//
// ── Returns ───────────────────────────────────────────────────────────────────
//   200  { ok: true, flyer_image_url, flyer_file_id }
//   4xx  { error: string }   — validation failure; do NOT create a sheet row
//   5xx  { error: string }   — Drive API failure; do NOT create a sheet row
//
// ── Orphan files ─────────────────────────────────────────────────────────────
//   If the upload succeeds but the subsequent form POST fails, a Drive file will
//   exist with no matching sheet row.  The flyer_file_id stored in the sheet for
//   successful submissions enables future admin cleanup or deletion tooling.

import { createSign } from 'crypto'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_DECODED_BYTES = 4 * 1024 * 1024 // 4 MB

// ── JWT / OAuth2 helpers ──────────────────────────────────────────────────────

function b64url(str) {
  return Buffer.from(str, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getDriveAccessToken(serviceKey) {
  const { client_email, private_key } = serviceKey
  const now = Math.floor(Date.now() / 1000)

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss:   client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  }))

  const sigInput = `${header}.${claims}`
  const signer = createSign('RSA-SHA256')
  signer.write(sigInput)
  signer.end()
  const sig = signer.sign(private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${sigInput}.${sig}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenJson = await tokenRes.json()
  if (!tokenJson.access_token) {
    const detail = tokenJson.error_description || tokenJson.error || JSON.stringify(tokenJson)
    throw new Error(`Drive auth failed: ${detail}`)
  }
  return tokenJson.access_token
}

// ── Drive API helpers ─────────────────────────────────────────────────────────

async function uploadFileToDrive(token, fileBuffer, mimeType, filename, folderId) {
  const meta = JSON.stringify({
    name: filename,
    ...(folderId ? { parents: [folderId] } : {}),
  })
  const boundary = `LALD_FLYER_${Date.now()}`
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      'utf8'
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--`, 'utf8'),
  ])

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Drive upload failed (${res.status}): ${text.substring(0, 300)}`)
  }
  return await res.json() // { id }
}

async function makeFilePublic(token, fileId) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Drive permission set failed (${res.status}): ${text.substring(0, 200)}`)
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  // ── Config guard ───────────────────────────────────────────────────────────
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!rawKey) {
    console.error('[upload-flyer] GOOGLE_SERVICE_ACCOUNT_KEY is not set')
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upload service not configured. Contact site admin.' }),
    }
  }

  let serviceKey
  try {
    serviceKey = JSON.parse(rawKey)
  } catch {
    console.error('[upload-flyer] GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON')
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upload service misconfigured. Contact site admin.' }),
    }
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
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

  const { base64, mimeType, filename } = payload

  // ── MIME type validation ───────────────────────────────────────────────────
  if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: `File type not allowed: ${mimeType || '(none)'}. Please upload JPG, PNG, or WEBP.`,
      }),
    }
  }

  // ── Decode and size-check ──────────────────────────────────────────────────
  if (!base64 || typeof base64 !== 'string') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing file data' }),
    }
  }

  let fileBuffer
  try {
    fileBuffer = Buffer.from(base64, 'base64')
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid file data' }),
    }
  }

  if (fileBuffer.length > MAX_DECODED_BYTES) {
    const mb = (fileBuffer.length / 1024 / 1024).toFixed(1)
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `File too large (${mb} MB). Maximum is 4 MB.` }),
    }
  }

  // ── Upload to Drive ────────────────────────────────────────────────────────
  const safeName = `flyer_${Date.now()}_${(filename || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const folderId = process.env.DRIVE_FLYER_FOLDER_ID || ''

  try {
    console.log('[upload-flyer] Authenticating with Drive...')
    const token = await getDriveAccessToken(serviceKey)

    console.log('[upload-flyer] Uploading file:', safeName, `(${(fileBuffer.length / 1024).toFixed(0)} KB)`)
    const { id: fileId } = await uploadFileToDrive(token, fileBuffer, mimeType, safeName, folderId)

    console.log('[upload-flyer] Setting public permission on:', fileId)
    await makeFilePublic(token, fileId)

    const flyer_image_url = `https://drive.google.com/uc?export=view&id=${fileId}`
    console.log('[upload-flyer] Upload complete:', flyer_image_url)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, flyer_image_url, flyer_file_id: fileId }),
    }
  } catch (err) {
    console.error('[upload-flyer] Drive error:', err.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Flyer upload failed. Please try again.' }),
    }
  }
}
