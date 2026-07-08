import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import MediaCarousel from './MediaCarousel'
import Resources from './Resources'
import SubmitEventPage from './pages/SubmitEventPage'
import { trackPageview, trackTicketClick, trackContactSubmit, trackEventSubmit } from './analytics.js'

// ── Constants ──────────────────────────────────────────────────────────────

const FALLBACK_VENUES = [
  { venue_name: 'Rhythm Room LA',        tag: 'Dance Floor · DJ Sets',        active: 'yes', description: 'Underground DTLA lounge with live music, games, DJs, and a lively dance-room feel.',               address: '206 W 6th St #BSMT, Los Angeles, CA 90014',         hours_summary: 'Thu-Sat 6PM-2AM; Sun 6PM-12AM',                              instagram: '@rhythmroomla',        photo_url: 'https://images.squarespace-cdn.com/content/v1/59e009372278e7813f9403c0/1670030253365-L4OSZ2QJUUW3IETQ9JSQ/POOL+LOUNGE+POOL+TABLE+CLOSE+UP+FROM+P1.JPG?format=2500w' },
  { venue_name: 'Las Perlas',            tag: 'Mezcal Bar · Cocktails',       active: 'yes', description: 'Mezcal-forward DTLA bar with cocktails, patio energy, and Latin nightlife.',                         address: '107 E 6th St, Los Angeles, CA 90014',               hours_summary: 'Mon-Fri 3PM-2AM; Sat-Sun 1PM-2AM',                           instagram: '@lasperlasla',         photo_url: 'https://img.ctykit.com/cdn/ca-dtla/images/tr:w-1800/las-perlas2.jpg' },
  { venue_name: 'The Grayson',           tag: 'Cocktail Lounge · Live Sound', active: 'yes', description: 'Broadway cocktail lounge built for late nights, music, and high-energy groups.',                     address: '351 S Broadway, Los Angeles, CA 90013',             hours_summary: 'Daily 8PM-2AM',                                               instagram: '@thegraysonla',        photo_url: 'https://www.thegraysondtla.com/_next/image?url=%2Fsections%2Fvisit-bg.jpg&w=1080&q=75' },
  { venue_name: 'Continental Club',      tag: 'Basement Club · Social',       active: 'yes', description: 'Basement nightlife room with DJs, dancing, and a polished social crowd.',                            address: '116 W 4th St, Los Angeles, CA 90013',               hours_summary: 'Mon 8PM-12AM; Thu 7PM-2AM; Fri-Sat 10PM-2AM',               instagram: '',                     photo_url: 'https://www.circa93.com/wp-content/uploads/2024/03/The-Continental-Club-24.jpg' },
  { venue_name: 'Spring St Bar',         tag: 'Neighborhood Bar · Cocktails', active: 'yes', description: 'Historic Core neighborhood bar with reliable cocktails and easy watch party energy.',                 address: '626 S Spring St Suite B, Los Angeles, CA 90014',    hours_summary: 'Mon-Fri 5PM-2AM; Sat-Sun 2PM-Late',                          instagram: '@springstbar',         photo_url: 'https://img.mlbstatic.com/mlb-images/image/private/t_16x9/t_w1536/mlb/kusol2ek3erbryzcxt2s.jpg' },
  { venue_name: 'Broken Shaker',         tag: 'Rooftop · Craft Cocktails',    active: 'yes', description: 'Rooftop pool-deck cocktail bar with tropical drinks and DTLA views.',                                address: '416 W 8th St, Los Angeles, CA 90014',               hours_summary: 'Daily 12PM-12AM',            happy_hour: 'Daily 4PM-7PM',     instagram: '@brokenshaker',        photo_url: 'https://punchdrink.com/wp-content/uploads/2018/03/Slide2-Broken-Shaker-Hotel-Bar-Figueroa-Rudolphs-Los-Angeles-LA.jpg' },
  { venue_name: 'The Slipper Clutch',    tag: 'Rock Bar · Live Music',        active: 'yes', description: 'Rock speakeasy with live music, arcade energy, and a gritty DTLA feel.',                              address: '351 S Broadway, Los Angeles, CA 90013',             hours_summary: 'Daily 8PM-2AM',                                               instagram: '@theslipperclutch',    photo_url: 'https://platform.la.eater.com/wp-content/uploads/sites/26/chorus/uploads/chorus_asset/file/8457809/2017_05_02_Slipper_Clutch_006.jpg?quality=90&strip=all&w=1200' },
  { venue_name: 'Caña Rum Bar',          tag: 'Rum Bar · Latin Roots',        active: 'yes', description: 'Rum-focused hideaway with tropical cocktails, Latin flavor, and late-night energy.',                  address: '714 W Olympic Blvd, Los Angeles, CA 90015',         hours_summary: 'Mon-Thu 8PM-2AM; Fri 6PM-3AM; Sat 8PM-2AM; Sun 4PM-11PM',  happy_hour: 'Tue-Sat until 9PM; Sun-Mon all night', instagram: '@canarumbarla', photo_url: 'https://loopmag.co/wp-content/uploads/2024/08/Cana_Patio-2_Wonho-Frank-Lee-1024x683.jpg' },
  { venue_name: 'Chica Bonita Lounge',   tag: 'Lounge · Groups',              active: 'yes', description: 'Second-floor lounge designed for groups, music, and celebration nights.',                             address: '840 S Spring St, 2nd Floor, Los Angeles, CA 90014', hours_summary: 'Fri-Sat 8PM-2AM',                                             instagram: '@chicabonitalounge',   photo_url: 'https://chicabonitala.com/wp-content/uploads/2025/07/banner.jpg' },
  { venue_name: 'Kiso',                  tag: 'Queer Bar · DJ Sets',          active: 'yes', description: 'Downtown queer bar with drag, DJs, and a welcoming late-night crowd.',                                address: '107 W 4th St, Los Angeles, CA 90013',               hours_summary: 'Mon closed; Tue 6PM-1AM; Wed-Sat 6PM-2AM; Sun special events', instagram: '@kisolosangeles',     photo_url: 'https://res.cloudinary.com/the-infatuation/image/upload/c_fill,w_1400,ar_4:3,g_center,f_auto/Kiso_los_angeles_ogus4y' },
  { venue_name: 'Florentín Rooftop',     tag: 'Rooftop · Skyline Views',      active: 'yes', description: 'Mediterranean-inspired rooftop with skyline views, cocktails, and group seating.',                    address: '617 S Spring St, Los Angeles, CA 90014',            hours_summary: 'Mon closed; Tue-Fri 5PM-2AM; Sat 2PM-2AM; Sun 2PM-12AM',    instagram: '@florentindtla',       photo_url: 'https://florentindtla.com/wp-content/uploads/2025/02/Photo-Feb-18-2023-6-15-46-PM-2-scaled.jpg' },
  { venue_name: 'A Toda Madre',          tag: 'Tequila · Mezcal',             active: 'yes', description: 'Tequila and mezcal lounge with bold Latin design and DJ-driven nights.',                              address: '626 S Spring St, Los Angeles, CA 90014',            hours_summary: 'Daily 5PM-2AM',                                               instagram: '@atodamadrecantina',   photo_url: 'https://s3-media0.fl.yelpcdn.com/bphoto/M7X_vGz9GLXhFWlPWBqWEQ/348s.jpg' },
  { venue_name: 'The Association',       tag: 'Underground · Cocktails',      active: 'yes', description: 'Moody subterranean cocktail lounge with DJs, leather booths, and classic DTLA nightlife.',             address: '110 E 6th St, Los Angeles, CA 90014',               hours_summary: 'See venue/event calendar',                                    instagram: '',                     photo_url: 'https://img.ctykit.com/cdn/ca-dtla/images/tr:w-1800/association-fb-banner.jpg' },
  { venue_name: 'La Cita',               tag: 'Cumbia · Live Music',          active: 'yes', description: 'Iconic DTLA bar with cumbia, live music, patio drinks, and a loyal local crowd.',                     address: '336 S Hill St, Los Angeles, CA 90013',              hours_summary: 'Mon-Fri 11AM-2AM; Sat-Sun 10AM-2AM',  happy_hour: 'Daily 4PM-9PM', instagram: '@lacitabar', photo_url: '' },
  { venue_name: 'Audio Graph Brewing Co', tag: 'Brewery · Sports',            active: 'yes', description: 'South Park brewery with fresh taps, sports-friendly energy, and community seating.',                  address: '1203 S Olive St, Los Angeles, CA 90015',            hours_summary: 'Mon-Thu 4PM-10PM; Fri 4PM-12AM; Sat 12PM-12AM; Sun 2PM-8PM', instagram: '@audiographbeerco',   photo_url: 'https://static.wixstatic.com/media/9c73d9_80f8647bab2d4b469cc826af69b59768~mv2.jpeg/v1/fill/w_490%2Ch_368%2Cal_c%2Cq_80%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/9c73d9_80f8647bab2d4b469cc826af69b59768~mv2.jpeg' },
  { venue_name: 'Native Son LA',         tag: 'Rooftop · Craft Beer',         active: 'yes', description: 'DTLA rooftop and bar with craft beer, cocktails, and sunny group-friendly vibes.',                    address: '832 S Olive St, Los Angeles, CA 90014',             hours_summary: 'Mon-Fri 2:30PM-10PM; Sat-Sun 10AM-10PM', happy_hour: 'Daily 4PM-6PM', instagram: '@nativesonla', photo_url: 'https://images.squarespace-cdn.com/content/v1/68bb1d739c950b08f4f3d10e/1757093245762-UFC15SMNAM3A3IQHDLGT/NativeSonLA.jpg' },
  { venue_name: 'Arts District Brewing', tag: 'Brewery · Games',              active: 'yes', description: 'Large Arts District brewery with games, food, and big-match energy.',                                 address: '828 Traction Ave, Los Angeles, CA 90013',           hours_summary: 'Mon-Thu 11AM-12AM; Fri 11AM-2AM; Sat 12PM-2AM; Sun 12PM-12AM', instagram: '@artsdistrictbrewing', photo_url: 'https://static.wixstatic.com/media/714aff_c239e6edc2c24c7183d073edb81f053d~mv2.jpg/v1/fill/w_317%2Ch_394%2Cq_90%2Cenc_avif%2Cquality_auto/714aff_c239e6edc2c24c7183d073edb81f053d~mv2.jpg' },
  { venue_name: 'Club Lagos',            tag: 'Dance Club · Event Space',     active: 'yes', description: 'Broadway event space built for big crowds, DJs, and high-impact nightlife.',                          address: '330 S Broadway, Los Angeles, CA 90013',             hours_summary: 'Event-based; verify per event',                               instagram: '@theclublagosla',      photo_url: 'https://img.partyslate.com/companies-cover-image/55328/image-88326bdc-461f-4b7d-b46f-757e8bd41479.jpg?tr=w-3840' },
  { venue_name: 'Precinct',              tag: 'LGBTQ+ · Drag',                active: 'yes', description: 'Large LGBTQ+ venue with drag, DJs, brunch, dancing, and strong community energy.',                   address: '357 S Broadway, Los Angeles, CA 90013',             hours_summary: 'Mon closed; Tue-Fri 6PM-2AM; Sat 5PM-2AM; Sun 11:30AM-12AM', happy_hour: 'Tue-Sat 6PM-9PM', instagram: '@precinctdtla', photo_url: 'https://precinctdtla.com/wp-content/uploads/2026/05/image.webp' },
  { venue_name: "Lala's Grill",          tag: 'Argentine Grill · Groups',     active: 'yes', description: 'Argentine grill with hearty plates, group-friendly dining, and happy hour.',                          address: '105 W 9th St, Los Angeles, CA 90015',               hours_summary: 'Sun-Thu 11AM-10PM; Fri-Sat 11AM-10PM', happy_hour: '3PM-6PM', instagram: '@lalasgrill', photo_url: 'https://lalasgrill.com/images/locations/dtla.jpg' },
  { venue_name: 'Golden Gopher',         tag: 'Dive Bar · Historic',          active: 'yes', description: 'Historic DTLA dive with classic drinks, neon character, and laid-back crowds.',                       address: '417 W 8th St, Los Angeles, CA 90014',               hours_summary: 'Open nightly 3PM-2AM', happy_hour: 'Daily 3PM-8PM',          instagram: '@goldengopherla',      photo_url: 'https://static.wixstatic.com/media/a50d2e_d5e9dd2e777d4799ad09da442ce48bf7~mv2.png/v1/fill/w_980%2Ch_786%2Cal_c%2Cq_90%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/Gopher%20Exterior%20%281%29.png' },
  { venue_name: 'West Eight',            tag: 'Nightclub · DJ Sets',          active: 'yes', description: 'Modern nightclub under Hotel Bristol with immersive lights, sound, and late-night energy.',           address: '425 W 8th St, Los Angeles, CA 90014',               hours_summary: 'Event-based; doors often 10PM',                               instagram: '@west8la',             photo_url: '' },
  { venue_name: 'Five Star Bar',         tag: 'Live Music · Local Bar',       active: 'yes', description: 'Local DTLA live-music bar with underground energy and late-night shows.',                              address: '267 S Main St, Los Angeles, CA 90012',              hours_summary: 'Event-based; verify per show',                                instagram: '@5starbar',            photo_url: 'https://ca-times.brightspotcdn.com/dims4/default/b3c57dc/2147483647/strip/true/crop/8420x5613%2B0%2B0/resize/1200x800%21/quality/75/?url=https%3A%2F%2Fcalifornia-times-brightspot.s3.amazonaws.com%2Fd4%2F5f%2F42f0f55e436392525a9ee5ff41b8%2F1497469-et-5-star-bar-3862.jpg' },
  { venue_name: 'Lost',                  tag: 'Rooftop · Tacos',              active: 'yes', description: 'Mexico City-inspired rooftop cocktail bar with tacos, DJs, and skyline views.',                       address: '718 S Hill St Rooftop, Los Angeles, CA 90014',      hours_summary: 'Fri-Sat 8PM-late; Sat brunch 11AM-3PM; Sun 3PM-9PM',         instagram: '@getlostdtla',         photo_url: 'https://platform.la.eater.com/wp-content/uploads/sites/26/chorus/uploads/chorus_asset/file/25639247/240916___Lost_Bar__Shelby_Moore____240916___Lost_Bar52270.jpg?quality=90&strip=all&w=2400' },
  { venue_name: 'The Mayan',             tag: 'Theater · Nightclub',          active: 'yes', description: 'Historic Mayan Revival theater and nightclub space with large-format production.',                    address: '1038 S Hill St, Los Angeles, CA 90015',             hours_summary: 'Sun-Thu closed; Fri-Sat 9:30PM-2AM',                          instagram: '@mayanla',             photo_url: 'https://mayanmusicvenue.com/wp-content/uploads/2026/02/crowd_purple_lit_stage_digital_visuals.jpg' },
  { venue_name: "Clifton's Republic",    tag: 'Landmark · Immersive',         active: 'verify', description: 'Immersive forest-themed DTLA landmark.',                                                          address: '648 S Broadway, Los Angeles, CA 90014',             hours_summary: 'Verify before publishing',                                    instagram: '@cliftonsrepublic',    photo_url: '' },
]

const GENRES = [
  { name: 'Reggaeton',      sub: 'High energy urban beats' },
  { name: 'Cumbia',         sub: 'Roots to roots' },
  { name: 'Salsa',          sub: 'Classic dance floor' },
  { name: 'Latin House',    sub: 'Electronic with soul' },
  { name: 'Afrolatino',     sub: 'Afrobeats meets Latin' },
  { name: 'Throwback Hits', sub: 'Y2K & classics' },
]

// ── Controlled dropdown values for event submission form ────────────────────
// These are the only accepted genre values — do not allow free-text entry.
const GENRE_OPTIONS = [
  'Reggaeton', 'Latin House', 'House', 'Afrobeats', 'Hip Hop',
  'Open Format', 'Dembow', 'Salsa', 'Bachata', 'Cumbia',
  'Regional Mexican', 'Baile Funk', 'Amapiano', 'Throwbacks', 'Other',
]

// These are the only accepted event type values — do not allow free-text entry.
const EVENT_TYPE_OPTIONS = [
  'Party', 'Club Night', 'Watch Party', 'Tailgate', 'Day Party',
  'After Party', 'Festival', 'Concert', 'Special Event',
]

const BADGE_COLORS = {
  friday_night: { bg: 'rgba(255,23,68,.2)',   color: '#FF1744', label: 'Friday Night' },
  crawl:        { bg: 'rgba(213,0,249,.2)',   color: '#D500F9', label: 'Bar Crawl' },
  special:      { bg: 'rgba(0,229,255,.2)',   color: '#00E5FF', label: 'Special' },
}

const STATUS_COLORS = {
  'Coming Soon':  { bg: 'rgba(0,229,255,.2)',   color: '#00E5FF' },
  'Get Tickets':  { bg: 'rgba(255,23,68,.2)',   color: '#FF1744' },
  'Free':         { bg: 'rgba(0,200,80,.2)',    color: '#00C853' },
  'RSVP':         { bg: 'rgba(255,179,0,.2)',   color: '#FFB300' },
}

// ── Utilities ───────────────────────────────────────────────────────────────

// ── Image URL strategy ──────────────────────────────────────────────────────
// Google Form file uploads produce Drive share links — these are intake only.
// They require auth and can break at any time as permanent image sources.
//
// Workflow:
//   1. Venue submits form → flyer/venue images land in Google Drive as upload links.
//   2. Admin reviews the submission in Sheets.
//   3. Admin re-hosts the image (stable public URL) into
//      flyer_image_url / venue_image_url columns.
//   4. Admin sets status = approved → row goes live on the site.
//
// If flyer_image_url or venue_image_url is empty, EventCard
// already skips the image block rather than rendering a broken <img>.
// convertDriveUrl handles the common Drive /d/{id}/ pattern as a best-effort
// conversion for legacy rows — do not rely on it for new submissions.

function convertDriveUrl(url) {
  if (!url) return ''
  const match = url.match(/\/d\/([^/]+)\//)
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`
  return url
}

function parseEventDate(str) {
  if (!str) return null
  // YYYY-MM-DD: parse as local midnight (avoids UTC shift in negative-offset timezones)
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3])
  // gviz raw Date() format e.g. "Date(2026,2,20)" or datetime "Date(2026,5,12,12,0,0)" — month is already 0-indexed
  const gviz = str.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/)
  if (gviz) return new Date(+gviz[1], +gviz[2], +gviz[3], +(gviz[4]||0), +(gviz[5]||0), +(gviz[6]||0))
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

// Returns false only when active is explicitly set to no/false (case-insensitive).
// Treats empty/unknown values as active so legacy rows without the field still show.
// Handles all gviz representations: 'TRUE'/'FALSE' text, boolean true/false converted
// to strings, 'yes'/'no', and empty string (gviz emits "" for unconfigured cells).
function isActiveItem(active) {
  const v = (active || '').toLowerCase().trim()
  if (v === 'no' || v === 'false') return false
  return true
}

// Returns true if the event is still visible (or if date is unparseable — fail-safe).
// Keep visible until end of the day AFTER the event date.
//   e.g. event on May 5 → visible all day May 6, hidden starting May 7
function isUpcoming(item) {
  try {
    if (item.kickoff_datetime) {
      const dt = new Date(item.kickoff_datetime)
      const GRACE_MS = 5 * 60 * 60 * 1000 // 5 hours — keep visible after kickoff for door ticket claims
      if (!isNaN(dt.getTime())) return dt.getTime() + GRACE_MS > Date.now()
    }
    if (!item.date) return true
    const d = parseEventDate(item.date)
    if (!d) return true
    // Advance to end of the next day so events stay visible through the day after
    d.setDate(d.getDate() + 1)
    d.setHours(23, 59, 59, 999)
    return d.getTime() > Date.now()
  } catch {
    return true
  }
}

function formatDate(str) {
  if (!str) return ''
  try {
    const d = parseEventDate(str)
    if (!d || isNaN(d.getTime())) return str
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return str }
}

// Short date without weekday: "Apr 3"
function formatDateShort(str) {
  if (!str) return ''
  try {
    const d = parseEventDate(str)
    if (!d || isNaN(d.getTime())) return str
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return str }
}

// 3-letter uppercase day: "FRI", "SAT", "SUN"
function getDayOfWeek(str) {
  if (!str) return ''
  try {
    const d = parseEventDate(str)
    if (!d || isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  } catch { return '' }
}

// Encode form data for Netlify Forms (application/x-www-form-urlencoded)
function encode(data) {
  return Object.keys(data)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k] ?? ''))
    .join('&')
}

// ── Weekend event selection ──────────────────────────────────────────────────
// Returns events happening this Fri/Sat/Sun (LA timezone).
// Fallback: next 3–6 upcoming events if none found.
function getThisWeekendEvents(events) {
  // Resolve "today" in LA timezone
  const laParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date())
  const getPart = type => parseInt(laParts.find(p => p.type === type)?.value || '0')
  const todayLA = new Date(getPart('year'), getPart('month') - 1, getPart('day'))
  const dow = todayLA.getDay() // 0=Sun … 5=Fri … 6=Sat

  // Days from today to this week's Friday (negative = already passed)
  const daysToFri = dow === 0 ? -2 : dow <= 4 ? 5 - dow : dow === 5 ? 0 : -1
  const fridayLA  = new Date(todayLA); fridayLA.setDate(todayLA.getDate() + daysToFri)
  const sundayLA  = new Date(fridayLA); sundayLA.setDate(fridayLA.getDate() + 2)

  const isApproved = () => true  // active column is the only publish gate

  const parseTime = timeStr => {
    if (!timeStr) return 0
    const m = timeStr.match(/(\d+):(\d+)\s*(am|pm)?/i)
    if (!m) return 0
    let h = parseInt(m[1]); const min = parseInt(m[2]); const ap = (m[3] || '').toLowerCase()
    if (ap === 'pm' && h !== 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    return h * 60 + min
  }

  const byDateThenTime = (a, b) => {
    const da = parseEventDate(a.date), db = parseEventDate(b.date)
    if (!da || !db) return 0
    const diff = da.getTime() - db.getTime()
    return diff !== 0 ? diff : parseTime(a.time) - parseTime(b.time)
  }

  // Weekend events: active=TRUE and upcoming, date falls on Fri/Sat/Sun
  const weekendEvents = events
    .filter(e => {
      if (!e.event_name || !e.event_name.trim()) return false
      if (!isActiveItem(e.active) || !isApproved(e) || !isUpcoming(e)) return false
      const d = parseEventDate(e.date)
      if (!d) return false
      const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      return midnight >= fridayLA && midnight <= sundayLA
    })
    .sort(byDateThenTime)
    .slice(0, 6)

  if (weekendEvents.length > 0) return { events: weekendEvents, isWeekend: true }

  // Fallback: next upcoming events (3–6)
  const fallback = events
    .filter(e => isActiveItem(e.active) && isApproved(e) && isUpcoming(e))
    .sort(byDateThenTime)
    .slice(0, 6)

  return { events: fallback, isWeekend: false }
}

// Countdown timer helpers
function calcTimeLeft(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  if (isNaN(target.getTime())) return null
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return null
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000)  / 60000),
    seconds: Math.floor((diff % 60000)    / 1000),
  }
}

function useCountdown(dateStr) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(dateStr))
  useEffect(() => {
    setTimeLeft(calcTimeLeft(dateStr))
    if (!dateStr) return
    const id = setInterval(() => setTimeLeft(calcTimeLeft(dateStr)), 1000)
    return () => clearInterval(id)
  }, [dateStr])
  return timeLeft
}

// ── Events Sheet — target column schema ─────────────────────────────────────
// Existing rows without a status column are shown by default (backwards compatible).
// New submissions via Google Form should land with status = pending and only
// become visible after an admin sets status = approved.
//
// Column name        | Type / Notes
// ───────────────────|────────────────────────────────────────────────────────
// id                 | auto or manual unique ID
// status             | pending | approved | rejected  (see moderation filter below)
// event_name         | text (required)
// date               | YYYY-MM-DD preferred
// time               | HH:MM AM/PM
// end_time           | HH:MM AM/PM
// venue              | venue name string
// address            | street address
// category           | friday_night | crawl | special
// description        | 2–3 sentence event description
// ticket_link        | URL
// video_url          | YouTube or TikTok URL
// flyer_image_url    | stable public URL — do NOT use raw Form upload Drive link here
// venue_image_url    | stable public URL — same note as above
// submitted_by_email | from Form submission
// submitted_at       | ISO timestamp
// notes_internal     | admin-only notes, never rendered on site
//
// STATUS MODERATION FILTER (applied in EventsPage):
//   if row.status field exists → only show when status === 'approved' (case-insensitive)
//   if row has no status field → show as before (legacy rows stay visible)

// ── Sheets cache ─────────────────────────────────────────────────────────────
// Two-layer cache: module-level in-memory (survives page navigation within the
// same tab) + sessionStorage (survives hard-reload, same session).
// TTL: 10 minutes. Stale-while-revalidate: show cached data immediately, then
// refresh in the background so the UI never blocks on a network call.

const SHEETS_CACHE_KEY = 'ld_sheets_v1'
const SHEETS_TTL = 10 * 60 * 1000 // 10 minutes

let _memCache = null // { data, ts }

function _readStorage() {
  try {
    const raw = sessionStorage.getItem(SHEETS_CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw)
    return (Date.now() - entry.ts < SHEETS_TTL) ? entry : null
  } catch { return null }
}

function _writeCache(data) {
  const entry = { data, ts: Date.now() }
  _memCache = entry
  try { sessionStorage.setItem(SHEETS_CACHE_KEY, JSON.stringify(entry)) } catch {}
}

function _freshMemCache() {
  return _memCache && (Date.now() - _memCache.ts < SHEETS_TTL) ? _memCache : null
}

// ── useSheets hook ──────────────────────────────────────────────────────────

function useSheets() {
  // Admin cache bypass: ?refresh_cache=SECRET bypasses all browser caches and
  // passes the token to the Netlify function so it also bypasses the CDN cache.
  const params        = new URLSearchParams(window.location.search)
  const refreshSecret = params.get('refresh_cache')
  const isAdminRefresh = !!refreshSecret

  const cached = isAdminRefresh ? null : (_freshMemCache() || _readStorage())

  const [data, setData] = useState(
    cached ? cached.data : { events: [], venues: [], barcrawl: [] }
  )
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState(null)

  useEffect(() => {
    const sheetsUrl = isAdminRefresh
      ? `/.netlify/functions/sheets?refresh=1&token=${encodeURIComponent(refreshSecret)}`
      : '/.netlify/functions/sheets'

    // Normal path: in-memory cache is fresh — skip fetch entirely
    if (!isAdminRefresh && _freshMemCache()) return

    const stored = !isAdminRefresh && _readStorage()
    if (stored) {
      // Stale-while-revalidate: data already visible, refresh silently in background
      fetch(sheetsUrl)
        .then(r => r.json())
        .then(d => {
          const merged = { ...stored.data, ...d }
          _writeCache(merged)
          setData(merged)
        })
        .catch(() => {}) // keep showing stale data on error
      return
    }

    // No cache (or admin refresh) — fetch fresh and show loading
    fetch(sheetsUrl)
      .then(r => r.json())
      .then(d => {
        // Merge into defaults so a partial/error response never nukes an array key
        const merged = { events: [], venues: [], barcrawl: [], ...d }
        _writeCache(merged)
        setData(merged)
        setLoading(false)
      })
      .catch(e => {
        console.warn('Sheets fetch failed, using fallback data', e)
        setError(e.message)
        setData(prev => ({ ...prev, venues: FALLBACK_VENUES }))
        setLoading(false)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error }
}

// ── Shared Components ───────────────────────────────────────────────────────

function LiveBadge({ text = 'Updates live every week' }) {
  return (
    <div className="live-badge">
      <span className="live-badge__dot" />
      {text}
    </div>
  )
}

function NeonDivider() {
  return <hr className="neon-divider" />
}

// ── Event detail modal ────────────────────────────────────────────────────────

function EventModal({ event, onClose }) {
  const badge  = BADGE_COLORS[event.event_type] || BADGE_COLORS.special
  const imgUrl = convertDriveUrl(event.flyer_image_url)

  useEffect(() => {
    const scrollY = window.scrollY
    const body = document.body
    body.style.position   = 'fixed'
    body.style.top        = `-${scrollY}px`
    body.style.left       = '0'
    body.style.right      = '0'
    body.style.width      = '100%'
    body.style.overflowY  = 'hidden'

    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('keydown', handleKey)
      body.style.position  = ''
      body.style.top       = ''
      body.style.left      = ''
      body.style.right     = ''
      body.style.width     = ''
      body.style.overflowY = ''
      window.scrollTo(0, scrollY)
    }
  }, [onClose])

  return (
    <div className="event-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Event details">
      <div className="event-modal" onClick={e => e.stopPropagation()}>
        <div className="event-modal__header">
          <button onClick={onClose} className="event-modal__close" aria-label="Close">✕</button>
        </div>
        <div className="event-modal__body">
          {imgUrl && (
            <div className="event-modal__flyer">
              <img src={imgUrl} alt={event.event_name} loading="lazy" />
            </div>
          )}
          <span className="event-card__badge" style={{ background: badge.bg, color: badge.color, display: 'inline-block', marginBottom: 12 }}>{badge.label}</span>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(24px, 6vw, 36px)', color: 'var(--cream)', lineHeight: 1.1, marginBottom: 14 }}>
            {event.event_name}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16, fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)' }}>
            {event.venue      && <span>📍 {event.venue}</span>}
            {event.date       && <span>📅 {formatDate(event.date)}</span>}
            {event.time       && <span>🕙 {event.time}</span>}
            {event.genre      && <span>🎵 {event.genre}</span>}
            {event.event_type && <span>🏷️ {event.event_type}</span>}
          </div>
          {event.description && (
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--cream)', lineHeight: 1.6, marginBottom: 20 }}>
              {event.description}
            </p>
          )}
          {event.ticket_link ? (
            <a href={event.ticket_link} target="_blank" rel="noopener noreferrer" className="btn btn-red w-full" style={{ fontSize: 14, padding: '12px 20px' }} onClick={() => trackTicketClick(event, 'nightlife')}>
              Get Tickets →
            </a>
          ) : (
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
              No ticket link available
            </p>
          )}
          <button
            onClick={onClose}
            style={{ marginTop: 12, width: '100%', padding: '11px 16px', fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)', background: 'transparent', border: '1px solid rgba(255,255,255,.12)', borderRadius: 4, cursor: 'pointer', transition: 'border-color .15s, color .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.3)'; e.currentTarget.style.color = 'var(--cream)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.12)'; e.currentTarget.style.color = 'var(--muted)' }}
          >
            Return to Events
          </button>
        </div>
      </div>
    </div>
  )
}

function EventCard({ event }) {
  const [modalOpen, setModalOpen] = useState(false)
  const badge = BADGE_COLORS[event.event_type] || BADGE_COLORS.special

  // Build carousel: flyer first, venue second, video last
  const videoType = getVideoType(event.video_url)
  const mediaEntries = []
  if (event.flyer_image_url)        mediaEntries.push({ url: convertDriveUrl(event.flyer_image_url), type: 'image' })
  if (event.venue_image_url)        mediaEntries.push({ url: convertDriveUrl(event.venue_image_url), type: 'image' })
  if (event.video_url && videoType) mediaEntries.push({ url: event.video_url, type: videoType })
  const mediaUrls  = mediaEntries.map(m => m.url).join('|')
  const mediaTypes = mediaEntries.map(m => m.type).join('|')

  return (
    <>
      <div className="event-card" onClick={() => setModalOpen(true)} style={{ cursor: 'pointer' }}>
        {mediaEntries.length > 0 ? (
          <MediaCarousel mediaUrls={mediaUrls} mediaTypes={mediaTypes} />
        ) : (
          <div className="event-card__image">
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0d0d2b, #1a0a2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🎉</div>
            <div className="event-card__overlay" />
            <div className="event-card__overlay-text">
              <div className="event-card__name">{event.event_name}</div>
              <div className="event-card__meta">{event.venue} · {formatDate(event.date)}{event.time ? ` · ${event.time}` : ''}</div>
            </div>
          </div>
        )}
        <div className="event-card__body">
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(15px, 4vw, 20px)', color: '#fff', fontWeight: 700, marginBottom: 8, lineHeight: 1.15 }}>{event.event_name}</div>
          {/* Date row: day pill + short date + time */}
          {event.date && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 6px', marginBottom: 5 }}>
              {getDayOfWeek(event.date) && (
                <span style={{ fontFamily: 'var(--font-label)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', background: 'rgba(255,23,68,.12)', color: '#FF7090', border: '1px solid rgba(255,23,68,.25)', borderRadius: 3, padding: '2px 7px', flexShrink: 0 }}>
                  {getDayOfWeek(event.date)}
                </span>
              )}
              <span style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--cream)', letterSpacing: '.02em' }}>
                {formatDateShort(event.date)}{event.time ? ` · ${event.time}` : ''}
              </span>
            </div>
          )}
          {/* Venue — secondary but readable */}
          {event.venue && (
            <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: '#8E8EAA', marginBottom: 10, letterSpacing: '.02em' }}>
              {event.venue}
            </div>
          )}
          <span className="event-card__badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
          {event.ticket_link && (
            <a
              href={event.ticket_link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-red w-full"
              style={{ marginTop: 10, fontSize: 14, padding: '12px 18px', fontWeight: 700, borderRadius: 24, letterSpacing: '.06em' }}
              onClick={e => { e.stopPropagation(); trackTicketClick(event, 'nightlife') }}
            >
              GET TICKETS →
            </a>
          )}
        </div>
      </div>
      {modalOpen && createPortal(
        <EventModal event={event} onClose={() => setModalOpen(false)} />,
        document.body
      )}
    </>
  )
}

function SpotlightCard({ event }) {
  const imgUrl = convertDriveUrl(event.flyer_image_url)

  return (
    <div className="spotlight-card">
      {imgUrl && (
        <div className="spotlight-card__image">
          <img
            src={imgUrl}
            alt={event.event_name}
            loading="eager"
            style={{ opacity: 0, transition: 'opacity .35s ease' }}
            onLoad={e => { e.target.style.opacity = '1' }}
          />
        </div>
      )}
      <div className="spotlight-card__body">
        <span className="spotlight-card__label">
          {event.spotlight_label || 'Spotlight Event'}
        </span>
        <h2 className="spotlight-card__title">{event.event_name}</h2>
        <div className="spotlight-card__meta">
          {event.venue && <span>📍 {event.venue}</span>}
          {event.date  && <span>📅 {formatDate(event.date)}{event.time ? ` · ${event.time}` : ''}</span>}
        </div>
        {event.description && (
          <p className="spotlight-card__desc">{event.description}</p>
        )}
        {event.ticket_link ? (
          <a
            href={event.ticket_link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-red spotlight-card__cta"
            onClick={() => trackTicketClick(event, 'nightlife')}
          >
            GET TICKETS →
          </a>
        ) : (
          <Link to="/events" className="btn btn-outline-blue spotlight-card__cta">
            View Details →
          </Link>
        )}
      </div>
    </div>
  )
}

function VenueCard({ venue }) {
  const imgUrl = convertDriveUrl(venue.photo_url || venue.venue_image_url)
  return (
    <div className="venue-card">
      <div className="venue-card__photo">
        {imgUrl ? (
          <img src={imgUrl} alt={venue.venue_name} loading="lazy" />
        ) : (
          <div className="venue-card__photo-placeholder">🏠</div>
        )}
      </div>
      <div className="venue-card__body">
        <div className="venue-card__name">{venue.venue_name}</div>
        <div className="venue-card__tag">{venue.tag}</div>
        {venue.description && <div className="venue-card__desc">{venue.description}</div>}
        {venue.instagram && (
          <div className="venue-card__ig">
            <a href={`https://instagram.com/${venue.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer">
              @{venue.instagram.replace('@','')}
            </a>
          </div>
        )}
      </div>
      {venue.media_urls && venue.media_types && (
        <MediaCarousel mediaUrls={venue.media_urls} mediaTypes={venue.media_types} />
      )}
    </div>
  )
}


function isFlagshipItem(item) {
  const f = (item.flagship || '').toLowerCase()
  return f === 'true' || f === 'yes'
}

function isSpotlightItem(item) {
  const v = (item.spotlight || '').toLowerCase().trim()
  return v === 'true' || v === 'yes'
}

function getVideoType(url) {
  if (!url) return null
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  return null
}

function SkeletonCard() {
  return (
    <div style={{ background: '#0D0D1F', border: '1px solid rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ paddingTop: '133%', background: 'linear-gradient(90deg, #0d0d1f 25%, #141428 50%, #0d0d1f 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      <div style={{ padding: 12 }}>
        <div style={{ height: 12, background: '#141428', borderRadius: 2, marginBottom: 8, width: '60%' }} />
        <div style={{ height: 36, background: '#141428', borderRadius: 3 }} />
      </div>
    </div>
  )
}

// ── Nav ─────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { to: '/',             label: 'Home' },
  { to: '/events',       label: 'Events' },
  { to: '/calendar',     label: 'Calendar' },
  { to: '/friday-night', label: 'Friday Night' },
  { to: '/venues',       label: 'Venues' },
  { to: '/resources',    label: 'Resources' },
  { to: '/contact',      label: 'Contact' },
]

function Nav() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <nav className="nav">
        <Link to="/" className="nav__logo" onClick={() => setDrawerOpen(false)}>
          <img src="/logo.png" alt="Latin District LA" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block' }} />
          <span className="nav__logo-text" style={{ display: 'none' }}>LATIN DISTRICT</span>
        </Link>

        <div className="nav__links">
          {NAV_LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `nav__link${isActive ? ' active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
          <Link to="/submit-event" className="btn btn-red" style={{ padding: '8px 18px', fontSize: 12, minHeight: 36 }}>
            Submit Event
          </Link>
        </div>

        <button className="nav__hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <span /><span /><span />
        </button>
      </nav>

      <div className={`drawer${drawerOpen ? ' open' : ''}`}>
        <button className="drawer__close" onClick={() => setDrawerOpen(false)}>✕</button>
        {NAV_LINKS.map(l => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'} className="drawer__link" onClick={() => setDrawerOpen(false)}>
            {l.label}
          </NavLink>
        ))}
        <Link to="/submit-event" className="btn btn-red" onClick={() => setDrawerOpen(false)} style={{ marginTop: 16 }}>
          Submit Event
        </Link>
      </div>
    </>
  )
}

// ── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="footer">
      <img src="/logo.png" alt="Latin District LA" className="footer__logo" onError={e => { e.target.style.display='none' }} />
      <div className="footer__links">
        {NAV_LINKS.map(l => <Link key={l.to} to={l.to} className="footer__link">{l.label}</Link>)}
        <Link to="/submit-event" className="footer__link">Submit Event</Link>
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <a href="https://instagram.com/LatinDistrictLA" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)' }}>
          Instagram @LatinDistrictLA
        </a>
        <a href="https://tiktok.com/@LatinDistrictLA" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)' }}>
          TikTok @LatinDistrictLA
        </a>
        <span style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)' }}>📍 Downtown Los Angeles, CA</span>
      </div>
      <p className="footer__copy">© {new Date().getFullYear()} Latin District LA. All rights reserved.</p>
    </footer>
  )
}

// ── HOME PAGE ───────────────────────────────────────────────────────────────

function HomePage({ data, loading }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const successType = searchParams.get('success')  // 'event' | 'contact' | null
  const [showBanner, setShowBanner] = useState(() => !!searchParams.get('success'))

  // Clear the ?success param from the URL immediately so refresh doesn't re-show
  useEffect(() => {
    if (successType) {
      navigate('/', { replace: true })
    }
  }, [])

  const { events: weekendEvents, isWeekend } = getThisWeekendEvents(data.events)
  const spotlightEvent = data.events.find(e => isActiveItem(e.active) && isSpotlightItem(e) && isUpcoming(e))
  const flagshipEvent = data.events.find(e => isActiveItem(e.active) && isFlagshipItem(e) && isUpcoming(e))
  const venueStrip = (data.venues.length > 0 ? data.venues : FALLBACK_VENUES)
    .filter(v => isActiveItem(v.active))
    .slice(0, 8)

  const bannerMsg = successType === 'event'
    ? 'Event submitted! We received your event and will review it within 48 hours.'
    : 'Message received! We\'ll get back to you within 48 hours.'

  return (
    <div className="page-top">

      {/* ── Success Banner ── */}
      {showBanner && (
        <div style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 900, display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none' }}>
          <div style={{ background: '#0D2B1A', border: '1px solid #00C853', borderRadius: 8, padding: '14px 20px', maxWidth: 520, width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, pointerEvents: 'auto', boxShadow: '0 4px 24px rgba(0,200,83,.2)' }}>
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>✅</span>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: '#B9F6CA', lineHeight: 1.5, margin: 0, flex: 1 }}>{bannerMsg}</p>
            <button onClick={() => setShowBanner(false)} style={{ background: 'none', border: 'none', color: '#B9F6CA', fontSize: 18, cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: 0 }}>✕</button>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <section className="hero scanlines">
        <video
          className="hero__video"
          src={import.meta.env.VITE_HERO_VIDEO_URL || '/hero-video.mp4'}
          autoPlay
          muted
          loop
          playsInline
          onError={e => { e.target.style.display = 'none' }}
        />
        <div className="hero__bg" />
        <div className="hero__overlay" />
        <div className="hero__content">
          <img src="/logo.png" alt="Latin District LA" className="hero__logo" onError={e => e.target.style.display = 'none'} />
          <div className="hero__headline">
            <div className="neon-white" style={{ color: '#fff' }}>LATIN</div>
            <div className="neon-white" style={{ color: '#fff' }}>DISTRICT</div>
          </div>
          <p className="hero__sub">Multiple venues. One district. Los Angeles.</p>
          <div className="hero__buttons">
            <Link to="/events" className="btn btn-red">See This Week →</Link>
            <Link to="/friday-night" className="btn btn-outline-blue">Friday Night →</Link>
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* ── Spotlight Event ── */}
      {!loading && spotlightEvent && (
        <>
          <section className="section">
            <div className="container">
              <div className="section-tag" style={{ color: 'var(--red)' }}>Don't Miss This</div>
              <NeonDivider />
              <SpotlightCard event={spotlightEvent} />
            </div>
          </section>
          <NeonDivider />
        </>
      )}

      {/* ── Flagship Hero Event ── */}
      {!loading && flagshipEvent && (
        <>
          <section className="section" style={{ background: 'linear-gradient(135deg, rgba(255,23,68,.06), rgba(0,0,0,0))' }}>
            <div className="container">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 32, alignItems: 'center' }}>
                {flagshipEvent.flyer_image_url && (
                  <div style={{ borderRadius: 4, overflow: 'hidden', maxHeight: 400, position: 'relative' }}>
                    <img
                      src={convertDriveUrl(flagshipEvent.flyer_image_url)}
                      alt={flagshipEvent.event_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0, transition: 'opacity .35s ease' }}
                      onLoad={e => { e.target.style.opacity = '1' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,6,15,.85) 0%, transparent 60%)' }} />
                  </div>
                )}
                <div>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--red)', background: 'rgba(255,23,68,.12)', border: '1px solid rgba(255,23,68,.3)', borderRadius: 2, padding: '4px 10px', display: 'inline-block', marginBottom: 14 }}>
                    ★ Featured Event
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(32px, 8vw, 72px)', color: 'var(--cream)', lineHeight: 1, marginBottom: 14 }}>
                    {flagshipEvent.event_name}
                  </h2>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
                    {flagshipEvent.date && <span style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)' }}>📅 {formatDate(flagshipEvent.date)}</span>}
                    {flagshipEvent.time && <span style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)' }}>🕙 {flagshipEvent.time}</span>}
                    {flagshipEvent.venue && <span style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)' }}>📍 {flagshipEvent.venue}</span>}
                  </div>
                  {flagshipEvent.description && (
                    <p style={{ fontFamily: 'var(--font-label)', fontSize: 15, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 560, marginBottom: 24 }}>
                      {flagshipEvent.description}
                    </p>
                  )}
                  {flagshipEvent.ticket_link ? (
                    <a href={flagshipEvent.ticket_link} target="_blank" rel="noopener noreferrer" className="btn btn-red" onClick={() => trackTicketClick(flagshipEvent, 'nightlife')}>
                      Get Tickets →
                    </a>
                  ) : (
                    <Link to="/events" className="btn btn-outline-blue">View Events →</Link>
                  )}
                </div>
              </div>
            </div>
          </section>
          <NeonDivider />
        </>
      )}

      {/* ── This Weekend ── */}
      <section className="section">
        <div className="container">
          <div className="section-tag">This Weekend in DTLA</div>
          <h2 className="section-heading">THIS WEEKEND IN DTLA</h2>
          {loading ? (
            <div className="events-grid">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
          ) : weekendEvents.length > 0 ? (
            <>
              <div className="events-grid content-reveal">
                {weekendEvents.map((e, i) => <EventCard key={i} event={e} />)}
              </div>
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <Link to="/events" className="btn btn-outline-blue" onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}>View All Events →</Link>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">🎉</div>
              <p>Events updating soon — follow @LatinDistrictLA for announcements</p>
            </div>
          )}
        </div>
      </section>

      <NeonDivider />

      {/* ── About ── */}
      <section className="section">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 48, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="counter-number neon-blue" style={{ color: 'var(--blue)', fontSize: 'clamp(28px, 6vw, 48px)', lineHeight: 1.2 }}>DOWNTOWN<br />ONE STOP SPOT</div>
            </div>
            <div>
              <div className="section-tag">About</div>
              <h2 className="section-heading" style={{ marginBottom: 24 }}>ONE DISTRICT.<br />ALL NIGHT.</h2>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  'Multiple venues across DTLA all participating on Friday nights',
                  'Live DJs spinning Reggaeton, Salsa, Cumbia, Latin House & more',
                  'A community collective bringing Latin music to Downtown Los Angeles',
                  'No cover at most venues — just show up and enjoy',
                  'Community built, locally owned, culturally authentic',
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 15, color: 'var(--cream)' }}>
                    <span style={{ color: 'var(--blue)', marginTop: 2 }}>▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* ── Venue Strip ── */}
      <section className="section-sm" style={{ background: '#080812' }}>
        <div className="container">
          <div className="section-tag">The Network</div>
          <h2 className="section-heading mb-24">OUR VENUES</h2>
          <div className="venue-strip">
            {venueStrip.map((v, i) => (
              <div key={i} className="venue-strip-item" onClick={() => navigate('/venues')}>
                <div className="venue-strip-item__name">{v.venue_name}</div>
                <div className="venue-strip-item__tag">{v.tag}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link to="/venues" className="btn btn-outline-blue">See All Venues →</Link>
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* ── Friday Night Band ── */}
      <section className="band band-red">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="section-tag" style={{ color: 'var(--red)' }}>Every Week</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(48px, 12vw, 96px)', lineHeight: .95, color: 'var(--cream)', marginBottom: 16 }}>
            FRIDAY NIGHT<br /><span className="neon-red" style={{ color: 'var(--red)' }}>LATIN DISTRICT</span>
          </h2>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 16, color: 'var(--muted)', maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.5 }}>
            Every Friday. Multiple venues. Different vibes — all one culture.
            From 10PM to 2AM across Downtown LA.
          </p>
          <Link to="/friday-night" className="btn btn-red">Explore Friday Night →</Link>
        </div>
      </section>


      {/* ── Collaborator CTA ── */}
      <section className="section">
        <div className="container">
          <div className="cta-section">
            <div className="section-tag">Grow With Us</div>
            <h2 className="section-heading mb-16">ARE YOU A VENUE,<br />PROMOTER, OR BRAND?</h2>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 16, color: 'var(--muted)', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.5 }}>
              Join the Latin District network. Reach thousands of DTLA nightlife
              attendees every Friday night.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/contact" className="btn btn-blue">Partner With Us</Link>
              <Link to="/submit-event" className="btn btn-outline-blue">Submit Your Event</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── EVENTS PAGE ─────────────────────────────────────────────────────────────

const FILTER_OPTIONS = [
  { value: 'today',    label: 'Today' },
  { value: 'thisweek', label: 'This Week' },
  { value: 'all',      label: 'All Events' },
  { value: 'calendar', label: 'Calendar', to: '/calendar' },
]

// Returns the canonical site_tab for an event row.
// Primary source: the sheet's `site_tab` column.
// Fallback (when blank): content-based heuristics.
function getSiteTab(e) {
  const raw = (e.site_tab || '').trim()
  if (raw) return raw  // sheet value wins — no guessing

  // ── Fallback heuristics when site_tab is blank ──────────────────────────
  const type     = (e.event_type || '').toLowerCase().trim()
  const category = (e.category   || '').toLowerCase().trim()
  const date     = parseEventDate(e.date)
  const isFriday = date !== null && date.getDay() === 5

  // Watch Fest: any watch party, tailgate, or sports-category event
  if (
    type.includes('watch')      ||
    type.includes('tailgate')   ||
    category.includes('sport')  ||
    category.includes('soccer') ||
    category.includes('football') ||
    category.includes('dodger') ||
    category.includes('worldcup') ||
    category.includes('world cup')
  ) return 'Watch Fest'

  // Special
  if (type.includes('special')) return 'Special'

  // Friday Night: on a Friday with a club/party/friday_night type
  if (isFriday && (
    type === 'friday_night' ||
    type.includes('club')   ||
    type.includes('party')
  )) return 'Friday Night'

  return 'Other'
}

function EventsPage({ data, loading }) {
  const [filter, setFilter] = useState('all')

  const events = data.events.filter(e => {
    if (!isActiveItem(e.active)) return false
    if (!e.event_name || !e.event_name.trim()) return false

    if (filter === 'today') {
      const d = parseEventDate(e.date)
      if (!d) return false
      const now = new Date()
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    }

    if (filter === 'thisweek') {
      const d = parseEventDate(e.date)
      if (!d) return false
      const now = new Date()
      const sevenDaysLater = new Date(now); sevenDaysLater.setDate(now.getDate() + 7)
      return d >= now && d <= sevenDaysLater
    }

    if (!isUpcoming(e)) return false

    if (filter === 'all') return true

    // site_tab-based tab matching
    return getSiteTab(e) === filter
  }).sort((a, b) => {
    const da = parseEventDate(a.date) || new Date(9999, 0)
    const db = parseEventDate(b.date) || new Date(9999, 0)
    return da - db
  })

  return (
    <div className="page-top">
      <section className="section">
        <div className="container">
          <LiveBadge />
          <div className="section-tag">All Events</div>
          <h1 className="section-heading neon-blue mb-32">EVENTS</h1>

          <div className="filter-bar">
            {FILTER_OPTIONS.map(f =>
              f.to ? (
                <Link key={f.value} to={f.to} className="filter-btn">{f.label}</Link>
              ) : (
                <button
                  key={f.value}
                  className={`filter-btn${filter === f.value ? ' active' : ''}`}
                  onClick={() => setFilter(f.value)}
                >{f.label}</button>
              )
            )}
          </div>

          {loading ? (
            <div className="events-grid">{[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}</div>
          ) : events.length > 0 ? (
            <div className="events-grid">
              {events.map((e, i) => <EventCard key={i} event={e} />)}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">📅</div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, marginBottom: 8 }}>No Events Yet</h3>
              <p>Nothing listed for this filter — check back soon or follow @LatinDistrictLA.</p>
            </div>
          )}

          <div className="cta-section" style={{ marginTop: 64 }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, marginBottom: 8 }}>WANT YOUR EVENT LISTED?</h3>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 15, color: 'var(--muted)', marginBottom: 24 }}>
              Submit your event and get in front of the Latin District audience.
            </p>
            <Link to="/submit-event" className="btn btn-blue">Submit Your Event →</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── VENUES PAGE ─────────────────────────────────────────────────────────────

function VenuesPage({ data, loading }) {
  const venues = (data.venues.length > 0 ? data.venues : FALLBACK_VENUES)
    .filter(v => isActiveItem(v.active))

  return (
    <div className="page-top">
      <section className="section">
        <div className="container">
          <LiveBadge />
          <div className="section-tag">The Network</div>
          <h1 className="section-heading neon-blue mb-32">VENUES</h1>

          {loading ? (
            <div className="venues-grid">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{ background: '#0D0D1F', border: '1px solid rgba(255,255,255,.06)', borderRadius: 4, height: 280 }} />
              ))}
            </div>
          ) : (
            <div className="venues-grid">
              {venues.map((v, i) => <VenueCard key={i} venue={v} />)}
            </div>
          )}

          <div className="cta-section" style={{ marginTop: 64 }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, marginBottom: 8 }}>IS YOUR VENUE MISSING?</h3>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 15, color: 'var(--muted)', marginBottom: 24 }}>
              Join the Latin District network and reach Friday night crowds across DTLA.
            </p>
            <Link to="/contact" className="btn btn-blue">Get Listed →</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── FRIDAY NIGHT PAGE ───────────────────────────────────────────────────────

function FridayNightPage({ data, loading }) {
  // Events tab: active/approved rows whose date falls on a Friday
  const fridayEvents = useMemo(() =>
    data.events.filter(e => {
      if (!isActiveItem(e.active)) return false
      if (!isUpcoming(e)) return false
      const d = parseEventDate(e.date)
      return d !== null && d.getDay() === 5
    })
  , [data.events])

  const hasAny = fridayEvents.length > 0

  return (
    <div className="page-top">
      {/* Hero */}
      <section className="page-hero scanlines" style={{ background: 'linear-gradient(180deg, rgba(255,23,68,.08) 0%, #06060F 100%)' }}>
        <div className="page-hero__bg-text">FRI</div>
        <div className="page-hero__title">
          <div style={{ color: 'var(--cream)' }}>FRIDAY NIGHT</div>
          <div className="neon-red" style={{ color: 'var(--red)' }}>LATIN DISTRICT</div>
        </div>
        <p style={{ fontFamily: 'var(--font-label)', fontSize: 16, color: 'var(--muted)', maxWidth: 500, margin: '20px auto 36px', lineHeight: 1.5, position: 'relative', zIndex: 1 }}>
          Every Friday. 10PM – 2AM. Multiple venues across DTLA.<br />
          Different vibes. Same culture.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <Link to="/events" className="btn btn-red">See Events →</Link>
        </div>
      </section>

      <NeonDivider />

      {/* Live Lineup */}
      <section className="section">
        <div className="container">
          <LiveBadge text="Live lineup updated every week" />
          <div className="section-tag">This Friday</div>
          <h2 className="section-heading neon-red mb-32" style={{ color: 'var(--red)' }}>LIVE LINEUP</h2>
          {loading ? (
            <div className="events-grid">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
          ) : hasAny ? (
            <div className="events-grid">
              {fridayEvents.map((e, i) => <EventCard key={`ev-${i}`} event={e} />)}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">🎵</div>
              <p>Friday night lineup drops soon — follow @LatinDistrictLA for updates.</p>
            </div>
          )}
        </div>
      </section>

      <NeonDivider />

      {/* Genre Tiles */}
      <section className="section" style={{ background: '#080812' }}>
        <div className="container">
          <div className="section-tag">Music</div>
          <h2 className="section-heading neon-blue mb-32">GENRES ACROSS THE DISTRICT</h2>
          <div className="genre-grid">
            {GENRES.map((g, i) => (
              <div key={i} className="genre-tile">
                <div className="genre-tile__name">{g.name}</div>
                <div className="genre-tile__sub">{g.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* Night Timeline */}
      <section className="section">
        <div className="container" style={{ maxWidth: 720 }}>
          <div className="section-tag">The Night</div>
          <h2 className="section-heading neon-red mb-32" style={{ color: 'var(--red)' }}>HOW THE NIGHT FLOWS</h2>
          <div className="timeline">
            {[
              { time: '10PM', title: 'Doors Open', desc: 'Venues open across the district. Pre-game drink specials at every stop.' },
              { time: '11PM', title: 'Peak Hours Begin', desc: 'DJs in full swing. Dance floors filling up. Bar Crawl passports being stamped.' },
              { time: '12AM', title: 'Midnight Surge', desc: 'Cross-venue movement peaks. Live performances, guest DJs, and specials kick in.' },
              { time: '2AM', title: 'Last Call', desc: 'Wrap the night at your favorite spot. After-hours info at the door.' },
            ].map((item, i) => (
              <div key={i} className="timeline-item">
                <div className="timeline-time">{item.time}</div>
                <div>
                  <div className="timeline-content__title">{item.title}</div>
                  <div className="timeline-content__desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* How It Works */}
      <section className="section">
        <div className="container">
          <div className="section-tag">Simple</div>
          <h2 className="section-heading mb-32">HOW IT WORKS</h2>
          <div className="steps-grid">
            {[
              { num: '01', title: 'Pick Your Venue', desc: 'Browse the district map and choose where to start your Friday night.' },
              { num: '02', title: 'Move Freely', desc: 'Walk between venues — all within walking distance in DTLA. No Uber required.' },
              { num: '03', title: 'Stay All Night', desc: 'Different DJs, different vibes, same culture. Stay til 2AM at your favorite spot.' },
            ].map((s, i) => (
              <div key={i} className="step">
                <div className="step__num">{s.num}</div>
                <div>
                  <div className="step__title">{s.title}</div>
                  <div className="step__desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}


// ── BAR CRAWL PAGE ──────────────────────────────────────────────────────────

const PASSPORT_VENUES = [
  'A Toda Madre', 'Florentín Rooftop', 'The Association',
  'The Grayson', 'La Cita', 'Continental Club',
]

const ROUTE_A = [
  { time: '7:45 PM', venue: 'A Toda Madre',      address: '626 S Spring St', stop: 'Check-in + welcome briefing. Wristbands issued.' },
  { time: '8:50 PM', venue: 'Florentín Rooftop', address: '617 S Spring St, 8th fl', stop: 'Rooftop skyline views. 21+ strictly enforced. No smoking/vaping.' },
  { time: '10:00 PM', venue: 'The Association',   address: '110 E 6th St', stop: 'Happy hour til 10:30 PM — $10 cocktails / $6 beers.' },
  { time: '11:10 PM', venue: 'Continental Club',  address: '116 W 4th St', stop: 'Shared finale. Enter via alley off 4th St. Happy hour til 11 PM.' },
]

const ROUTE_B = [
  { time: '7:45 PM', venue: 'The Grayson',       address: '351 S Broadway', stop: 'Check-in + welcome briefing. No cover. 21+ with valid ID.' },
  { time: '8:55 PM', venue: 'La Cita Bar',        address: '336 S Hill St', stop: 'Daily happy hour 4–9 PM. Free entry with RSVP before 10 PM.' },
  { time: '10:10 PM', venue: 'Continental Club',  address: '116 W 4th St', stop: 'Shared finale. Alley entry off 4th St. Happy hour til 11 PM.' },
  { time: '11:35 PM', venue: 'West Eight',        address: '425 W 8th St', stop: 'Optional afterparty. Strict dress code. Bags searched at door.' },
]

function RouteTable({ route, color, label }) {
  const accentColor = color === 'A' ? 'var(--blue)' : 'var(--purple)'
  const stops = color === 'A' ? ROUTE_A : ROUTE_B
  return (
    <div style={{ background: 'var(--card-bg)', border: `1px solid ${accentColor}33`, borderRadius: 4, overflow: 'hidden', marginBottom: 32 }}>
      <div style={{ background: `${accentColor}11`, borderBottom: `1px solid ${accentColor}33`, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: accentColor }}>ROUTE {color}</span>
        <span style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Venue</th>
              <th>Address</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((s, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'var(--font-heading)', fontSize: 20, color: accentColor, whiteSpace: 'nowrap' }}>{s.time}</td>
                <td style={{ fontFamily: 'var(--font-label)', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.venue}</td>
                <td style={{ color: 'var(--muted)', fontSize: 13 }}>{s.address}</td>
                <td style={{ fontSize: 13, color: 'var(--cream)', maxWidth: 260 }}>{s.stop}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BarCrawlPage({ data, loading }) {
  const [stamps, setStamps] = useState([false, false, false, false, false, false])
  const allStamped = stamps.every(Boolean)
  const [activeRoute, setActiveRoute] = useState('A')

  const toggleStamp = (i) => setStamps(prev => { const n=[...prev]; n[i]=!n[i]; return n })

  // Drink specials from sheet, keyed by venue name for overlay on route tables
  const specials = Object.fromEntries(
    data.barcrawl.filter(s => s.active !== 'no').map(s => [s.venue_name, s.drink_special])
  )

  return (
    <div className="page-top">
      {/* Hero */}
      <section className="page-hero scanlines" style={{ background: 'linear-gradient(180deg, rgba(213,0,249,.08) 0%, #06060F 100%)' }}>
        <div className="page-hero__bg-text" style={{ color: 'rgba(213,0,249,.03)' }}>CRAWL</div>
        <div className="page-hero__title">
          <div style={{ color: 'var(--cream)' }}>BAR</div>
          <div className="neon-purple" style={{ color: 'var(--purple)' }}>CRAWL</div>
        </div>
        <p style={{ fontFamily: 'var(--font-label)', fontSize: 16, color: 'var(--muted)', maxWidth: 520, margin: '20px auto 12px', lineHeight: 1.5, position: 'relative', zIndex: 1 }}>
          Two guided routes. Eight venues. One DTLA Friday night.<br />
          Wristband perks, drink specials, and guides who get you home safe.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)', marginBottom: 32, position: 'relative', zIndex: 1 }}>
          <span>⏰ Check-in 7:45 PM</span>
          <span>🔞 21+ · Valid ID required</span>
          <span>👟 Stylish attire recommended</span>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <Link to="#tickets" className="btn btn-purple">Get Tickets →</Link>
          <Link to="/contact" className="btn btn-outline-blue">Book a Group</Link>
        </div>
      </section>

      <NeonDivider />

      {/* How It Works */}
      <section className="section">
        <div className="container">
          <div className="section-tag">The Process</div>
          <h2 className="section-heading mb-32">HOW IT WORKS</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
            {[
              { num: '01', title: 'Buy Your Ticket', desc: 'Choose Early Bird ($20), General ($25), or Door ($30). You\'ll receive a QR code by email.' },
              { num: '02', title: 'Check In at 7:45 PM', desc: 'Show your QR + valid 21+ ID at your route\'s start venue. Get your color-coded wristband and printed route card.' },
              { num: '03', title: 'Follow Your Route', desc: 'Guides lead the group on foot between 4 stops. Stay with the group, use the buddy system, and enjoy venue specials at every door.' },
              { num: '04', title: 'Collect Stamps & Finish Together', desc: 'Both routes converge at Continental Club for the shared finale. Optional West Eight afterparty access for those who want to keep going.' },
            ].map((s, i) => (
              <div key={i} className="step">
                <div className="step__num" style={{ color: 'var(--purple)', fontSize: 48, minWidth: 60 }}>{s.num}</div>
                <div>
                  <div className="step__title">{s.title}</div>
                  <div className="step__desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* Pricing */}
      <section className="section" id="tickets" style={{ background: '#080812' }}>
        <div className="container">
          <div className="section-tag">Tickets</div>
          <h2 className="section-heading mb-8">CHOOSE YOUR PASS</h2>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)', marginBottom: 32 }}>
            Every ticket includes guided routes, wristband perks, and venue specials. 21+ only — valid ID required at every stop.
          </p>
          <div className="pricing-grid">
            <div className="pricing-card">
              <div className="pricing-card__tier text-blue">Early Bird</div>
              <div className="pricing-card__price text-blue">$20</div>
              <div className="pricing-card__per">advance purchase only</div>
              <ul className="pricing-card__features">
                {['All 4 stops on your route','Color-coded wristband','Printed route card','Venue drink specials','Guided group experience','Rideshare assistance at end'].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <button className="btn btn-outline-blue w-full" disabled style={{ opacity: .5, cursor: 'not-allowed' }}>Coming Soon</button>
            </div>

            <div className="pricing-card featured">
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--purple)', color: '#fff', fontFamily: 'var(--font-label)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 100, whiteSpace: 'nowrap' }}>Most Popular</div>
              <div className="pricing-card__tier text-purple neon-purple">General</div>
              <div className="pricing-card__price text-purple">$25</div>
              <div className="pricing-card__per">per person</div>
              <ul className="pricing-card__features">
                {['Everything in Early Bird','Priority check-in lane','Stamp reward eligibility','Access to finale at Continental Club','Optional West Eight afterparty access'].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <button className="btn btn-purple w-full" disabled style={{ opacity: .5, cursor: 'not-allowed' }}>Coming Soon</button>
            </div>

            <div className="pricing-card">
              <div className="pricing-card__tier text-gold neon-gold">Door</div>
              <div className="pricing-card__price text-gold">$30</div>
              <div className="pricing-card__per">night-of · subject to availability</div>
              <ul className="pricing-card__features">
                {['Everything in General','Pay at the door (cash or card)','Subject to capacity','No advance QR required','Wristband issued on arrival'].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <button className="btn btn-gold w-full" disabled style={{ opacity: .5, cursor: 'not-allowed' }}>Coming Soon</button>
            </div>
          </div>

          {/* Group note */}
          <div style={{ marginTop: 24, background: 'rgba(0,229,255,.06)', border: '1px solid rgba(0,229,255,.15)', borderRadius: 4, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 24 }}>🎂</span>
            <div>
              <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 14 }}>Groups of 6+ — Birthdays &amp; Bachelorettes</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Group rate available. Dedicated coordinator. Contact us to book.</div>
            </div>
            <Link to="/contact" className="btn btn-outline-blue" style={{ marginLeft: 'auto', fontSize: 13, padding: '8px 16px', minHeight: 40 }}>Book a Group →</Link>
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* Routes */}
      <section className="section">
        <div className="container">
          <div className="section-tag">Timed Routes</div>
          <h2 className="section-heading neon-purple mb-8" style={{ color: 'var(--purple)' }}>THE ROUTES</h2>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>
            Both routes check in simultaneously at 7:45 PM and converge at Continental Club around 11:10 PM.
            All venues are walkable — guides manage every group transition.
          </p>

          {/* Mobile tab switcher */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {['A','B'].map(r => (
              <button key={r} onClick={() => setActiveRoute(r)}
                className={`filter-btn${activeRoute === r ? ' active' : ''}`}
                style={{ flex: 1 }}>
                Route {r} {r === 'A' ? '— Toda Madre → Continental' : '— Grayson → West Eight'}
              </button>
            ))}
          </div>

          {/* Desktop: show both; Mobile: show active */}
          <div style={{ display: 'block' }}>
            <div style={{ display: activeRoute === 'A' ? 'block' : 'none' }} className="route-panel">
              <RouteTable route={data.barcrawl} color="A" label="A Toda Madre → Florentín → The Association → Continental Club" />
            </div>
            <div style={{ display: activeRoute === 'B' ? 'block' : 'none' }} className="route-panel">
              <RouteTable route={data.barcrawl} color="B" label="The Grayson → La Cita → Continental Club → West Eight (afterparty)" />
            </div>
          </div>

          {/* Drink specials from sheet */}
          {!loading && Object.keys(specials).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="section-tag" style={{ marginBottom: 12 }}>This Week's Specials</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {Object.entries(specials).map(([venue, special], i) => (
                  <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid rgba(0,229,255,.1)', borderRadius: 4, padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{venue}</div>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--blue)' }}>{special}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <NeonDivider />

      {/* Interactive Passport */}
      <section className="section">
        <div className="container" style={{ maxWidth: 600 }}>
          <div className="section-tag">Digital Passport</div>
          <h2 className="section-heading neon-purple mb-8" style={{ color: 'var(--purple)' }}>YOUR PASSPORT</h2>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)', marginBottom: 32 }}>
            Tap each stamp as you visit venues tonight. Preview how it works!
          </p>

          <div style={{ background: 'rgba(213,0,249,.05)', border: '1px solid rgba(213,0,249,.2)', borderRadius: 8, padding: 24, marginBottom: 32 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--purple)', marginBottom: 4 }}>LATIN DISTRICT LA</div>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--muted)', marginBottom: 24, letterSpacing: '.1em', textTransform: 'uppercase' }}>Friday Bar Crawl Passport · {new Date().getFullYear()}</div>
            <div className="passport-grid">
              {PASSPORT_VENUES.map((venue, i) => (
                <div key={i} onClick={() => toggleStamp(i)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className={`stamp${stamps[i] ? ' filled' : ''}`}>
                    {stamps[i] ? '✓' : i + 1}
                  </div>
                  <div className="stamp-label">{venue.split(' ').slice(0, 2).join(' ')}</div>
                </div>
              ))}
            </div>
          </div>

          {allStamped && (
            <div style={{ background: 'linear-gradient(135deg, rgba(213,0,249,.15), rgba(0,229,255,.1))', border: '1px solid var(--purple)', borderRadius: 8, padding: 24, textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, color: 'var(--purple)', marginBottom: 8 }}>PASSPORT COMPLETE!</div>
              <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)' }}>
                Show this to your Latin District guide to claim your rewards!
              </p>
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
              {stamps.filter(Boolean).length} of 6 stamps collected
            </p>
            {stamps.some(Boolean) && (
              <button className="btn btn-outline-blue" onClick={() => setStamps([false,false,false,false,false,false])} style={{ fontSize: 12 }}>
                Reset Preview
              </button>
            )}
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* Rewards */}
      <section className="section" style={{ background: '#080812' }}>
        <div className="container" style={{ maxWidth: 600 }}>
          <div className="section-tag">Benefits</div>
          <h2 className="section-heading mb-24">STAMP REWARDS</h2>
          <div>
            {[
              { icon: '🎟️', reward: 'Free Early Bird ticket to next bar crawl — collect all 6 stamps' },
              { icon: '👕', reward: 'Latin District merch discounts at pop-up drops' },
              { icon: '💸', reward: 'Drink discounts at partner venues on future Fridays' },
              { icon: '⭐', reward: 'Priority upgrade to General from Early Bird on your next crawl' },
              { icon: '🎂', reward: 'Birthday & bachelorette group packages — ask your guide' },
            ].map((r, i) => (
              <div key={i} className="reward-item">
                <div className="reward-item__icon">{r.icon}</div>
                <div style={{ fontSize: 15 }}>{r.reward}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

// ── CONTACT PAGE ────────────────────────────────────────────────────────────

function ContactPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', company: '', type: '', subject: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    const cfToken = document.querySelector('[name="cf-turnstile-response"]')?.value || ''
    try {
      const res = await fetch('/.netlify/functions/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, cf_token: cfToken }),
      })
      if (res.status >= 500) return  // suppress — email was still sent
      trackContactSubmit()
      navigate('/?success=contact', { replace: true })
    } catch {
      // network error — suppress
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-top">
      <section className="section">
        <div className="container">
          <div className="section-tag">Get In Touch</div>
          <h1 className="section-heading neon-blue mb-32">CONTACT</h1>

          {/* Collab Cards */}
          <div className="collab-grid mb-48">
            {[
              { icon: '🏠', title: 'Venues', desc: 'Join the Latin District network. Get Friday night traffic, event listings, and bar crawl route placement.' },
              { icon: '🎧', title: 'Promoters', desc: 'Promote your Latin events to our engaged DTLA audience. Submit events or collaborate on promotions.' },
              { icon: '🤝', title: 'Brands & Sponsors', desc: 'Reach Latin LA nightlife culture. Drink sponsorships, event activations, and branded experiences.' },
              { icon: '📸', title: 'Media & Press', desc: 'Coverage, interviews, press passes. We\'re building something special — document it with us.' },
            ].map((c, i) => (
              <div key={i} className="collab-card">
                <div className="collab-card__icon">{c.icon}</div>
                <div className="collab-card__title">{c.title}</div>
                <div className="collab-card__desc">{c.desc}</div>
              </div>
            ))}
          </div>

          <NeonDivider />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 48, marginTop: 48 }}>
            {/* Social info */}
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 36, marginBottom: 24 }}>FIND US</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { icon: '📸', label: 'Instagram', val: '@LatinDistrictLA', href: 'https://instagram.com/LatinDistrictLA' },
                  { icon: '🎵', label: 'TikTok', val: '@LatinDistrictLA', href: 'https://tiktok.com/@LatinDistrictLA' },
                  { icon: '📍', label: 'Location', val: 'Downtown Los Angeles, CA', href: null },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 24 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-label)', fontSize: 11, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{s.label}</div>
                      {s.href ? (
                        <a href={s.href} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-label)', fontSize: 15, color: 'var(--blue)' }}>{s.val}</a>
                      ) : (
                        <div style={{ fontFamily: 'var(--font-label)', fontSize: 15, color: 'var(--cream)' }}>{s.val}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input required className="form-input" value={form.name} onChange={set('name')} placeholder="Your name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input required type="email" className="form-input" value={form.email} onChange={set('email')} placeholder="you@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Company / Venue</label>
                  <input className="form-input" value={form.company} onChange={set('company')} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label">I Am A *</label>
                  <select required className="form-select" value={form.type} onChange={set('type')}>
                    <option value="">Select…</option>
                    <option value="venue">Venue</option>
                    <option value="promoter">Promoter</option>
                    <option value="brand">Brand / Sponsor</option>
                    <option value="media">Media / Press</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Subject *</label>
                  <input required className="form-input" value={form.subject} onChange={set('subject')} placeholder="What's this about?" />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Message *</label>
                  <textarea required className="form-textarea" value={form.message} onChange={set('message')} placeholder="Tell us more…" rows={5} />
                </div>
              </div>
              {import.meta.env.VITE_TURNSTILE_SITE_KEY && (
                <div
                  className="cf-turnstile"
                  data-sitekey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  data-theme="dark"
                  style={{ marginBottom: 12 }}
                />
              )}
              <button type="submit" className="btn btn-blue w-full" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Message →'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── CALENDAR PAGE ────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function CalendarPage({ data, loading }) {
  const today = new Date()
  const [curYear, setCurYear]   = useState(today.getFullYear())
  const [curMonth, setCurMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay]   = useState(null)
  const [calModalEvent, setCalModalEvent] = useState(null)

  // active=TRUE is the only publish gate — no status check needed.
  const approvedEvents = useMemo(() => data.events.filter(e => {
    if (!isActiveItem(e.active)) return false
    if (!isUpcoming(e)) return false
    return true
  }), [data.events])

  const eventsByDate = useMemo(() => {
    const map = {}
    approvedEvents.forEach(e => {
      const d = parseEventDate(e.date)
      if (!d) return
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push({ ...e, _type: 'event' })
    })
    return map
  }, [approvedEvents])

  // Upcoming events list — all approved items from today onward, sorted by date
  const upcomingList = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    return approvedEvents
      .map(e => ({ ...e, _type: 'event' }))
      .filter(item => {
        const d = parseEventDate(item.date)
        return d && d.getTime() >= todayMs
      })
      .sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date))
  }, [approvedEvents])

  const firstDayOfMonth = new Date(curYear, curMonth, 1).getDay()
  const daysInMonth     = new Date(curYear, curMonth + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const goToPrev = () => {
    setSelectedDay(null)
    if (curMonth === 0) { setCurYear(y => y - 1); setCurMonth(11) }
    else setCurMonth(m => m - 1)
  }
  const goToNext = () => {
    setSelectedDay(null)
    if (curMonth === 11) { setCurYear(y => y + 1); setCurMonth(0) }
    else setCurMonth(m => m + 1)
  }

  const isToday = (day) =>
    day === today.getDate() && curMonth === today.getMonth() && curYear === today.getFullYear()

  const getDayEvents = (day) => eventsByDate[`${curYear}-${curMonth}-${day}`] || []

  return (
    <div className="page-top">
      <section className="section">
        <div className="container">
          <div style={{ marginBottom: 20 }}>
            <Link to="/events" className="btn btn-outline-blue" style={{ fontSize: 13, padding: '8px 16px', minHeight: 36 }}>
              ← Back to Events
            </Link>
          </div>
          <LiveBadge />
          <div className="section-tag">Upcoming Events</div>
          <h1 className="section-heading neon-blue mb-32">CALENDAR</h1>

          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
            <button className="btn btn-outline-blue" style={{ padding: '8px 14px', fontSize: 13, minHeight: 40 }} onClick={goToPrev}>← Prev</button>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(22px, 6vw, 40px)', color: 'var(--cream)', textAlign: 'center' }}>
              {MONTH_NAMES[curMonth]} {curYear}
            </h2>
            <button className="btn btn-outline-blue" style={{ padding: '8px 14px', fontSize: 13, minHeight: 40 }} onClick={goToNext}>Next →</button>
          </div>

          {/* Calendar grid */}
          <div className="cal-grid">
            {DAY_NAMES.map(d => (
              <div key={d} className="cal-day-header">{d}</div>
            ))}
            {loading
              ? Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="cal-cell" style={{ background: 'rgba(255,255,255,.03)' }} />
                ))
              : cells.map((day, i) => {
                  if (!day) return <div key={i} className="cal-cell cal-cell--empty" />
                  const dayEvents = getDayEvents(day)
                  return (
                    <div
                      key={i}
                      className={`cal-cell${dayEvents.length ? ' cal-cell--has-events' : ''}${isToday(day) ? ' cal-cell--today' : ''}${selectedDay === day ? ' cal-cell--selected' : ''}`}
                      onClick={() => dayEvents.length && setSelectedDay(d => d === day ? null : day)}
                      role={dayEvents.length ? 'button' : undefined}
                      tabIndex={dayEvents.length ? 0 : undefined}
                      onKeyDown={dayEvents.length ? (e) => e.key === 'Enter' && setSelectedDay(d => d === day ? null : day) : undefined}
                    >
                      <div className="cal-cell__num">{day}</div>
                      {dayEvents.slice(0, 2).map((ev, j) => {
                        const name = ev.event_name || ''
                        return (
                          <div key={j} className="cal-event-dot" style={{ borderLeft: '2px solid var(--red)' }}>
                            <span>🎉</span>
                            {name.slice(0, 16)}{name.length > 16 ? '…' : ''}
                          </div>
                        )
                      })}
                      {dayEvents.length > 2 && (
                        <div className="cal-event-more">+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  )
                })
            }
          </div>

          {/* Selected day events — inline, no popup */}
          {selectedDay !== null && (() => {
            const dayEvts = getDayEvents(selectedDay)
            if (!dayEvts.length) return null
            return (
              <div style={{ marginTop: 20, padding: '16px 20px', background: 'rgba(0,229,255,.05)', border: '1px solid rgba(0,229,255,.2)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 20, color: 'var(--cream)' }}>
                    {MONTH_NAMES[curMonth]} {selectedDay}
                  </span>
                  <button onClick={() => setSelectedDay(null)} aria-label="Clear selection" style={{ fontSize: 18, color: 'var(--muted)', padding: 6, minHeight: 36, minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {dayEvts.map((ev, i) => {
                    const name  = ev.event_name || 'Event'
                    const badge = BADGE_COLORS[ev.event_type] || BADGE_COLORS.special
                    const imgUrl = convertDriveUrl(ev.flyer_image_url)
                    return (
                      <div
                        key={i}
                        onClick={() => setCalModalEvent(ev)}
                        style={{ display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer', borderRadius: 4, padding: '4px 0', transition: 'opacity .15s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '.8'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 3, overflow: 'hidden', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                          {imgUrl
                            ? <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                            : '🎉'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="event-card__badge" style={{ background: badge.bg, color: badge.color, marginBottom: 4, display: 'inline-block' }}>{badge.label}</span>
                          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, color: 'var(--cream)', lineHeight: 1.2 }}>{name}</div>
                          {ev.venue && <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>📍 {ev.venue}{ev.time ? ` · ${ev.time}` : ''}</div>}
                        </div>
                        {ev.ticket_link && (
                          <a
                            href={ev.ticket_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-red"
                            style={{ fontSize: 12, padding: '8px 12px', minHeight: 34, flexShrink: 0, alignSelf: 'center' }}
                            onClick={e => { e.stopPropagation(); trackTicketClick(ev, 'nightlife') }}
                          >Tickets →</a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap', fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--muted)' }}>
            {[
              { color: 'var(--red)',  label: 'Events' },
              { color: 'var(--blue)', label: 'Today', border: true },
            ].map(({ color, label, border }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block', boxShadow: border ? `0 0 0 2px ${color}` : 'none' }} />
                {label}
              </span>
            ))}
          </div>

          {/* ── Upcoming Events List ── */}
          <div style={{ marginTop: 48 }}>
            <div className="section-tag">Upcoming</div>
            <h2 className="section-heading mb-24" style={{ fontSize: 'clamp(28px, 6vw, 48px)' }}>ALL UPCOMING EVENTS</h2>
            {loading ? (
              <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-label)', fontSize: 14 }}>Loading events…</div>
            ) : upcomingList.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <div className="empty-state__icon">📅</div>
                <p>No upcoming events yet — check back soon.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {upcomingList.map((item, i) => {
                  const name   = item.event_name || 'Event'
                  const badge  = BADGE_COLORS[item.event_type] || BADGE_COLORS.special
                  const imgUrl = convertDriveUrl(item.flyer_image_url)
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 16,
                        alignItems: 'flex-start',
                        padding: '16px 0',
                        borderBottom: '1px solid rgba(255,255,255,.07)',
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 3, overflow: 'hidden', background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                        {imgUrl
                          ? <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML='🎉' }} />
                          : '🎉'}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span className="event-card__badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px, 4vw, 20px)', color: 'var(--cream)', lineHeight: 1.1, marginBottom: 4 }}>{name}</div>
                        <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                          <span>📅 {formatDate(item.date)}{item.time ? ` · ${item.time}` : ''}</span>
                          {item.venue && <span>📍 {item.venue}</span>}
                        </div>
                      </div>
                      {/* Ticket */}
                      {item.ticket_link && (
                        <a
                          href={item.ticket_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-red"
                          style={{ fontSize: 12, padding: '8px 14px', minHeight: 36, flexShrink: 0, alignSelf: 'center' }}
                          onClick={() => trackTicketClick(item, 'nightlife')}
                        >
                          Tickets →
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Submit CTA */}
          <div className="cta-section" style={{ marginTop: 48 }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, marginBottom: 8 }}>WANT YOUR EVENT ON THE CALENDAR?</h3>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
              Submit your event and get it in front of the Latin District audience.
            </p>
            <Link to="/submit-event" className="btn btn-blue">Submit Your Event →</Link>
          </div>
        </div>
      </section>

      {calModalEvent && createPortal(
        <EventModal event={calModalEvent} onClose={() => setCalModalEvent(null)} />,
        document.body
      )}
    </div>
  )
}

// ── App Root ─────────────────────────────────────────────────────────────────

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    trackPageview()
  }, [pathname])
  return null
}

export default function App() {
  const { data, loading } = useSheets()

  // Preload above-fold images once sheet data is ready.
  // Uses new Image() — pure browser hint, no extra Netlify function calls.
  useEffect(() => {
    if (loading) return
    const srcs = []
    const evts = data.events || []

    const flagship = evts.find(e => isActiveItem(e.active) && isFlagshipItem(e) && isUpcoming(e))
    if (flagship?.flyer_image_url) srcs.push(convertDriveUrl(flagship.flyer_image_url))

    const { events: weekendEvs } = getThisWeekendEvents(evts)
    weekendEvs.forEach(e => { if (e.flyer_image_url) srcs.push(convertDriveUrl(e.flyer_image_url)) })

    srcs.slice(0, 6).forEach(src => { const img = new Image(); img.src = src })
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Nav />
      <Routes>
        <Route path="/" element={<HomePage data={data} loading={loading} />} />
        <Route path="/events" element={<EventsPage data={data} loading={loading} />} />
        <Route path="/calendar" element={<CalendarPage data={data} loading={loading} />} />
        <Route path="/venues" element={<VenuesPage data={data} loading={loading} />} />
        <Route path="/friday-night" element={<FridayNightPage data={data} loading={loading} />} />
        <Route path="/watchfest" element={<Navigate to="/events" replace />} />
        <Route path="/bar-crawl" element={
          <div className="page-top" style={{ textAlign: 'center', padding: '120px 24px' }}>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--purple)', marginBottom: 20 }}>Coming Soon</div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(48px, 12vw, 96px)', color: 'var(--cream)', lineHeight: 1, marginBottom: 20 }}>BAR CRAWL</h1>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 16, color: 'var(--muted)', maxWidth: 420, margin: '0 auto 32px', lineHeight: 1.6 }}>
              We're finalizing routes, venues, and dates. Check back soon.
            </p>
            <Link to="/" className="btn btn-outline-blue">Back to Home</Link>
          </div>
        } />
        <Route path="/submit-event" element={<SubmitEventPage />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={
          <div className="page-top" style={{ textAlign: 'center', padding: '120px 24px' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 96, color: 'var(--blue)', marginBottom: 16 }}>404</div>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: 18, color: 'var(--muted)', marginBottom: 32 }}>Page not found</div>
            <Link to="/" className="btn btn-blue">Back to Home</Link>
          </div>
        } />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}
