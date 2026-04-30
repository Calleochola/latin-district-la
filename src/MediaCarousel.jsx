import { useState, useRef } from 'react'

function getYouTubeVideoId(url) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/)|youtu\.be\/)([^&?/]+)/)
  return match ? match[1] : null
}

function getTikTokVideoId(url) {
  const match = url.match(/\/video\/(\d+)/)
  return match ? match[1] : null
}

// Extracts a Drive file ID from ANY known Drive URL format and returns
// the lh3.googleusercontent.com CDN URL — the only format that reliably
// renders in <img> tags without auth or redirects.
function convertDriveUrl(url) {
  if (!url) return ''

  // Already the correct CDN format — pass through
  if (url.includes('lh3.googleusercontent.com')) return url

  let fileId = null

  // /file/d/{ID}/  or  /d/{ID}/
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/)
  if (dMatch) fileId = dMatch[1]

  // ?id={ID} or &id={ID}  (covers open?id= and uc?export=view&id=)
  if (!fileId) {
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{25,})/)
    if (idMatch) fileId = idMatch[1]
  }

  // Raw file ID string
  if (!fileId && /^[a-zA-Z0-9_-]{25,}$/.test(url.trim())) {
    fileId = url.trim()
  }

  if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}`

  return url
}

// Detect video type from URL — mirrors App.jsx getVideoType
function detectType(url) {
  if (!url) return 'image'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
  if (url.includes('tiktok.com')) return 'tiktok'
  return 'image'
}

// ── CarouselSlide ─────────────────────────────────────────────────────────────
function CarouselSlide({ rawUrl, type, isFirst }) {
  const [imgBroken, setImgBroken] = useState(false)

  if (type === 'youtube') {
    const youtubeId = getYouTubeVideoId(rawUrl)
    return youtubeId ? (
      <iframe
        src={`https://www.youtube.com/embed/${youtubeId}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        title="YouTube video"
        loading="lazy"
      />
    ) : (
      <div className="media-carousel__placeholder">Video unavailable</div>
    )
  }

  if (type === 'tiktok') {
    const tiktokId = getTikTokVideoId(rawUrl)
    return tiktokId ? (
      <iframe
        src={`https://www.tiktok.com/embed/v2/${tiktokId}`}
        className="media-carousel__tiktok"
        allowFullScreen
        allow="encrypted-media"
        title="TikTok video"
        loading="lazy"
      />
    ) : (
      <div className="media-carousel__placeholder">Video unavailable</div>
    )
  }

  const url = convertDriveUrl(rawUrl)
  if (!url || imgBroken) {
    return <div className="media-carousel__placeholder">Image unavailable</div>
  }

  return (
    <img
      src={url}
      alt=""
      loading={isFirst ? 'eager' : 'lazy'}
      className="media-carousel__img"
      onError={() => setImgBroken(true)}
    />
  )
}

// ── MediaCarousel ─────────────────────────────────────────────────────────────
export default function MediaCarousel({ mediaUrls, mediaTypes }) {
  const [current, setCurrent] = useState(0)
  const touchStartX = useRef(null)

  const rawUrls  = (mediaUrls  || '').split('|').map(s => s.trim()).filter(Boolean)
  const rawTypes = (mediaTypes || '').split('|').map(s => s.trim().toLowerCase())

  if (rawUrls.length === 0) return null

  const entries = rawUrls.map((url, i) => ({
    url,
    type: rawTypes[i] || detectType(url),
  }))

  const total = entries.length
  const { url: activeUrl, type: activeType } = entries[current]

  const prev = () => setCurrent(i => (i - 1 + total) % total)
  const next = () => setCurrent(i => (i + 1) % total)

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx < -40) next()
    else if (dx > 40) prev()
    touchStartX.current = null
  }

  const trackClass = `media-carousel__track${activeType === 'youtube' ? ' media-carousel__track--16x9' : ''}`

  return (
    <div className="media-carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className={trackClass}>
        <CarouselSlide rawUrl={activeUrl} type={activeType} key={`${current}-${activeType}`} isFirst={current === 0} />
      </div>

      {total > 1 && (
        <>
          <button className="media-carousel__arrow media-carousel__arrow--prev" onClick={prev} aria-label="Previous">&#8249;</button>
          <button className="media-carousel__arrow media-carousel__arrow--next" onClick={next} aria-label="Next">&#8250;</button>
          <div className="media-carousel__dots">
            {entries.map((_, i) => (
              <button
                key={i}
                className={`media-carousel__dot${i === current ? ' active' : ''}`}
                onClick={() => setCurrent(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
