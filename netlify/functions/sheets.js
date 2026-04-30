// netlify/functions/sheets.js
// Fetches all 4 tabs from the Google Sheet using the public gviz JSON API.
// No API key required — sheet must be set to "Anyone with the link can view".

const SHEET_ID = '1kTmZVGB8Qz9Xy8za6A18GE_NzWvEKFqHHkdSTfbnvcM'

const TABS = {
  events:    'Events',
  venues:    'Venues',
  watchfest: 'WatchFest',
  barcrawl:  'BarCrawl',
}

// ── gviz helpers ──────────────────────────────────────────────────────────

function buildUrl(sheetName) {
  const encoded = encodeURIComponent(sheetName)
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encoded}`
}

function parseGviz(raw) {
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Invalid gviz response')
  return JSON.parse(raw.slice(start, end + 1))
}

function gvizToRows(table) {
  if (!table || !table.cols || !table.rows) return []

  const cols = table.cols.map(c => (c.label || '').trim())
  const rows = table.rows
  const keys = cols.map(l => l.toLowerCase().replace(/\s+/g, '_'))

  return rows
    .map(row => {
      const obj = {}
      keys.forEach((key, i) => {
        const cell = row.c && row.c[i]
        const raw = cell != null ? (cell.f || cell.v) : null
        obj[key] = raw !== null && raw !== undefined ? String(raw).trim() : ''
      })
      return obj
    })
    .filter(row => Object.values(row).some(v => v !== ''))
}

// ── Image URL transformer ─────────────────────────────────────────────────
//
// Extracts a Drive file ID from ANY known Drive URL format and returns
// the lh3.googleusercontent.com CDN URL — the only format that reliably
// renders in <img> tags without auth or redirects.
//
// Handles:
//   https://drive.google.com/file/d/{ID}/view          ← /d/ pattern
//   https://drive.google.com/open?id={ID}              ← ?id= pattern
//   https://drive.google.com/uc?export=view&id={ID}    ← uc pattern (deprecated)
//   https://lh3.googleusercontent.com/d/{ID}           ← already correct, pass through
//   raw file ID string (25+ chars, no slashes)
//
function convertDriveUrl(url) {
  if (!url) return ''

  // Already the correct CDN format — pass through
  if (url.includes('lh3.googleusercontent.com')) return url

  // Try all known Drive URL patterns to extract the file ID
  let fileId = null

  // /file/d/{ID}/  or  /d/{ID}/
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/)
  if (dMatch) fileId = dMatch[1]

  // ?id={ID} or &id={ID}  (covers open?id= and uc?export=view&id=)
  if (!fileId) {
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{25,})/)
    if (idMatch) fileId = idMatch[1]
  }

  // Raw file ID string (no slashes or query chars)
  if (!fileId && /^[a-zA-Z0-9_-]{25,}$/.test(url.trim())) {
    fileId = url.trim()
  }

  if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`

  // Unknown format — return as-is so nothing breaks silently
  return url
}

function transformEvents(rows) {
  return rows.map(r => ({
    ...r,
    flyer_image_url: convertDriveUrl(r.flyer_image_url),
  }))
}

function transformVenues(rows) {
  return rows.map(r => ({
    ...r,
    photo_url:       convertDriveUrl(r.photo_url),
    venue_image_url: convertDriveUrl(r.venue_image_url),
  }))
}

function transformWatchFest(rows) {
  return rows.map(r => ({
    ...r,
    flyer_image_url:  convertDriveUrl(r.flyer_image_url),
    venue_image_url:  convertDriveUrl(r.venue_image_url),
  }))
}

// ── Fetch one tab ─────────────────────────────────────────────────────────

async function fetchTab(name) {
  const url = buildUrl(name)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching tab "${name}"`)
  const raw  = await res.text()
  const json = parseGviz(raw)
  return gvizToRows(json.table)
}

// ── Handler ───────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const REFRESH_SECRET = process.env.REFRESH_CACHE_SECRET
  const params         = event.queryStringParameters || {}
  const isRefresh      = REFRESH_SECRET &&
                         params.refresh === '1' &&
                         params.token === REFRESH_SECRET

  const [eventsResult, venuesResult, watchfestResult, barcrawlResult] =
    await Promise.allSettled([
      fetchTab(TABS.events),
      fetchTab(TABS.venues),
      fetchTab(TABS.watchfest),
      fetchTab(TABS.barcrawl),
    ])

  for (const [name, result] of [
    [TABS.events,    eventsResult],
    [TABS.venues,    venuesResult],
    [TABS.watchfest, watchfestResult],
    [TABS.barcrawl,  barcrawlResult],
  ]) {
    if (result.status === 'fulfilled') {
      console.log(`[sheets] ${name}: ${result.value.length} rows`)
    } else {
      console.error(`[sheets] ${name}: FAILED — ${result.reason?.message}`)
    }
  }

  const eventsRaw    = eventsResult.status    === 'fulfilled' ? eventsResult.value    : []
  const venuesRaw    = venuesResult.status    === 'fulfilled' ? venuesResult.value    : []
  const watchfestRaw = watchfestResult.status === 'fulfilled' ? watchfestResult.value : []
  const barcrawlRaw  = barcrawlResult.status  === 'fulfilled' ? barcrawlResult.value  : []

  const payload = {
    events:    transformEvents(eventsRaw),
    venues:    transformVenues(venuesRaw),
    watchfest: transformWatchFest(watchfestRaw),
    barcrawl:  barcrawlRaw,
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type':  'application/json',
      'Cache-Control': isRefresh
        ? 'no-store'
        : 'public, s-maxage=3600, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(payload),
  }
}
