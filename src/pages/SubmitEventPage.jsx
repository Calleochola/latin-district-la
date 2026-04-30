import { useState, useRef } from 'react'

const GENRES = ['Salsa', 'Bachata', 'Cumbia', 'Reggaeton', 'Merengue', 'Latin Pop', 'Banda', 'Norteño', 'Mixed Latin', 'Other']
const EVENT_TYPES = ['Club Night', 'Concert', 'Festival', 'Day Party', 'Brunch', 'Rooftop', 'Underground', 'Other']

const MAX_FILE_SIZE_MB = 8

export default function SubmitEventPage() {
  const [form, setForm] = useState({
    eventName: '', venue: '', date: '', time: '',
    genre: '', eventType: '', ticketLink: '', description: '',
  })
  const [flyerFile, setFlyerFile]   = useState(null)
  const [flyerPreview, setFlyerPreview] = useState(null)
  const [status, setStatus]         = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg]     = useState('')
  const fileInputRef = useRef(null)

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMsg(`Flyer must be under ${MAX_FILE_SIZE_MB}MB`)
      return
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setErrorMsg('Flyer must be a JPG, PNG, or WEBP image')
      return
    }

    setErrorMsg('')
    setFlyerFile(file)
    setFlyerPreview(URL.createObjectURL(file))
  }

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result) // full data URI
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!form.eventName || !form.venue || !form.date || !form.time || !form.genre || !form.eventType) {
      setErrorMsg('Please fill in all required fields.')
      return
    }

    setStatus('submitting')

    try {
      let flyerBase64   = null
      let flyerFileName = null

      if (flyerFile) {
        flyerBase64   = await toBase64(flyerFile)
        flyerFileName = flyerFile.name
      }

      const res = await fetch('/.netlify/functions/submit-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          flyerBase64,
          flyerFileName,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Submission failed')
      }

      setStatus('success')

    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div style={styles.page}>
        <div style={styles.successBox}>
          <div style={styles.successIcon}>🎉</div>
          <h2 style={styles.successTitle}>Event Submitted!</h2>
          <p style={styles.successText}>
            We'll review your event and publish it shortly.<br />
            You'll see it live on the site once approved.
          </p>
          <button
            style={styles.submitBtn}
            onClick={() => {
              setStatus('idle')
              setForm({ eventName: '', venue: '', date: '', time: '', genre: '', eventType: '', ticketLink: '', description: '' })
              setFlyerFile(null)
              setFlyerPreview(null)
            }}
          >
            Submit Another Event
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        <div style={styles.header}>
          <h1 style={styles.title}>Submit Your Event</h1>
          <p style={styles.subtitle}>Get your Latin event in front of LA's community</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>

          {/* Event Name */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Event Name <span style={styles.required}>*</span></label>
            <input
              style={styles.input}
              name="eventName"
              value={form.eventName}
              onChange={handleChange}
              placeholder="e.g. Salsa Night at El Rey"
              required
            />
          </div>

          {/* Venue */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Venue <span style={styles.required}>*</span></label>
            <input
              style={styles.input}
              name="venue"
              value={form.venue}
              onChange={handleChange}
              placeholder="Venue name"
              required
            />
          </div>

          {/* Date + Time */}
          <div style={styles.row}>
            <div style={{ ...styles.fieldGroup, flex: 1 }}>
              <label style={styles.label}>Date <span style={styles.required}>*</span></label>
              <input
                style={styles.input}
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
              />
            </div>
            <div style={{ ...styles.fieldGroup, flex: 1 }}>
              <label style={styles.label}>Start Time <span style={styles.required}>*</span></label>
              <input
                style={styles.input}
                type="time"
                name="time"
                value={form.time}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Genre + Event Type */}
          <div style={styles.row}>
            <div style={{ ...styles.fieldGroup, flex: 1 }}>
              <label style={styles.label}>Genre <span style={styles.required}>*</span></label>
              <select style={styles.input} name="genre" value={form.genre} onChange={handleChange} required>
                <option value="">Select genre</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div style={{ ...styles.fieldGroup, flex: 1 }}>
              <label style={styles.label}>Event Type <span style={styles.required}>*</span></label>
              <select style={styles.input} name="eventType" value={form.eventType} onChange={handleChange} required>
                <option value="">Select type</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Ticket Link */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Ticket Link</label>
            <input
              style={styles.input}
              name="ticketLink"
              value={form.ticketLink}
              onChange={handleChange}
              placeholder="https://ra.co/events/... (optional)"
              type="url"
            />
          </div>

          {/* Description */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              style={{ ...styles.input, ...styles.textarea }}
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Tell people what to expect — DJs, dress code, vibe..."
              rows={4}
            />
          </div>

          {/* Flyer Upload */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Event Flyer</label>
            <div
              style={styles.dropZone}
              onClick={() => fileInputRef.current?.click()}
            >
              {flyerPreview ? (
                <img src={flyerPreview} alt="Flyer preview" style={styles.flyerPreview} />
              ) : (
                <div style={styles.dropZoneInner}>
                  <div style={styles.uploadIcon}>📸</div>
                  <p style={styles.dropZoneText}>Click to upload flyer</p>
                  <p style={styles.dropZoneHint}>JPG, PNG or WEBP · Max {MAX_FILE_SIZE_MB}MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {flyerFile && (
              <button
                type="button"
                style={styles.removeBtn}
                onClick={() => { setFlyerFile(null); setFlyerPreview(null) }}
              >
                Remove flyer
              </button>
            )}
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={styles.errorBox}>{errorMsg}</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            style={{
              ...styles.submitBtn,
              opacity: status === 'submitting' ? 0.7 : 1,
              cursor:  status === 'submitting' ? 'not-allowed' : 'pointer',
            }}
            disabled={status === 'submitting'}
          >
            {status === 'submitting' ? 'Submitting...' : 'Submit Event'}
          </button>

        </form>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '48px 16px 80px',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
  },
  container: {
    width: '100%',
    maxWidth: '620px',
  },
  header: {
    marginBottom: '40px',
    textAlign: 'center',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    color: '#888',
    marginTop: '8px',
    fontSize: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  row: {
    display: 'flex',
    gap: '16px',
  },
  label: {
    color: '#ccc',
    fontSize: '0.85rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    color: '#fff',
    padding: '12px 14px',
    fontSize: '0.95rem',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
    appearance: 'none',
  },
  textarea: {
    resize: 'vertical',
    minHeight: '100px',
  },
  dropZone: {
    border: '2px dashed #2a2a2a',
    borderRadius: '10px',
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'border-color 0.2s',
    minHeight: '140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZoneInner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '24px',
  },
  uploadIcon: {
    fontSize: '2rem',
  },
  dropZoneText: {
    color: '#888',
    margin: 0,
    fontSize: '0.95rem',
  },
  dropZoneHint: {
    color: '#555',
    margin: 0,
    fontSize: '0.8rem',
  },
  flyerPreview: {
    width: '100%',
    maxHeight: '300px',
    objectFit: 'contain',
    display: 'block',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '0.8rem',
    cursor: 'pointer',
    padding: '4px 0',
    textDecoration: 'underline',
    alignSelf: 'flex-start',
  },
  errorBox: {
    background: '#2a0f0f',
    border: '1px solid #5a1a1a',
    borderRadius: '8px',
    color: '#ff6b6b',
    padding: '12px 16px',
    fontSize: '0.9rem',
  },
  submitBtn: {
    background: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    letterSpacing: '0.5px',
    marginTop: '8px',
  },
  successBox: {
    textAlign: 'center',
    padding: '60px 24px',
    maxWidth: '480px',
    margin: '0 auto',
  },
  successIcon: {
    fontSize: '3.5rem',
    marginBottom: '16px',
  },
  successTitle: {
    color: '#fff',
    fontSize: '2rem',
    fontWeight: 800,
    margin: '0 0 12px',
  },
  successText: {
    color: '#888',
    lineHeight: 1.6,
    marginBottom: '32px',
  },
}
