/**
 * Latin District LA — Google Sheet Setup Script
 *
 * HOW TO RUN:
 * 1. Open your Google Sheet
 * 2. Click Extensions → Apps Script
 * 3. Delete any existing code in the editor
 * 4. Paste this entire file
 * 5. Click Save (floppy disk icon)
 * 6. Click Run (▶ play button) — authorize when prompted
 * 7. Done! Refresh your sheet and you'll see all 4 tabs with test data.
 */

function setupLatinDistrictSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Tab definitions ────────────────────────────────────────────────────

  const TABS = [
    {
      name: 'Events',
      headers: ['event_name','venue','date','time','genre','event_type','ticket_link','flyer_image_url','featured','active'],
      rows: [
        ['Reggaeton Fridays',          'Rhythm Room LA',   '2026-03-20','10:00 PM','Reggaeton',     'friday_night','https://ra.co/example','','yes','yes'],
        ['Salsa Saturdays',            'The Grayson',      '2026-03-21','9:00 PM', 'Salsa',         'special',     '',                    '','yes','yes'],
        ['Latin District Bar Crawl',   'Multiple Venues',  '2026-03-20','8:00 PM', 'Mixed',         'crawl',       'https://example.com/crawl','','yes','yes'],
        ['Champions League Watch Party','Las Perlas',      '2026-03-18','2:45 PM', '',              'watch_fest',  '',                    '','no', 'yes'],
        ['Cumbia Nights',              'Caña Rum Bar',     '2026-03-27','9:00 PM', 'Cumbia',        'friday_night','',                    '','yes','yes'],
        ['Latin House Friday',         'Kiso',             '2026-03-20','11:00 PM','Latin House',   'friday_night','',                    '','no', 'yes'],
      ],
    },
    {
      name: 'Venues',
      headers: ['venue_name','tag','description','photo_url','instagram','active'],
      rows: [
        ['Rhythm Room LA',      'Dance Floor · DJ Sets',       'The beating heart of the Latin District — floor-to-ceiling sound and the hottest DJ sets in DTLA.','','@rhythmroomla','yes'],
        ['Las Perlas',          'Mezcal Bar · Cocktails',      'Award-winning mezcal and cocktail bar with a distinctly Latin soul.','','@lasperlasla','yes'],
        ['The Grayson',         'Dancehall · Live Sound',      'Massive dance floor, live sound, and some of the best DJ talent in LA every Friday.','','@thegraysonla','yes'],
        ['Continental Club',    'Bar · Social',                'A social hub at the center of the district. Good drinks, great crowd.','','','yes'],
        ['Spring Street Bar',   'Neighborhood Bar',            'No-frills neighborhood bar at the center of the action.','','','yes'],
        ['Broken Shaker',       'Craft Cocktails · Patio',     'Lush patio setting with expertly crafted cocktails — perfect for the crawl.','','@brokenshaker','yes'],
        ['The Slipper Clutch',  'Raw · Unexpected',            'Gritty, honest, and one of a kind. A true DTLA original.','','','yes'],
        ['Caña Rum Bar',        'Rum · Latin Roots',           'Latin-rooted rum bar with deep soul and serious craft.','','@canarum','yes'],
        ['Chicka Bonita Lounge','Lounge · Groups',             'Intimate lounge perfect for groups, birthdays, and bachelorettes.','','','yes'],
        ['Kiso',                'Modern · DJ Sets',            'Sleek modern bar with forward-thinking DJ bookings every Friday.','','','yes'],
        ['Florentín Rooftop',   'Rooftop · Skyline Views',     'Sweeping skyline views and cool breezes above the DTLA grid.','','','yes'],
        ['A Toda Madre',        'Cultural · Bold',             'Unapologetically Latin, culturally rich, and boldly designed.','','','yes'],
        ['The Association',     'Underground · Original',      'The underground original. Raw energy, loyal crowd.','','','yes'],
      ],
    },
    {
      name: 'WatchFest',
      headers: ['match_name','date','time','venue','status','flagship'],
      rows: [
        ['Champions League Final',       '2026-05-30','2:00 PM', 'Rhythm Room LA','Coming Soon','yes'],
        ['El Clásico — Real vs Barça',   '2026-04-12','9:00 AM', 'Las Perlas',    'Get Tickets','no'],
        ['Copa América Group Stage',     '2026-06-15','6:00 PM', 'The Grayson',   'Free',       'no'],
        ['World Cup Opener',             '2026-06-11','5:00 PM', 'Rhythm Room LA','RSVP',       'no'],
        ['Concacaf Nations League Final','2026-03-23','6:00 PM', 'Continental Club','Get Tickets','no'],
      ],
    },
    {
      name: 'BarCrawl',
      headers: ['stop_number','venue_name','vibe','drink_special','active'],
      rows: [
        ['1','Rhythm Room LA',   'Dance Floor',        '$5 Modelo / $8 Margaritas',  'yes'],
        ['2','Las Perlas',       'Mezcal Lounge',      '2-for-1 Mezcal Negronis',    'yes'],
        ['3','The Grayson',      'High Energy',        '$6 Tequila Shots',           'yes'],
        ['4','Spring Street Bar','Chill Neighborhood', '$4 Cervezas all night',      'yes'],
        ['5','Broken Shaker',    'Craft Patio',        '$10 Signature Crawl Drink',  'yes'],
        ['6','Caña Rum Bar',     'Latin Roots',        '$7 Rum & Coke specials',     'yes'],
      ],
    },
  ]

  // ── Build each tab ─────────────────────────────────────────────────────

  TABS.forEach(tab => {
    // Get or create the sheet
    let sheet = ss.getSheetByName(tab.name)
    if (!sheet) {
      sheet = ss.insertSheet(tab.name)
    } else {
      sheet.clearContents()
    }

    // Write headers in row 1 (bold, frozen)
    const headerRange = sheet.getRange(1, 1, 1, tab.headers.length)
    headerRange.setValues([tab.headers])
    headerRange.setFontWeight('bold')
    headerRange.setBackground('#1a1a2e')
    headerRange.setFontColor('#00E5FF')
    sheet.setFrozenRows(1)

    // Write data rows starting at row 2
    if (tab.rows.length > 0) {
      sheet.getRange(2, 1, tab.rows.length, tab.headers.length).setValues(tab.rows)
    }

    // Auto-resize columns
    for (let i = 1; i <= tab.headers.length; i++) {
      sheet.autoResizeColumn(i)
    }

    Logger.log('✅ Set up tab: ' + tab.name + ' (' + tab.rows.length + ' data rows)')
  })

  // Remove the default "Sheet1" if it still exists and isn't one of ours
  const defaultSheet = ss.getSheetByName('Sheet1')
  if (defaultSheet) ss.deleteSheet(defaultSheet)

  Logger.log('🎉 Setup complete! All 4 tabs ready.')
  SpreadsheetApp.getUi().alert('✅ Latin District LA sheet setup complete!\n\nAll 4 tabs created:\n• Events (6 rows)\n• Venues (13 rows)\n• WatchFest (5 rows)\n• BarCrawl (6 rows)')
}
