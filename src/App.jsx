import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom'
import MediaCarousel from './MediaCarousel'
import Resources from './Resources'

// ── Constants ──────────────────────────────────────────────────────────────

const FALLBACK_VENUES = [
  { venue_name: 'Rhythm Room LA',      tag: 'Dance Floor · DJ Sets',          active: 'yes' },
  { venue_name: 'Las Perlas',           tag: 'Mezcal Bar · Cocktails',          active: 'yes' },
  { venue_name: 'The Grayson',          tag: 'Dancehall · Live Sound',          active: 'yes' },
  { venue_name: 'Continental Club',     tag: 'Bar · Social',                    active: 'yes' },
  { venue_name: 'Spring Street Bar',    tag: 'Neighborhood Bar',                active: 'yes' },
  { venue_name: 'Broken Shaker',        tag: 'Craft Cocktails · Patio',         active: 'yes' },
  { venue_name: 'The Slipper Clutch',   tag: 'Raw · Unexpected',                active: 'yes' },
  { venue_name: 'Caña Rum Bar',         tag: 'Rum · Latin Roots',               active: 'yes' },
  { venue_name: 'Chicka Bonita Lounge', tag: 'Lounge · Groups',                 active: 'yes' },
  { venue_name: 'Kiso',                 tag: 'Modern · DJ Sets',                active: 'yes' },
  { venue_name: 'Florentín Rooftop',    tag: 'Rooftop · Skyline Views',         active: 'yes' },
  { venue_name: 'A Toda Madre',         tag: 'Cultural · Bold',                 active: 'yes' },
  { venue_name: 'The Association',      tag: 'Underground · Original',          active: 'yes' },
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
  watch_fest:   { bg: 'rgba(255,179,0,.2)',   color: '#FFB300', label: 'Watch Fest' },
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
//   3. Admin re-hosts the image (e.g., uploads to Drive with "anyone with link can view",
//      Cloudinary, or any public CDN), then pastes the stable public URL into
//      flyer_image_url / venue_image_url columns.
//   4. Admin sets status = approved → row goes live on the site.
//
// If flyer_image_url or venue_image_url is empty, EventCard / WatchFest cards
// already skip the image block rather than rendering a broken <img>.
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
  // YYYY-MM-DD strings are parsed as UTC midnight by the JS spec, which shifts
  // the date backward in negative-offset timezones (e.g. LA, UTC-7/8).
  // Re-parse as local midnight to match the exact date shown in the sheet.
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3])
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function formatDate(str) {
  if (!str) return ''
  try {
    const d = parseEventDate(str)
    if (!d || isNaN(d.getTime())) return str
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return str }
}

// Encode form data for Netlify Forms (application/x-www-form-urlencoded)
function encode(data) {
  return Object.keys(data)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k] ?? ''))
    .join('&')
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

// ── Kickoff status helpers ───────────────────────────────────────────────────
// Uses kickoff_datetime to derive one of: 'upcoming' | 'live' | 'final'

const MATCH_DURATION_MS = 110 * 60 * 1000  // ~110 min window for "LIVE NOW"

function computeKickoffStatus(kickoffDatetime) {
  if (!kickoffDatetime) return null
  const kickoff = new Date(kickoffDatetime)
  if (isNaN(kickoff.getTime())) return null
  const diff = kickoff.getTime() - Date.now()
  if (diff > 0) return {
    state: 'upcoming',
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000)  / 60000),
  }
  if (diff > -MATCH_DURATION_MS) return { state: 'live' }
  return { state: 'final' }
}

function useKickoffStatus(kickoffDatetime) {
  const [s, setS] = useState(() => computeKickoffStatus(kickoffDatetime))
  useEffect(() => {
    setS(computeKickoffStatus(kickoffDatetime))
    if (!kickoffDatetime) return
    const id = setInterval(() => setS(computeKickoffStatus(kickoffDatetime)), 10000)
    return () => clearInterval(id)
  }, [kickoffDatetime])
  return s
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
// category           | friday_night | watch_fest | crawl | special
// description        | 2–3 sentence event description
// ticket_link        | URL
// video_url          | YouTube or TikTok URL
// flyer_image_url    | stable public URL — do NOT use raw Form upload Drive link here
// venue_image_url    | stable public URL — same note as above
// submitted_by_email | from Form submission
// submitted_at       | ISO timestamp
// notes_internal     | admin-only notes, never rendered on site
//
// STATUS MODERATION FILTER (applied in EventsPage and WatchFestPage):
//   if row.status field exists → only show when status === 'approved' (case-insensitive)
//   if row has no status field → show as before (legacy rows stay visible)

// ── useSheets hook ──────────────────────────────────────────────────────────

function useSheets() {
  const [data, setData] = useState({ events: [], venues: [], watchfest: [], barcrawl: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/.netlify/functions/sheets')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(e => {
        console.warn('Sheets fetch failed, using fallback data', e)
        setError(e.message)
        setData(prev => ({ ...prev, venues: FALLBACK_VENUES }))
        setLoading(false)
      })
  }, [])

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
    window.scrollTo({ top: 0, behavior: 'instant' })
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
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
            <a href={event.ticket_link} target="_blank" rel="noopener noreferrer" className="btn btn-red w-full" style={{ fontSize: 14, padding: '12px 20px' }}>
              Get Tickets →
            </a>
          ) : (
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
              No ticket link available
            </p>
          )}
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
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(14px, 4vw, 18px)', color: 'var(--cream)', marginBottom: 4 }}>{event.event_name}</div>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{event.venue} · {formatDate(event.date)}{event.time ? ` · ${event.time}` : ''}</div>
          <span className="event-card__badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
          {event.ticket_link && (
            <a
              href={event.ticket_link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-red w-full"
              style={{ marginTop: 4, fontSize: 13, padding: '10px 16px' }}
              onClick={e => e.stopPropagation()}
            >
              Get Tickets →
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

function VenueCard({ venue }) {
  const imgUrl = convertDriveUrl(venue.photo_url)
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

function KickoffStatus({ kickoffDatetime }) {
  const s = useKickoffStatus(kickoffDatetime)
  if (!s) return null
  if (s.state === 'live') return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-label)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', color: '#00C853', background: 'rgba(0,200,83,.12)', border: '1px solid rgba(0,200,83,.3)', borderRadius: 2, padding: '4px 10px', marginBottom: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00C853', display: 'inline-block', animation: 'pulse-live 1.5s ease-in-out infinite' }} />
      🔴 LIVE NOW
    </div>
  )
  if (s.state === 'final') return (
    <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', background: 'rgba(90,90,138,.15)', border: '1px solid rgba(90,90,138,.25)', borderRadius: 2, padding: '4px 10px', display: 'inline-block', marginBottom: 8 }}>
      FINAL
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--muted)' }}>
      <span style={{ color: 'var(--gold)', fontWeight: 700, letterSpacing: '.06em' }}>KICKOFF IN</span>
      {s.days > 0 && <span style={{ color: 'var(--cream)', fontWeight: 700 }}>{s.days}d</span>}
      <span style={{ color: 'var(--cream)', fontWeight: 700 }}>{String(s.hours).padStart(2,'0')}h</span>
      <span style={{ color: 'var(--cream)', fontWeight: 700 }}>{String(s.minutes).padStart(2,'0')}m</span>
    </div>
  )
}

function getWatchfestCategory(item) {
  const raw = (item.category || item.event_type || '').toLowerCase().trim()
  if (raw.includes('dodger')) return 'dodgers'
  if (raw.includes('world')) return 'worldcup'
  if ((item.match_name || '').toLowerCase().includes('dodger')) return 'dodgers'
  return 'worldcup'
}

function getVideoType(url) {
  if (!url) return null
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  return null
}

function WatchFestCard({ item }) {
  const isDodgers = getWatchfestCategory(item) === 'dodgers'
  const accentColor = isDodgers ? 'var(--blue)' : 'var(--gold)'
  const badgeBg = isDodgers ? 'rgba(0,229,255,.18)' : 'rgba(255,179,0,.18)'
  const status = item.status || ''
  const sc = STATUS_COLORS[status] || { bg: 'rgba(90,90,138,.2)', color: 'var(--muted)' }
  const title = item.match_name || item.event_name || 'Watch Fest Event'
  const crowdLevels = ['Low', 'Medium', 'High', 'Packed']
  const crowdColors = { Low: '#00C853', Medium: '#FFB300', High: '#FF6D00', Packed: '#FF1744' }

  // Build carousel: flyer first, venue second, video last. Apply Drive URL conversion to images.
  const videoType = getVideoType(item.video_url)
  const mediaEntries = []
  if (item.flyer_image_url)             mediaEntries.push({ url: convertDriveUrl(item.flyer_image_url), type: 'image' })
  if (item.venue_image_url)             mediaEntries.push({ url: convertDriveUrl(item.venue_image_url), type: 'image' })
  if (item.video_url && videoType)      mediaEntries.push({ url: item.video_url,                      type: videoType })
  const mediaUrls  = mediaEntries.map(m => m.url).join('|')
  const mediaTypes = mediaEntries.map(m => m.type).join('|')

  return (
    <div className="event-card">
      {mediaEntries.length > 0 && (
        <MediaCarousel mediaUrls={mediaUrls} mediaTypes={mediaTypes} />
      )}
      <div className="event-card__body">
        {/* ESPN Header: flags → stage → match name */}
        {item.team_flags && (
          <div style={{ fontSize: 24, marginBottom: 4, letterSpacing: '0.05em' }}>{item.team_flags}</div>
        )}
        {item.match_stage && (
          <div style={{ fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: accentColor, marginBottom: 4 }}>
            {item.match_stage}
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(15px, 4vw, 20px)', color: 'var(--cream)', lineHeight: 1.1, marginBottom: 8 }}>
          {title}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="event-card__badge" style={{ background: badgeBg, color: accentColor }}>
            {isDodgers ? 'Dodger Fest' : 'Goal City'}
          </span>
          {status && (
            <span className="status-badge" style={{ background: sc.bg, color: sc.color }}>{status}</span>
          )}
          {isFlagshipItem(item) && (
            <span className="status-badge" style={{ background: 'rgba(255,179,0,.12)', color: 'var(--gold)' }}>★ Flagship</span>
          )}
        </div>

        {/* Kickoff countdown / LIVE NOW / FINAL */}
        <KickoffStatus kickoffDatetime={item.kickoff_datetime} />

        {/* Date · time · venue · tailgate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8, fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)' }}>
          {(item.date || item.time) && (
            <span>📅 {formatDate(item.date)}{item.time ? ` · ${item.time}` : ''}</span>
          )}
          {item.venue && <span>📍 {item.venue}</span>}
          {item.tailgate_time && <span>🎉 Tailgate {item.tailgate_time}</span>}
        </div>

        {/* Crowd level indicator */}
        {item.crowd_level && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Crowd</span>
            {crowdLevels.map((lvl, i) => (
              <div key={lvl} style={{ width: 10, height: 10, borderRadius: 2, background: crowdLevels.indexOf(item.crowd_level) >= i ? (crowdColors[item.crowd_level] || 'var(--muted)') : 'rgba(255,255,255,.1)' }} />
            ))}
            <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, color: 'var(--cream)' }}>{item.crowd_level}</span>
          </div>
        )}

        {/* Description */}
        {item.description && (
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>
            {item.description}
          </p>
        )}

        {/* Ticket CTA */}
        {item.ticket_link ? (
          <a href={item.ticket_link} target="_blank" rel="noopener noreferrer" className="btn btn-red w-full" style={{ marginTop: 4, fontSize: 13, padding: '10px 16px' }}>
            Get Tickets →
          </a>
        ) : (
          <button className="btn btn-outline-blue w-full" style={{ marginTop: 4, fontSize: 13, padding: '10px 16px' }}>
            Ticket Link Coming Soon
          </button>
        )}
      </div>
    </div>
  )
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
  { to: '/watchfest',    label: 'Watch Fest' },
  { to: '/events',       label: 'Events' },
  { to: '/calendar',     label: 'Calendar' },
  { to: '/friday-night', label: 'Friday Night Latin District' },
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
  const featured = data.events.filter(e => e.featured === 'yes' && e.active !== 'no')
  const flagshipEvent = data.events.find(e => e.active !== 'no' && isFlagshipItem(e))
  const flagshipWatchFest = (data.watchfest || []).find(e => e.active !== 'no' && isFlagshipItem(e))
  const venueStrip = (data.venues.length > 0 ? data.venues : FALLBACK_VENUES)
    .filter(v => v.active !== 'no')
    .slice(0, 8)

  return (
    <div className="page-top">
      {/* ── Hero ── */}
      <section className="hero scanlines">
        <div className="hero__bg" />
        <div className="hero__content">
          <img src="/logo.png" alt="Latin District LA" className="hero__logo" onError={e => e.target.style.display = 'none'} />
          <div className="hero__headline">
            <div className="neon-white" style={{ color: '#fff' }}>LATIN</div>
            <div className="neon-white" style={{ color: '#fff' }}>DISTRICT</div>
          </div>
          <p className="hero__sub">Multiple venues. One district. Every Friday night in DTLA.</p>
          <div className="hero__buttons">
            <Link to="/events" className="btn btn-red">See This Week →</Link>
            <Link to="/bar-crawl" className="btn btn-outline-blue">Book Bar Crawl →</Link>
          </div>
        </div>
      </section>

      <NeonDivider />

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
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
                    <a href={flagshipEvent.ticket_link} target="_blank" rel="noopener noreferrer" className="btn btn-red">
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

      {/* ── Flagship Watch Fest Event ── */}
      {!loading && flagshipWatchFest && (
        <>
          <section className="section" style={{ background: 'linear-gradient(135deg, rgba(255,179,0,.05), rgba(0,0,0,0))' }}>
            <div className="container">
              <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold)', background: 'rgba(255,179,0,.12)', border: '1px solid rgba(255,179,0,.3)', borderRadius: 2, padding: '4px 10px', display: 'inline-block', marginBottom: 16 }}>
                ⚽ {getWatchfestCategory(flagshipWatchFest) === 'dodgers' ? 'Dodger Fest' : 'Goal City'} — Watch Fest
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 28, alignItems: 'center' }}>
                {flagshipWatchFest.flyer_image_url && (
                  <div style={{ borderRadius: 4, overflow: 'hidden', maxHeight: 360, position: 'relative' }}>
                    <img src={flagshipWatchFest.flyer_image_url} alt={flagshipWatchFest.match_name || 'Watch Fest'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,6,15,.85) 0%, transparent 60%)' }} />
                  </div>
                )}
                <div>
                  {flagshipWatchFest.team_flags && (
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{flagshipWatchFest.team_flags}</div>
                  )}
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(28px, 7vw, 64px)', color: 'var(--cream)', lineHeight: 1, marginBottom: 8 }}>
                    {flagshipWatchFest.match_name || flagshipWatchFest.event_name}
                  </h2>
                  {flagshipWatchFest.match_stage && (
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>
                      {flagshipWatchFest.match_stage}
                    </div>
                  )}
                  <KickoffStatus kickoffDatetime={flagshipWatchFest.kickoff_datetime} />
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20, fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)' }}>
                    {flagshipWatchFest.date && <span>📅 {formatDate(flagshipWatchFest.date)}{flagshipWatchFest.time ? ` · ${flagshipWatchFest.time}` : ''}</span>}
                    {flagshipWatchFest.venue && <span>📍 {flagshipWatchFest.venue}</span>}
                    {flagshipWatchFest.tailgate_time && <span>🎉 Tailgate {flagshipWatchFest.tailgate_time}</span>}
                  </div>
                  {flagshipWatchFest.ticket_link ? (
                    <a href={flagshipWatchFest.ticket_link} target="_blank" rel="noopener noreferrer" className="btn btn-gold">Get Tickets →</a>
                  ) : (
                    <Link to="/watchfest" className="btn btn-outline-blue">See Watch Fest →</Link>
                  )}
                </div>
              </div>
            </div>
          </section>
          <NeonDivider />
        </>
      )}

      {/* ── Featured Events ── */}
      <section className="section">
        <div className="container">
          <div className="section-tag">Featured Events</div>
          <h2 className="section-heading neon-blue">THIS WEEK</h2>
          {loading ? (
            <div className="events-grid">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
          ) : featured.length > 0 ? (
            <div className="events-grid">
              {featured.map((e, i) => <EventCard key={i} event={e} />)}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">🎉</div>
              <p>Events updating soon — follow @LatinDistrictLA for announcements</p>
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link to="/events" className="btn btn-outline-blue" onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}>View All Events →</Link>
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* ── About ── */}
      <section className="section">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 48, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="counter-number neon-blue" style={{ color: 'var(--blue)' }}>13</div>
              <div style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 8 }}>
                Venues · One District
              </div>
            </div>
            <div>
              <div className="section-tag">About</div>
              <h2 className="section-heading" style={{ marginBottom: 24 }}>ONE DISTRICT.<br />ALL NIGHT.</h2>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  '13 venues across DTLA all participating on Friday nights',
                  'Live DJs spinning Reggaeton, Salsa, Cumbia, Latin House & more',
                  'A community collective bringing Latin music to Downtown Los Angeles',
                  'Watch Fests: Major soccer & boxing matches on big screens',
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

      <NeonDivider />

      {/* ── Watch Fest Band ── */}
      <section className="band band-green">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="section-tag" style={{ color: 'var(--gold)' }}>Live Matches</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(48px, 12vw, 96px)', lineHeight: .95, color: 'var(--cream)', marginBottom: 16 }}>
            WATCH<br /><span className="neon-gold" style={{ color: 'var(--gold)' }}>FEST</span>
          </h2>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 16, color: 'var(--muted)', maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.5 }}>
            Big screens. DJs all night. Drink specials. Every major match,
            fight, and tournament — watched together.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {data.watchfest.slice(0, 3).map((m, i) => (
              <div key={i} style={{ background: 'rgba(255,179,0,.08)', border: '1px solid rgba(255,179,0,.2)', borderRadius: 4, padding: '12px 20px', textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--gold)' }}>{m.match_name}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{m.date} · {m.venue}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32 }}>
            <Link to="/watchfest" className="btn btn-gold">See Schedule →</Link>
          </div>
        </div>
      </section>

      <NeonDivider />

      {/* ── Bar Crawl Band ── */}
      <section className="band band-purple">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="section-tag" style={{ color: 'var(--purple)' }}>Friday Nights</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(48px, 12vw, 96px)', lineHeight: .95, color: 'var(--cream)', marginBottom: 16 }}>
            BAR<br /><span className="neon-purple" style={{ color: 'var(--purple)' }}>CRAWL</span>
          </h2>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 16, color: 'var(--muted)', maxWidth: 520, margin: '0 auto 24px', lineHeight: 1.5 }}>
            Two guided routes through DTLA's best Latin venues. Wristband perks,
            drink specials at every stop, and guides who get you home safe.
            Early Bird $20 · General $25 · Door $30.
          </p>
          {/* Route preview pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', marginBottom: 32 }}>
            {[
              { label: 'Route A', stops: 'Toda Madre → Florentín → The Association → Continental Club' },
              { label: 'Route B', stops: 'The Grayson → La Cita → Continental Club → West Eight' },
            ].map((r, i) => (
              <div key={i} style={{ background: 'rgba(213,0,249,.08)', border: '1px solid rgba(213,0,249,.2)', borderRadius: 4, padding: '8px 16px', fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--cream)', maxWidth: 480, textAlign: 'center' }}>
                <span style={{ color: 'var(--purple)', fontWeight: 700, marginRight: 8 }}>{r.label}</span>{r.stops}
              </div>
            ))}
          </div>
          <Link to="/bar-crawl" className="btn btn-purple">See Routes & Get Tickets →</Link>
        </div>
      </section>

      <NeonDivider />

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
  { value: 'all',          label: 'All Events' },
  { value: 'friday_night', label: 'Friday Night' },
  { value: 'watch_fest',   label: 'Watch Fest' },
  { value: 'special',      label: 'Special' },
  { value: 'other',        label: 'Other' },
  { value: 'calendar',     label: 'Calendar', to: '/calendar' },
]

const KNOWN_EVENT_TYPES = new Set(['friday_night', 'watch_fest', 'crawl', 'special'])

function EventsPage({ data, loading }) {
  const [filter, setFilter] = useState('all')

  const events = data.events.filter(e => {
    if (e.active === 'no') return false
    if (e.status && e.status.toLowerCase() !== 'approved') return false
    if (filter === 'all') return true
    if (filter === 'other') return !KNOWN_EVENT_TYPES.has(e.event_type)
    return e.event_type === filter
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
    .filter(v => v.active !== 'no')

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
  const events = data.events.filter(e => e.event_type === 'friday_night' && e.active !== 'no')

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
          <Link to="/bar-crawl" className="btn btn-outline-blue">Book Bar Crawl</Link>
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
          ) : events.length > 0 ? (
            <div className="events-grid">{events.map((e, i) => <EventCard key={i} event={e} />)}</div>
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

// ── WATCH FEST PAGE ─────────────────────────────────────────────────────────

function WatchFestPage({ data, loading }) {
  const [activeTab, setActiveTab] = useState('all')
  const allEvents = Array.isArray(data.watchfest) ? data.watchfest.filter(item => {
    if (item.active === 'no') return false
    if (item.status && item.status.toLowerCase() !== 'approved') return false
    return true
  }) : []
  const worldCupEvents = allEvents.filter(item => getWatchfestCategory(item) === 'worldcup')
  const dodgerEvents = allEvents.filter(item => getWatchfestCategory(item) === 'dodgers')
  const activeEvents = activeTab === 'all' ? allEvents : activeTab === 'worldcup' ? worldCupEvents : dodgerEvents
  const flagship = activeEvents.find(isFlagshipItem)

  const nextEvent = useMemo(() =>
    activeEvents
      .filter(e => {
        const d = new Date(e.kickoff_datetime || e.date)
        return !isNaN(d) && d > Date.now()
      })
      .sort((a, b) => new Date(a.kickoff_datetime || a.date) - new Date(b.kickoff_datetime || b.date))[0]
  , [activeEvents])
  const pageStatus = useKickoffStatus(nextEvent?.kickoff_datetime || nextEvent?.date)

  return (
    <div className="page-top">
      <section className="page-hero scanlines" style={{ background: 'linear-gradient(180deg, rgba(0,100,40,.08) 0%, #06060F 100%)' }}>
        <div className="page-hero__bg-text" style={{ color: 'rgba(255,179,0,.03)' }}>WATCH</div>
        <div className="page-hero__title">
          <div style={{ color: 'var(--cream)' }}>WATCH</div>
          <div className="neon-gold" style={{ color: 'var(--gold)' }}>FEST</div>
        </div>
        <p style={{ fontFamily: 'var(--font-label)', fontSize: 16, color: 'var(--muted)', maxWidth: 620, margin: '20px auto 20px', lineHeight: 1.5, position: 'relative', zIndex: 1 }}>
          Watch Fest is the umbrella for Latin District LA sports programming — with <strong style={{ color: 'var(--cream)' }}>Goal City</strong> for World Cup watch parties and <strong style={{ color: 'var(--cream)' }}>Dodger Fest</strong> for baseball nights across the district.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <button className={`btn ${activeTab === 'all' ? 'btn-gold' : 'btn-outline-blue'}`} onClick={() => setActiveTab('all')}>
            All
          </button>
          <button className={`btn ${activeTab === 'dodgers' ? 'btn-gold' : 'btn-outline-blue'}`} onClick={() => setActiveTab('dodgers')}>
            Dodger Games
          </button>
          <button className={`btn ${activeTab === 'worldcup' ? 'btn-gold' : 'btn-outline-blue'}`} onClick={() => setActiveTab('worldcup')}>
            Goal City
          </button>
        </div>
      </section>

      <NeonDivider />

      <section className="section">
        <div className="container">
          <LiveBadge />

          <div className="section-tag">{activeTab === 'worldcup' ? 'Goal City' : activeTab === 'all' ? 'Watch Fest' : 'Dodger Fest'}</div>
          <h2 className="section-heading mb-8" style={{ color: activeTab === 'worldcup' ? 'var(--gold)' : activeTab === 'all' ? 'var(--cream)' : 'var(--blue)' }}>
            {activeTab === 'worldcup' ? 'GOAL CITY WATCH PARTIES' : activeTab === 'all' ? 'ALL WATCH FEST EVENTS' : 'DODGER GAME NIGHTS'}
          </h2>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)', marginBottom: 28, maxWidth: 760 }}>
            {activeTab === 'worldcup'
              ? 'Goal City is the flagship World Cup identity inside Watch Fest. Use this tab for match flyers, kickoff times, venues, and ticket links. For the biggest games, the flagship outdoor event can live at The Shops on 4th & Main with vendors, drinks, activities, and live music.'
              : activeTab === 'all'
              ? 'All Watch Fest events across both Dodger Fest and Goal City. Baseball nights, World Cup watch parties, and more across the Latin District.'
              : 'Dodger Fest is the baseball lane inside Watch Fest. Use this tab for Dodgers watch-night flyers, featured game schedules, and supporting venue activations across the district.'}
          </p>

          {/* Next match status / countdown */}
          {!loading && nextEvent && pageStatus && (
            <div style={{ background: 'rgba(255,179,0,.06)', border: `1px solid ${pageStatus.state === 'live' ? 'rgba(0,200,83,.4)' : 'rgba(255,179,0,.25)'}`, borderRadius: 4, padding: '20px 24px', marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                {pageStatus.state === 'live' ? 'Match in Progress' : pageStatus.state === 'final' ? 'Last Match Result' : 'Next Match Countdown'}
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--cream)', marginBottom: 14 }}>
                {nextEvent.match_name || nextEvent.event_name}
                {nextEvent.team_flags && <span style={{ marginLeft: 10, fontSize: 22 }}>{nextEvent.team_flags}</span>}
              </div>
              {pageStatus.state === 'live' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 16, letterSpacing: '.1em', color: '#00C853' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00C853', display: 'inline-block' }} />
                  LIVE NOW
                </div>
              )}
              {pageStatus.state === 'final' && (
                <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 14, letterSpacing: '.1em', color: 'var(--muted)' }}>FINAL</div>
              )}
              {pageStatus.state === 'upcoming' && (
                <div className="countdown-grid" style={{ justifyContent: 'flex-start' }}>
                  {[
                    { num: String(pageStatus.days).padStart(2, '0'),    label: 'Days' },
                    { num: String(pageStatus.hours).padStart(2, '0'),   label: 'Hours' },
                    { num: String(pageStatus.minutes).padStart(2, '0'), label: 'Mins' },
                  ].map(({ num, label }) => (
                    <div key={label} className="countdown-box">
                      <div className="countdown-box__num">{num}</div>
                      <div className="countdown-box__label">{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Flagship outdoor venue info — World Cup only */}
          {activeTab === 'worldcup' && (
            <div style={{ background: 'linear-gradient(135deg, rgba(0,200,83,.04), rgba(255,179,0,.04))', border: '1px solid rgba(0,200,83,.18)', borderRadius: 4, padding: '20px 24px', marginBottom: 32 }}>
              <div style={{ fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 8 }}>
                Flagship Outdoor Watch Party Venue
              </div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(20px, 5vw, 32px)', color: 'var(--cream)', marginBottom: 8 }}>
                THE SHOPS AT 4TH & MAIN
              </h3>
              <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 640, marginBottom: 12 }}>
                Downtown Los Angeles. For the biggest matches, the flagship Goal City outdoor watch party takes over The Shops at 4th & Main — an open-air street plaza in the heart of DTLA. Expect outdoor big screens, vendor activations, drink specials, activities, and live music before and after kickoff.
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--muted)' }}>
                <span>📍 4th St &amp; Main St, Downtown Los Angeles</span>
                <span>🎤 Live music · Vendors · Big screens</span>
                <span>🍻 Drink activations · Activities</span>
              </div>
            </div>
          )}

          {!loading && flagship && (
            <div className="flagship-card mb-40">
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: activeTab === 'worldcup' ? 'var(--gold)' : 'var(--blue)', background: activeTab === 'worldcup' ? 'rgba(255,179,0,.15)' : 'rgba(0,229,255,.15)', border: activeTab === 'worldcup' ? '1px solid rgba(255,179,0,.3)' : '1px solid rgba(0,229,255,.3)', borderRadius: 2, padding: '4px 10px' }}>
                  ★ Featured {activeTab === 'worldcup' ? 'Goal City' : 'Dodger Fest'} Event
                </span>
              </div>
              {flagship.team_flags && (
                <div style={{ fontSize: 28, marginBottom: 6, letterSpacing: '0.05em' }}>{flagship.team_flags}</div>
              )}
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(28px, 6vw, 56px)', color: 'var(--cream)', lineHeight: 1, marginBottom: 8 }}>
                {flagship.match_name || flagship.event_name}
              </h3>
              {flagship.match_stage && (
                <div style={{ fontFamily: 'var(--font-label)', fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', color: activeTab === 'worldcup' ? 'var(--gold)' : 'var(--blue)', marginBottom: 12 }}>
                  {flagship.match_stage}
                </div>
              )}
              <KickoffStatus kickoffDatetime={flagship.kickoff_datetime} />
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12, fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)' }}>
                {flagship.date && <span>📅 {formatDate(flagship.date)}{flagship.time ? ` · ${flagship.time}` : ''}</span>}
                {flagship.venue && <span>📍 {flagship.venue}</span>}
                {flagship.tailgate_time && <span>🎉 Tailgate {flagship.tailgate_time}</span>}
              </div>
              {flagship.description && (
                <p style={{ fontFamily: 'var(--font-label)', fontSize: 14, color: 'var(--muted)', maxWidth: 760, lineHeight: 1.55, marginBottom: 16 }}>
                  {flagship.description}
                </p>
              )}
              {flagship.ticket_link ? (
                <a href={flagship.ticket_link} target="_blank" rel="noopener noreferrer" className="btn btn-gold">Get Tickets →</a>
              ) : (
                <button className="btn btn-outline-blue">Ticket Link Coming Soon</button>
              )}
            </div>
          )}

          {loading ? (
            <div className="events-grid">{[1,2,3,4].map(i => <SkeletonCard key={i} />)}</div>
          ) : activeEvents.length > 0 ? (
            <div className="events-grid">
              {activeEvents.map((item, i) => <WatchFestCard key={i} item={item} />)}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">{activeTab === 'worldcup' ? '⚽' : activeTab === 'all' ? '🏟️' : '⚾'}</div>
              <p>
                {activeTab === 'worldcup'
                  ? 'No World Cup events yet — add rows in the WatchFest tab with category set to worldcup.'
                  : activeTab === 'all'
                  ? 'No Watch Fest events yet — add rows in the WatchFest tab.'
                  : 'No Dodger games yet — add rows in the WatchFest tab with category set to dodgers.'}
              </p>
            </div>
          )}
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
              <button className="btn btn-outline-blue w-full">Get Early Bird</button>
            </div>

            <div className="pricing-card featured">
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--purple)', color: '#fff', fontFamily: 'var(--font-label)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 100, whiteSpace: 'nowrap' }}>Most Popular</div>
              <div className="pricing-card__tier text-purple neon-purple">General</div>
              <div className="pricing-card__price text-purple">$25</div>
              <div className="pricing-card__per">per person</div>
              <ul className="pricing-card__features">
                {['Everything in Early Bird','Priority check-in lane','Stamp reward eligibility','Access to finale at Continental Club','Optional West Eight afterparty access'].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <button className="btn btn-purple w-full">Get General Ticket</button>
            </div>

            <div className="pricing-card">
              <div className="pricing-card__tier text-gold neon-gold">Door</div>
              <div className="pricing-card__price text-gold">$30</div>
              <div className="pricing-card__per">night-of · subject to availability</div>
              <ul className="pricing-card__features">
                {['Everything in General','Pay at the door (cash or card)','Subject to capacity','No advance QR required','Wristband issued on arrival'].map((f, i) => <li key={i}>{f}</li>)}
              </ul>
              <button className="btn btn-gold w-full">Pay at Door</button>
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

// ── SUBMIT EVENT PAGE ───────────────────────────────────────────────────────

// ── Cloudinary upload helper ─────────────────────────────────────────────────
// Uploads a file directly to Cloudinary using an unsigned upload preset.
// Returns a stable hosted URL (secure_url).
//
// Required env vars (set in .env.local and Netlify site settings):
//   VITE_CLOUDINARY_CLOUD_NAME    — your Cloudinary cloud name
//   VITE_CLOUDINARY_UPLOAD_PRESET — an unsigned upload preset (Cloudinary dashboard)
//
// Future: call this same function for venue_image_url when that upload is added.
async function uploadToCloudinary(file) {
  const cloudName    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary is not configured')

  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', uploadPreset)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: fd }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Image upload failed')
  }
  const data = await res.json()
  return data.secure_url
}

function SubmitEventPage() {
  const [form, setForm] = useState({
    event_name:  '',
    venue:       '',
    date:        '',
    time:        '',
    genre:       '',
    event_type:  '',
    ticket_link: '',
    description: '',
  })
  const [flyerFile,    setFlyerFile]    = useState(null)
  const [flyerPreview, setFlyerPreview] = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [uploadError,  setUploadError]  = useState(null)
  const [formError,    setFormError]    = useState(null)
  const [submitted,    setSubmitted]    = useState(false)

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleFlyerChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFlyerFile(file)
    setFlyerPreview(URL.createObjectURL(file))
    setUploadError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    setUploadError(null)

    // ── Client-side validation ───────────────────────────────────────────────
    if (!flyerFile) {
      setUploadError('Please upload a flyer image before submitting.')
      return
    }
    if (form.ticket_link && !/^https?:\/\//.test(form.ticket_link)) {
      setFormError('Ticket link must start with http:// or https://')
      return
    }

    setSubmitting(true)
    try {
      // 1. Upload flyer → Cloudinary → stable public URL
      let flyer_image_url = ''
      try {
        flyer_image_url = await uploadToCloudinary(flyerFile)
      } catch {
        setUploadError('Image upload failed. Please try again.')
        setSubmitting(false)
        return
      }

      // 2. Build payload matching Events sheet schema exactly.
      //    All moderation defaults are enforced here and re-enforced server-side.
      //
      //    Moderation review workflow:
      //      pending  = submitted, not live (default for all new submissions)
      //      approved = admin-approved, visible on site when active = TRUE
      //      rejected = hidden
      //      active   = TRUE required to display (admin sets after approval)
      //
      //    TODO: add duplicate check (event_name + venue + date) before submitting
      //    TODO: validate venue against approved venue whitelist when available
      //    TODO: capture submitted_by_email / submitted_at for admin tracking
      const payload = {
        event_name:      form.event_name.trim(),
        venue:           form.venue.trim(),
        date:            form.date,
        time:            form.time,
        genre:           form.genre,
        event_type:      form.event_type,
        ticket_link:     form.ticket_link.trim(),
        flyer_image_url,
        // Moderation defaults — never overridable by submitter
        featured:        'FALSE',
        active:          'FALSE',
        tailgate_time:   '',
        status:          'pending',
        venue_image_url: '',  // Future: add venue image upload (same Cloudinary flow)
        video_url:       '',
        crowd_level:     '',
        description:     form.description.trim(),
      }

      // 3. POST to Netlify function → forwarded to Apps Script → written to sheet
      const res = await fetch('/.netlify/functions/submit-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const resBody = await res.json().catch(() => ({}))
      // Only surface definitive failures — not Apps Script response quirks.
      // A 5xx can occur after the row is already written (Apps Script returns
      // HTML or non-standard JSON); that is not a user-facing failure.
      // Show an error only for 4xx client errors or an explicit result:'error'.
      if (res.status >= 400 && res.status < 500) {
        throw new Error(resBody.error || 'Submission failed. Please try again.')
      }
      if (resBody.result === 'error') {
        throw new Error(resBody.error || resBody.message || 'Submission failed. Please try again.')
      }

      setSubmitted(true)
    } catch (err) {
      setFormError(err.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) return (
    <div className="page-top">
      <div className="success-screen">
        <div className="success-icon">✅</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 48, marginBottom: 12 }}>EVENT SUBMITTED!</h2>
        <p style={{ fontFamily: 'var(--font-label)', fontSize: 16, color: 'var(--muted)', maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.6 }}>
          Your event is now in review. Once approved it will appear on the calendar and events pages.
          Our team typically reviews within 48 hours.
        </p>
        <Link to="/events" className="btn btn-blue" onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}>View All Events →</Link>
      </div>
    </div>
  )

  return (
    <div className="page-top">
      <section className="section">
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 48 }}>

            {/* Info aside */}
            <div>
              <div className="section-tag">For Promoters &amp; Organizers</div>
              <h1 className="section-heading neon-blue mb-16">SUBMIT YOUR EVENT</h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
                Get your Latin music event in front of thousands of DTLA nightlife attendees.
                All genres welcome — not just Friday Night Latin District.
                Submit below and our team will review within 48 hours.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { icon: '📣', title: 'Reach The District', desc: 'Your event seen by our full Friday night audience.' },
                  { icon: '🎟️', title: 'Drive Ticket Sales', desc: 'Direct ticket link on every event card.' },
                  { icon: '📱', title: 'Social Amplification', desc: 'Featured events shared to our Instagram & TikTok.' },
                  { icon: '📅', title: 'Calendar Listing', desc: 'Your event appears on our public events calendar.' },
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{b.icon}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{b.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{b.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>

              {/* Event Name */}
              <div className="form-group">
                <label className="form-label">Event Name *</label>
                <input
                  required
                  className="form-input"
                  value={form.event_name}
                  onChange={set('event_name')}
                  placeholder="e.g. Reggaeton Fridays"
                />
              </div>

              {/* Venue Name */}
              <div className="form-group">
                <label className="form-label">Venue Name *</label>
                <input
                  required
                  className="form-input"
                  value={form.venue}
                  onChange={set('venue')}
                  placeholder="e.g. Rhythm Room LA"
                />
              </div>

              {/* Date + Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <div className="form-group">
                  <label className="form-label">Event Date *</label>
                  <input required type="date" className="form-input" value={form.date} onChange={set('date')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Start Time *</label>
                  <input required type="time" className="form-input" value={form.time} onChange={set('time')} />
                </div>
              </div>

              {/* Genre + Event Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
                <div className="form-group">
                  <label className="form-label">Genre <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <select className="form-select" value={form.genre} onChange={set('genre')}>
                    <option value="">Select genre…</option>
                    {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Event Type *</label>
                  <select required className="form-select" value={form.event_type} onChange={set('event_type')}>
                    <option value="">Select type…</option>
                    {EVENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Ticket Link (optional) */}
              <div className="form-group">
                <label className="form-label">
                  Ticket Link <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <input
                  type="url"
                  className="form-input"
                  value={form.ticket_link}
                  onChange={set('ticket_link')}
                  placeholder="https://..."
                />
              </div>

              {/* Flyer Upload → Cloudinary */}
              <div className="form-group">
                <label className="form-label">Event Flyer *</label>
                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  border: `2px dashed ${flyerFile ? 'var(--blue)' : 'rgba(255,255,255,.18)'}`,
                  borderRadius: 4,
                  padding: '28px 20px',
                  cursor: 'pointer',
                  background: flyerFile ? 'rgba(0,229,255,.04)' : 'rgba(255,255,255,.02)',
                  transition: 'border-color .2s, background .2s',
                  position: 'relative',
                }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                    onChange={handleFlyerChange}
                  />
                  {flyerPreview ? (
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src={flyerPreview}
                        alt="Flyer preview"
                        style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain', borderRadius: 3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }}
                      />
                      <div style={{ fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--blue)' }}>
                        {flyerFile.name} · Click to change
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 36 }}>🖼️</div>
                      <div style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                        Click to upload flyer<br />
                        <span style={{ fontSize: 11, opacity: .7 }}>JPG, PNG, WEBP · max 10 MB</span>
                      </div>
                    </>
                  )}
                </label>
                {uploadError && (
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--red)', marginTop: 8, padding: '10px 14px', background: 'rgba(255,23,68,.08)', border: '1px solid rgba(255,23,68,.2)', borderRadius: 3 }}>
                    {uploadError}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Event Description *</label>
                <textarea
                  required
                  className="form-textarea"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Tell us about your event — vibe, lineup, what to expect…"
                  rows={4}
                />
              </div>

              {formError && (
                <div style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--red)', marginBottom: 12, padding: '12px 16px', background: 'rgba(255,23,68,.08)', border: '1px solid rgba(255,23,68,.2)', borderRadius: 3 }}>
                  {formError}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-blue w-full"
                disabled={submitting}
                style={{ marginTop: 8, opacity: submitting ? .6 : 1 }}
              >
                {submitting ? 'Submitting…' : 'Submit Event →'}
              </button>

              <p style={{ fontFamily: 'var(--font-label)', fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
                Events are reviewed before going live. Your submission will appear as pending until approved by our team.
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── CONTACT PAGE ────────────────────────────────────────────────────────────

function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', type: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encode({ 'form-name': 'contact', ...form }),
    })
      .catch(err => console.error('Form error:', err))
      .finally(() => setSubmitted(true))
  }

  if (submitted) return (
    <div className="page-top">
      <div className="success-screen">
        <div className="success-icon">📬</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 48, marginBottom: 12 }}>MESSAGE SENT!</h2>
        <p style={{ fontFamily: 'var(--font-label)', fontSize: 16, color: 'var(--muted)', maxWidth: 400, margin: '0 auto 32px' }}>
          We'll get back to {form.email} within 24–48 hours. Follow us for updates.
        </p>
        <Link to="/" className="btn btn-blue">Back to Home</Link>
      </div>
    </div>
  )

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
              <button type="submit" className="btn btn-blue w-full">Send Message →</button>
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
  const [modal, setModal]       = useState(null)

  // Only show approved + active items on the calendar and list
  // Old rows without a status field continue to show for backwards compatibility.
  const approvedEvents = useMemo(() => data.events.filter(e => {
    if (e.active === 'no' || e.active === 'FALSE') return false
    if (e.status && e.status.toLowerCase() !== 'approved') return false
    return true
  }), [data.events])

  const approvedWatchfest = useMemo(() => (data.watchfest || []).filter(w => {
    if (w.active === 'no' || w.active === 'FALSE') return false
    if (w.status && w.status.toLowerCase() !== 'approved') return false
    return true
  }), [data.watchfest])

  const eventsByDate = useMemo(() => {
    const map = {}
    const add = (item, type) => {
      const d = parseEventDate(item.date)
      if (!d) return
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push({ ...item, _type: type })
    }
    approvedEvents.forEach(e => add(e, 'event'))
    approvedWatchfest.forEach(w => add(w, 'watchfest'))
    return map
  }, [approvedEvents, approvedWatchfest])

  // Upcoming events list — all approved items from today onward, sorted by date
  const upcomingList = useMemo(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const all = [
      ...approvedEvents.map(e => ({ ...e, _type: 'event' })),
      ...approvedWatchfest.map(w => ({ ...w, _type: 'watchfest' })),
    ]
    return all
      .filter(item => {
        const d = parseEventDate(item.date)
        return d && d.getTime() >= todayMs
      })
      .sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date))
  }, [approvedEvents, approvedWatchfest])

  const firstDayOfMonth = new Date(curYear, curMonth, 1).getDay()
  const daysInMonth     = new Date(curYear, curMonth + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDayOfMonth; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const goToPrev = () => {
    if (curMonth === 0) { setCurYear(y => y - 1); setCurMonth(11) }
    else setCurMonth(m => m - 1)
  }
  const goToNext = () => {
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
                      className={`cal-cell${dayEvents.length ? ' cal-cell--has-events' : ''}${isToday(day) ? ' cal-cell--today' : ''}`}
                      onClick={() => dayEvents.length && setModal({ day, month: curMonth, year: curYear, events: dayEvents })}
                      role={dayEvents.length ? 'button' : undefined}
                      tabIndex={dayEvents.length ? 0 : undefined}
                      onKeyDown={dayEvents.length ? (e) => e.key === 'Enter' && setModal({ day, month: curMonth, year: curYear, events: dayEvents }) : undefined}
                    >
                      <div className="cal-cell__num">{day}</div>
                      {dayEvents.slice(0, 2).map((ev, j) => {
                        const isWf = ev._type === 'watchfest'
                        const name = ev.match_name || ev.event_name || ''
                        return (
                          <div key={j} className="cal-event-dot" style={{ borderLeft: `2px solid ${isWf ? 'var(--gold)' : 'var(--red)'}` }}>
                            <span>{isWf ? '⚽' : '🎉'}</span>
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

          {/* Legend */}
          <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap', fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--muted)' }}>
            {[
              { color: 'var(--red)',  label: 'Events' },
              { color: 'var(--gold)', label: 'Watch Fest' },
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
                  const isWf   = item._type === 'watchfest'
                  const name   = item.match_name || item.event_name || 'Event'
                  const badge  = isWf
                    ? { bg: 'rgba(255,179,0,.18)', color: 'var(--gold)', label: 'Watch Fest' }
                    : (BADGE_COLORS[item.event_type] || BADGE_COLORS.special)
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
                          : (isWf ? '⚽' : '🎉')}
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

      {/* Event detail modal */}
      {modal && (
        <div
          className="cal-modal-overlay"
          onClick={() => setModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Event details"
        >
          <div className="cal-modal" onClick={e => e.stopPropagation()}>
            <div className="cal-modal__header">
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, color: 'var(--cream)' }}>
                {MONTH_NAMES[modal.month]} {modal.day}, {modal.year}
              </h3>
              <button
                onClick={() => setModal(null)}
                aria-label="Close"
                style={{ fontSize: 22, color: 'var(--muted)', padding: 8, minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            </div>
            <div className="cal-modal__body">
              {modal.events.map((ev, i) => {
                const isWf  = ev._type === 'watchfest'
                const name  = ev.match_name || ev.event_name || 'Event'
                const imgUrl = convertDriveUrl(ev.flyer_image_url)
                const badge = isWf
                  ? { bg: 'rgba(255,179,0,.2)', color: 'var(--gold)', label: 'Watch Fest' }
                  : (BADGE_COLORS[ev.event_type] || BADGE_COLORS.special)
                return (
                  <div key={i} className="cal-modal__event">
                    {imgUrl && (
                      <div style={{ width: '100%', paddingTop: '50%', position: 'relative', borderRadius: 3, overflow: 'hidden', marginBottom: 12, background: '#0a0a1a' }}>
                        <img src={imgUrl} alt={name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      </div>
                    )}
                    <span className="event-card__badge" style={{ background: badge.bg, color: badge.color, marginBottom: 8, display: 'inline-block' }}>{badge.label}</span>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, color: 'var(--cream)', marginBottom: 8 }}>{name}</div>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: 13, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                      {ev.venue && <span>📍 {ev.venue}</span>}
                      {ev.time  && <span>🕙 {ev.time}</span>}
                      {ev.description && <span style={{ color: 'var(--cream)', marginTop: 4, lineHeight: 1.5 }}>{ev.description}</span>}
                    </div>
                    {ev.ticket_link ? (
                      <a href={ev.ticket_link} target="_blank" rel="noopener noreferrer" className="btn btn-red w-full" style={{ fontSize: 13, padding: '10px 16px' }}>
                        Get Tickets →
                      </a>
                    ) : null}
                    {i < modal.events.length - 1 && (
                      <hr style={{ margin: '20px 0', borderColor: 'rgba(255,255,255,.08)', borderStyle: 'solid' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── App Root ────────────────────────────────────────────────────────────────

function ScrollToTop() {
  useEffect(() => {
    // 'instant' bypasses CSS scroll-behavior:smooth so the page never
    // briefly shows a scrolled position before animating up.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])
  return null
}

export default function App() {
  const { data, loading } = useSheets()

  // Disable browser scroll restoration so it doesn't fight ScrollToTop.
  // We manage scroll position explicitly on every route change.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<><ScrollToTop /><HomePage data={data} loading={loading} /></>} />
        <Route path="/events" element={<><ScrollToTop /><EventsPage data={data} loading={loading} /></>} />
        <Route path="/calendar" element={<><ScrollToTop /><CalendarPage data={data} loading={loading} /></>} />
        <Route path="/venues" element={<><ScrollToTop /><VenuesPage data={data} loading={loading} /></>} />
        <Route path="/friday-night" element={<><ScrollToTop /><FridayNightPage data={data} loading={loading} /></>} />
        <Route path="/watchfest" element={<><ScrollToTop /><WatchFestPage data={data} loading={loading} /></>} />
        <Route path="/bar-crawl" element={<><ScrollToTop /><BarCrawlPage data={data} loading={loading} /></>} />
        <Route path="/submit-event" element={<><ScrollToTop /><SubmitEventPage /></>} />
        <Route path="/resources" element={<><ScrollToTop /><Resources /></>} />
        <Route path="/contact" element={<><ScrollToTop /><ContactPage /></>} />
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
