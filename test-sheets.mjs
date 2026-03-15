// Quick local test for the Sheets function logic.
// Run with: node test-sheets.mjs
// Set MOCK=1 to skip the network call and use local test data instead:
//   MOCK=1 node test-sheets.mjs

const SHEET_ID = '1kTmZVGB8Qz9Xy8za6A18GE_NzWvEKFqHHkdSTfbnvcM'

const TABS = {
  events:    'Events',
  venues:    'Venues',
  watchfest: 'WatchFest',
  barcrawl:  'BarCrawl',
}

// ── Mock data (mirrors exact sheet column headers) ────────────────────────

const MOCK = {
  events: [
    {
      event_name:      'Reggaeton Fridays',
      venue:           'Rhythm Room LA',
      date:            '2026-03-20',
      time:            '10:00 PM',
      genre:           'Reggaeton',
      event_type:      'friday_night',
      ticket_link:     'https://ra.co/example',
      flyer_image_url: '',
      featured:        'yes',
      active:          'yes',
    },
    {
      event_name:      'Salsa Saturdays',
      venue:           'The Grayson',
      date:            '2026-03-21',
      time:            '9:00 PM',
      genre:           'Salsa',
      event_type:      'special',
      ticket_link:     'https://ra.co/example2',
      flyer_image_url: '',
      featured:        'yes',
      active:          'yes',
    },
    {
      event_name:      'Champions League Watch Party',
      venue:           'Las Perlas',
      date:            '2026-03-18',
      time:            '2:45 PM',
      genre:           '',
      event_type:      'watch_fest',
      ticket_link:     '',
      flyer_image_url: '',
      featured:        'no',
      active:          'yes',
    },
    {
      event_name:      'Latin District Bar Crawl',
      venue:           'Multiple Venues',
      date:            '2026-03-20',
      time:            '8:00 PM',
      genre:           'Mixed',
      event_type:      'crawl',
      ticket_link:     'https://example.com/crawl',
      flyer_image_url: '',
      featured:        'yes',
      active:          'yes',
    },
  ],
  venues: [
    { venue_name: 'Rhythm Room LA',      tag: 'Dance Floor · DJ Sets',      description: 'The beating heart of the Latin District — floor-to-ceiling sound and the hottest DJ sets in DTLA.', photo_url: '', instagram: '@rhythmroomla', active: 'yes' },
    { venue_name: 'Las Perlas',           tag: 'Mezcal Bar · Cocktails',     description: 'Award-winning mezcal and cocktail bar with a distinctly Latin soul.', photo_url: '', instagram: '@lasperlasla', active: 'yes' },
    { venue_name: 'The Grayson',          tag: 'Dancehall · Live Sound',     description: 'Massive dance floor, live sound, and some of the best DJ talent in LA every Friday.', photo_url: '', instagram: '@thegraysonla', active: 'yes' },
    { venue_name: 'Spring Street Bar',    tag: 'Neighborhood Bar',           description: 'No-frills neighborhood bar at the center of the action.', photo_url: '', instagram: '', active: 'yes' },
    { venue_name: 'Broken Shaker',        tag: 'Craft Cocktails · Patio',    description: 'Lush patio setting with expertly crafted cocktails — perfect for the crawl.', photo_url: '', instagram: '@brokenshaker', active: 'yes' },
  ],
  watchfest: [
    { match_name: 'Champions League Final',    date: '2026-05-30', time: '2:00 PM', venue: 'Rhythm Room LA', status: 'Coming Soon', flagship: 'yes' },
    { match_name: 'El Clásico — Real vs Barça', date: '2026-04-12', time: '9:00 AM', venue: 'Las Perlas',     status: 'Get Tickets', flagship: 'no' },
    { match_name: 'Copa América Group Stage',   date: '2026-06-15', time: '6:00 PM', venue: 'The Grayson',   status: 'Free',        flagship: 'no' },
    { match_name: 'World Cup Opener',           date: '2026-06-11', time: '5:00 PM', venue: 'Rhythm Room LA', status: 'RSVP',       flagship: 'no' },
  ],
  barcrawl: [
    { stop_number: '1', venue_name: 'Rhythm Room LA',   vibe: 'Dance Floor',        drink_special: '$5 Modelo / $8 Margaritas', active: 'yes' },
    { stop_number: '2', venue_name: 'Las Perlas',        vibe: 'Mezcal Lounge',      drink_special: '2-for-1 Mezcal Negronis',   active: 'yes' },
    { stop_number: '3', venue_name: 'The Grayson',       vibe: 'High Energy',        drink_special: '$6 Tequila Shots',          active: 'yes' },
    { stop_number: '4', venue_name: 'Spring Street Bar', vibe: 'Chill Neighborhood', drink_special: '$4 Cervezas all night',     active: 'yes' },
    { stop_number: '5', venue_name: 'Broken Shaker',     vibe: 'Craft Patio',        drink_special: '$10 Signature Crawl Drink', active: 'yes' },
    { stop_number: '6', venue_name: 'Caña Rum Bar',      vibe: 'Latin Roots',        drink_special: '$7 Rum & Coke specials',    active: 'yes' },
  ],
}

// ── gviz helpers ──────────────────────────────────────────────────────────

function buildUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`
}

function parseGviz(raw) {
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  return JSON.parse(raw.slice(start, end + 1))
}

function gvizToRows(table) {
  if (!table?.cols || !table?.rows) return []

  let cols = table.cols.map(c => (c.label || '').trim())
  let rows = table.rows

  const hasLabels = cols.some(l => l !== '')
  if (!hasLabels && rows.length > 0) {
    const headerRow = rows[0]
    cols = (headerRow.c || []).map(cell =>
      cell && cell.v != null ? String(cell.v).trim() : ''
    )
    rows = rows.slice(1)
  }

  const keys = cols.map(l => l.toLowerCase().replace(/\s+/g, '_'))

  return rows
    .map(row => {
      const obj = {}
      keys.forEach((key, i) => {
        const cell = row.c?.[i]
        const raw = cell != null ? (cell.f ?? cell.v) : null
        obj[key] = raw !== null && raw !== undefined ? String(raw).trim() : ''
      })
      return obj
    })
    .filter(row => Object.values(row).some(v => v !== ''))
}

function convertDriveUrl(url) {
  if (!url) return ''
  const match = url.match(/\/d\/([^/]+)\//)
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`
  return url
}

async function fetchTab(name) {
  const res = await fetch(buildUrl(name))
  const raw = await res.text()
  const json = parseGviz(raw)
  return gvizToRows(json.table)
}

// ── Run ───────────────────────────────────────────────────────────────────

const useMock = process.env.MOCK === '1'

if (useMock) {
  console.log('📋 Using mock data (not hitting the sheet)\n')
  for (const [key, rows] of Object.entries(MOCK)) {
    console.log(`✅ ${key}: ${rows.length} rows`)
    if (rows.length > 0) {
      console.log(`   Columns: ${Object.keys(rows[0]).join(', ')}`)
      console.log(`   First row:`, rows[0])
    }
    console.log()
  }
} else {
  console.log(`🌐 Fetching from Google Sheets (Sheet ID: ${SHEET_ID})\n`)
  const results = {}
  for (const [key, name] of Object.entries(TABS)) {
    try {
      const rows = await fetchTab(name)
      // apply same transforms as the function
      if (key === 'events') rows.forEach(r => r.flyer_image_url = convertDriveUrl(r.flyer_image_url))
      if (key === 'venues') rows.forEach(r => r.photo_url = convertDriveUrl(r.photo_url))
      results[key] = rows
      console.log(`✅ ${name}: ${rows.length} rows`)
      if (rows.length > 0) {
        console.log(`   Columns: ${Object.keys(rows[0]).join(', ')}`)
        console.log(`   First row:`, rows[0])
      } else {
        console.log(`   (no data rows — add rows in the sheet to see them here)`)
      }
    } catch (e) {
      console.error(`❌ ${name}: ${e.message}`)
      results[key] = []
    }
    console.log()
  }
}
