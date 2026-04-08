import { useState, useRef } from 'react'

function getYouTubeVideoId(url) {
  const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/)|youtu\.be\/)([^&?/]+)/)
  return match ? match[1] : null
}

function getTikTokVideoId(url) {
  const match = url.match(/\/video\/(\d+)/)
  return match ? match[1] : null
}

function convertDriveUrl(url) {
  if (!url) return ''
  const match = url.match(/\/d\/([^/]+)\//)
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`
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
// Renders into the `media-carousel__track` padding-top container.
// All children use position:absolute so they fill the track correctly.
// Images track broken state locally to show a clean placeholder instead of a
// broken-image box when the src fails to load.
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

  // Image — convert Drive URLs, show placeholder if missing or broken
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
// Props:
//   mediaUrls  — pipe-separated list of URLs          (required)
//   mediaTypes — pipe-separated list of type strings  (optional, auto-detected if omitted)
//
// Media order convention enforced by callers: flyer → venue → video
export default function MediaCarousel({ mediaUrls, mediaTypes }) {
  const [current, setCurrent] = useState(0)
  const touchStartX = useRef(null)

  const rawUrls  = (mediaUrls  || '').split('|').map(s => s.trim()).filter(Boolean)
  const rawTypes = (mediaTypes || '').split('|').map(s => s.trim().toLowerCase())

  if (rawUrls.length === 0) return null

  // Auto-detect type from URL when explicit type not provided or blank
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

  // Apply 16:9 track for YouTube so the iframe fills the correct aspect ratio
  const trackClass = `media-carousel__track${activeType === 'youtube' ? ' media-carousel__track--16x9' : ''}`

  return (
    <div className="media-carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className={trackClass}>
        {/* key on type+url resets broken-image state when slide changes */}
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
