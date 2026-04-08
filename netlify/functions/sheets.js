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

/**
 * The gviz response is JSONP-style:
 *   /*O_o*\/\ngoogle.visualization.Query.setResponse({...});
 * Strip the wrapper and parse.
 */
function parseGviz(raw) {
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Invalid gviz response')
  return JSON.parse(raw.slice(start, end + 1))
}

/**
 * Convert gviz table → array of plain objects keyed by column label.
 */
function gvizToRows(table) {
  if (!table || !table.cols || !table.rows) return []

  const cols = table.cols.map(c => (c.label || '').trim())
  const rows = table.rows

  // Normalise column names to snake_case keys
  const keys = cols.map(l => l.toLowerCase().replace(/\s+/g, '_'))

  return rows
    .map(row => {
      const obj = {}
      keys.forEach((key, i) => {
        const cell = row.c && row.c[i]
        // Prefer cell.f (formatted display value) — handles gviz Date() objects
        // gracefully, returning e.g. "3/20/2026" instead of "Date(2026,2,20)".
        // Use || not ?? so that cell.f = "" (empty string, which gviz returns for
        // boolean checkbox cells) falls through to cell.v (true/false boolean).
        // ?? would keep the empty string and lose the boolean value entirely.
        const raw = cell != null ? (cell.f || cell.v) : null
        obj[key] = raw !== null && raw !== undefined ? String(raw).trim() : ''
      })
      return obj
    })
    .filter(row => Object.values(row).some(v => v !== '')) // skip blank rows
}

// ── Image URL transformer ─────────────────────────────────────────────────

function convertDriveUrl(url) {
  if (!url) return ''
  // https://drive.google.com/file/d/{ID}/view?... → direct image
  const match = url.match(/\/d\/([^/]+)\//)
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`
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
    // video_url is a TikTok link — pass through unchanged
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
// Uses Promise.allSettled so one failing tab never kills the whole payload.
// Each tab falls back to [] independently; the response is always HTTP 200.

export const handler = async () => {
  const [eventsResult, venuesResult, watchfestResult, barcrawlResult] =
    await Promise.allSettled([
      fetchTab(TABS.events),
      fetchTab(TABS.venues),
      fetchTab(TABS.watchfest),
      fetchTab(TABS.barcrawl),
    ])

  // Per-tab diagnostics — visible in Netlify function logs
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
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(payload),
  }
}
