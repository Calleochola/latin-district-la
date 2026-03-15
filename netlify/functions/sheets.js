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
 *
 * gviz behaviour notes:
 *  - When the sheet has data rows, cols[].label is populated from row 1 (the
 *    header row) and table.rows contains only data rows.
 *  - When the sheet has ONLY a header row (no data rows yet), gviz returns
 *    generic col IDs ("a","b"…) and puts the header values in row 0.
 *    We detect this and promote row 0 to headers automatically.
 */
function gvizToRows(table) {
  if (!table || !table.cols || !table.rows) return []

  let cols = table.cols.map(c => (c.label || '').trim())
  let rows = table.rows

  // If all labels are empty, gviz didn't pick up headers — treat first data
  // row as the header row (happens when there are no data rows in the sheet).
  const hasLabels = cols.some(l => l !== '')
  if (!hasLabels && rows.length > 0) {
    const headerRow = rows[0]
    cols = (headerRow.c || []).map(cell =>
      cell && cell.v != null ? String(cell.v).trim() : ''
    )
    rows = rows.slice(1) // remaining rows are actual data
  }

  // Normalise column names to snake_case keys
  const keys = cols.map(l => l.toLowerCase().replace(/\s+/g, '_'))

  return rows
    .map(row => {
      const obj = {}
      keys.forEach((key, i) => {
        const cell = row.c && row.c[i]
        // Prefer cell.f (formatted display value) — handles gviz Date() objects
        // gracefully, returning e.g. "3/20/2026" instead of "Date(2026,2,20)"
        const raw = cell != null ? (cell.f ?? cell.v) : null
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
    photo_url: convertDriveUrl(r.photo_url),
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

export const handler = async () => {
  try {
    const [eventsRaw, venuesRaw, watchfestRaw, barcrawlRaw] = await Promise.all([
      fetchTab(TABS.events),
      fetchTab(TABS.venues),
      fetchTab(TABS.watchfest),
      fetchTab(TABS.barcrawl),
    ])

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
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(payload),
    }
  } catch (err) {
    console.error('sheets function error:', err)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
