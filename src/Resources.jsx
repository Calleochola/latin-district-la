import { useState } from 'react'
import { Link } from 'react-router-dom'
import ResourceCard from './ResourceCard'

// ── Event Submission Form ────────────────────────────────────────────────────
// Replace with your actual Google Form URL when ready.
// While this is still the placeholder string, the CTA button renders as disabled.
const EVENT_SUBMISSION_FORM_URL = "PASTE_GOOGLE_FORM_LINK_HERE"

// ── Google Form → Sheet Pipeline (schema reference) ─────────────────────────
//
// RECOMMENDED GOOGLE FORM FIELDS
// Use these as question labels when building your Google Form.
// Google Sheets will auto-create matching column headers from them.
//
//   submitted_by_email     — venue contact email (required)
//   venue_verified         — checkbox: "I confirm I represent this venue"
//   venue                  — venue name (required)
//   address                — venue street address
//   event_name             — name of the event (required)
//   date                   — event date (required)
//   time                   — start time (required)
//   end_time               — end time
//   category               — dropdown: friday_night | watch_fest | crawl | special
//   description            — short event description (2–3 sentences)
//   ticket_link            — Eventbrite / RA / direct link (optional)
//   video_url              — YouTube or TikTok promo link (optional)
//   flyer_upload           — Google Drive upload (intake only — copy stable URL to flyer_image_url)
//   venue_image_upload     — Google Drive upload (intake only — copy stable URL to venue_image_url)
//   instagram_post_url     — optional IG post to link / embed
//
// NOTE: Google Form file uploads create Drive links that expire or require auth.
// After review, copy the stable public image URL into flyer_image_url / venue_image_url.
// If images are missing, cards will render without an image rather than breaking layout.
//
// STATUS WORKFLOW
//   pending  → default when submitted; not shown on site
//   approved → shown on site
//   rejected → hidden from site
//
// The site filter checks: if row.status exists, only show when status === 'approved' (case-insensitive).
// Rows without a status field are shown by default (backwards compatible with existing data).
//
// FUTURE EVENTS SHEET COLUMNS (target schema)
//   id | status | event_name | date | time | end_time | venue | address | category |
//   description | ticket_link | video_url | flyer_image_url | venue_image_url |
//   submitted_by_email | submitted_at | notes_internal
//
// ────────────────────────────────────────────────────────────────────────────

// ── Accordion ────────────────────────────────────────────────────────────────

function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="resources-accordion">
      <button
        className="resources-accordion__btn"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="resources-accordion__icon" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="resources-accordion__body">{children}</div>}
    </div>
  )
}

// ── BID Data ─────────────────────────────────────────────────────────────────
// Order: DTLA Alliance → Historic Core → The Social District → Fashion District

const BID_DATA = [
  {
    name: 'DTLA Alliance',
    area: 'Downtown Center',
    description: '24/7 Safe & Clean operations covering the downtown core. Safety patrols, ambassador services, and escort support available through the app.',
    phone: '(213) 488-9877',
    tel: '2134889877',
    website: 'https://www.downtownla.com',
    badge: 'Escort available',
    note: 'Safety escorts available via the Safe & Clean app — download before heading out.',
  },
  {
    name: 'Historic Core BID',
    area: 'Historic Core',
    description: '24/7 safety hotline for the Historic Core neighborhood. Field operations and ambassador support.',
    phone: '(213) 626-2906',
    tel: '2136262906',
    website: 'https://www.historiccorebid.org',
    note: 'Verify current services and escort availability directly with the Historic Core BID.',
  },
  {
    name: 'The Social District',
    area: 'South Park',
    description: 'Free safety escort walks for South Park and the surrounding district — including escort-to-car support for late nights.',
    phone: '(213) 417-1969',
    tel: '2134171969',
    email: 'safety@socialdistrictla.com',
    website: 'https://socialdistrictla.com',
    badge: 'Escort available',
    note: 'Call dispatch or email for escort-to-car and walk escort services.',
  },
  {
    name: 'Fashion District BID',
    area: 'Fashion District',
    description: 'Clean & Safe field operations with a 24-hour response line for the Fashion District.',
    phone: '(213) 488-1499',
    tel: '2134881499',
    website: 'https://fashiondistrict.org',
    note: 'See the Emergency Contact Card on their site for a printable reference.',
  },
]

// ── Hotlines ─────────────────────────────────────────────────────────────────

const HOTLINES = [
  { label: 'Emergency', number: '911', displayOnly: true },
  { label: 'LAPD Non-Emergency', number: '(877) 275-5273', tel: '8772755273' },
  { label: '988 Suicide & Crisis Lifeline', number: '988', tel: '988' },
  { label: '211 LA — Social Services', number: '211', tel: '211' },
  { label: 'LA County DMH ACCESS', number: '(800) 854-7771', tel: '8008547771' },
  { label: 'LAHSA Housing & Services Info', number: '(213) 225-8400', tel: '2132258400' },
]

// ── Immigrant & Legal Support ─────────────────────────────────────────────────

const IMMIGRANT_RESOURCES = [
  {
    name: 'CHIRLA',
    description: 'Know your rights. Hotline and legal referrals from the Coalition for Humane Immigrant Rights.',
    phone: '(888) 624-4725',
    tel: '8886244725',
    website: 'https://chirla.org',
  },
  {
    name: 'CARECEN',
    description: 'Get verified legal help. Immigration legal services and community advocacy for Central American and all immigrant communities.',
    phone: '(213) 385-7800',
    tel: '2133857800',
    website: 'https://carecen-la.org',
  },
  {
    name: 'LA County Office of Immigrant Affairs',
    description: 'Find trusted support. County programs, referrals, and resources for immigrant residents and families.',
    website: 'https://lacounty.gov/resident/immigrant-services/',
  },
  {
    name: 'ImmDef — Rapid Response',
    description: 'Urgent help when you need it. Immigration Defenders rapid response for time-sensitive situations.',
    phone: '(213) 634-0986',
    tel: '2136340986',
    website: 'https://immdef.org',
  },
  {
    name: 'LAFLA',
    description: 'Free civil legal services for low-income Angelenos — including immigration intake and referrals.',
    phone: '(800) 399-4529',
    tel: '8003994529',
    website: 'https://lafla.org',
  },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Resources() {
  const formAvailable = EVENT_SUBMISSION_FORM_URL !== "PASTE_GOOGLE_FORM_LINK_HERE"

  return (
    <div className="page-top">
      <section className="section">
        <div className="container">

          <div className="section-tag">District Info</div>
          <h1 className="section-heading neon-blue mb-32">RESOURCES</h1>

          {/* ── A: Quick Actions ── */}
          <div className="resources-section">
            <h2 className="resources-section__title">Quick Actions</h2>
            <div className="resources-quick-grid">
              <a href="https://www.metro.net/riding/trip-planner/" target="_blank" rel="noopener noreferrer" className="quick-action-card">
                <span className="quick-action-icon" aria-hidden="true">🗺️</span>
                <span className="quick-action-label">Metro Trip Planner</span>
              </a>
              <a href="https://www.metro.net/riding/nextrip/" target="_blank" rel="noopener noreferrer" className="quick-action-card">
                <span className="quick-action-icon" aria-hidden="true">🚌</span>
                <span className="quick-action-label">Metro Arrivals</span>
              </a>
              <a href="https://emergency.lacity.gov/notifyla" target="_blank" rel="noopener noreferrer" className="quick-action-card">
                <span className="quick-action-icon" aria-hidden="true">⚠️</span>
                <span className="quick-action-label">Service Alerts / NotifyLA</span>
              </a>
              <a href="https://myla311.lacity.gov/s/" target="_blank" rel="noopener noreferrer" className="quick-action-card">
                <span className="quick-action-icon" aria-hidden="true">📋</span>
                <span className="quick-action-label">MyLA311</span>
              </a>
            </div>
          </div>

          {/* ── B: Transit & Maps ── */}
          <Accordion title="Transit & Maps" defaultOpen>
            <p className="resources-note">
              Always check Metro for live schedules, arrivals, and service alerts before heading out.
              Don't rely on printed schedules — use the official Metro pages below.
            </p>
            <div className="resources-btn-group">
              <a href="https://www.metro.net/riding/maps/" target="_blank" rel="noopener noreferrer" className="btn btn-outline-blue" style={{ fontSize: 13, padding: '8px 18px', minHeight: 40 }}>
                System Maps
              </a>
              <a href="https://media.metro.net/images/maps/rail-map.pdf" target="_blank" rel="noopener noreferrer" className="btn btn-outline-blue" style={{ fontSize: 13, padding: '8px 18px', minHeight: 40 }}>
                Go Metro Rail/Busway PDF
              </a>
              <a href="https://media.metro.net/images/maps/system-map.pdf" target="_blank" rel="noopener noreferrer" className="btn btn-outline-blue" style={{ fontSize: 13, padding: '8px 18px', minHeight: 40 }}>
                Full System Map PDF
              </a>
              <a href="https://media.metro.net/images/maps/owl-map.pdf" target="_blank" rel="noopener noreferrer" className="btn btn-outline-blue" style={{ fontSize: 13, padding: '8px 18px', minHeight: 40 }}>
                Night Owl (OWL) PDF
              </a>
              <a href="https://www.metro.net/riding/rider-guide/" target="_blank" rel="noopener noreferrer" className="btn btn-outline-blue" style={{ fontSize: 13, padding: '8px 18px', minHeight: 40 }}>
                Metro Rider Guide
              </a>
              <a href="https://www.metro.net/riding/accessible-services/" target="_blank" rel="noopener noreferrer" className="btn btn-outline-blue" style={{ fontSize: 13, padding: '8px 18px', minHeight: 40 }}>
                Accessibility Services
              </a>
            </div>
          </Accordion>

          {/* ── C: BIDs & Safety Escorts ── */}
          <div className="resources-section">
            <h2 className="resources-section__title">BIDs & Safety Escorts</h2>
            <p className="resources-note">
              Business Improvement Districts run safety patrols and escort services across DTLA.
              Availability varies by district — always call ahead to confirm.
            </p>
            <div className="resource-card-grid">
              {BID_DATA.map(bid => (
                <ResourceCard key={bid.name} {...bid} />
              ))}
            </div>
          </div>

          {/* ── D: Community Support ── */}
          <div className="resources-section">
            <h2 className="resources-section__title">Community Support</h2>
            <p className="resources-disclaimer">If you are in immediate danger, call 911.</p>
            <ul className="hotline-list">
              {HOTLINES.map(h => (
                <li key={h.label} className="hotline-item">
                  <span className="hotline-label">{h.label}</span>
                  {h.displayOnly ? (
                    <span className="hotline-number">{h.number}</span>
                  ) : (
                    <a href={`tel:${h.tel}`} className="hotline-number hotline-number--link">{h.number}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* ── E: Immigrant & Legal Support ── */}
          <div className="resources-section">
            <h2 className="resources-section__title">Immigrant & Legal Support</h2>
            <p className="resources-note">
              Community resources for immigrants and families in LA. Know your rights.
              Get verified legal help. These organizations are trusted, confidential, and here for you.
            </p>
            <div className="resource-card-grid">
              {IMMIGRANT_RESOURCES.map(org => (
                <ResourceCard
                  key={org.name}
                  name={org.name}
                  description={org.description}
                  phone={org.phone}
                  tel={org.tel}
                  website={org.website}
                />
              ))}
            </div>
          </div>

          {/* ── F: Parking & Accessibility ── */}
          <div className="resources-section">
            <h2 className="resources-section__title">Parking & Accessibility</h2>
            <div className="resource-card-grid resource-card-grid--2col">
              <div className="resource-card">
                <h4 className="resource-card__title">Parking in LA</h4>
                <p className="resource-card__desc">Find parking garages, rates, and pay-by-phone options across DTLA.</p>
                <div className="resource-card__actions">
                  <a href="https://ladot.lacity.gov/parking" target="_blank" rel="noopener noreferrer" className="btn btn-outline-blue" style={{ fontSize: 13, padding: '8px 16px', minHeight: 36 }}>
                    LADOT Parking
                  </a>
                  <a href="https://laexpresspark.com" target="_blank" rel="noopener noreferrer" className="btn btn-outline-blue" style={{ fontSize: 13, padding: '8px 16px', minHeight: 36 }}>
                    LA Express Park
                  </a>
                </div>
              </div>
              <div className="resource-card">
                <h4 className="resource-card__title">Metro Accessibility</h4>
                <p className="resource-card__desc">ADA services, paratransit info, and accessible trip planning with Metro.</p>
                <div className="resource-card__actions">
                  <a href="https://www.metro.net/riding/accessible-services/" target="_blank" rel="noopener noreferrer" className="btn btn-outline-blue" style={{ fontSize: 13, padding: '8px 16px', minHeight: 36 }}>
                    Accessibility Info
                  </a>
                </div>
              </div>
            </div>
            <ul className="resources-tips">
              <li>Use well-lit lots and garages when possible.</li>
              <li>Request a BID safety escort when available — it's free.</li>
              <li>Plan your transit and parking before heading out.</li>
              <li>Save important numbers in your phone before the night starts.</li>
            </ul>
          </div>

          {/* ── G: Venue CTA ── */}
          <div className="resources-cta">
            <h3 className="resources-cta__title">Venue owner?</h3>
            <p className="resources-cta__sub">
              Submit your event and get in front of the Latin District audience every week.
            </p>
            {formAvailable ? (
              <a href={EVENT_SUBMISSION_FORM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-blue">
                Submit Your Event →
              </a>
            ) : (
              <button className="btn btn-blue" disabled style={{ opacity: 0.45, cursor: 'not-allowed' }}>
                Coming Soon
              </button>
            )}
            <p style={{ marginTop: 12, fontFamily: 'var(--font-label)', fontSize: 12, color: 'var(--muted)' }}>
              You can also use the <Link to="/submit-event" style={{ color: 'var(--blue)' }}>Submit Event</Link> form on this site.
            </p>
          </div>

        </div>
      </section>
    </div>
  )
}
