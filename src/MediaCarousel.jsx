import { useState, useRef } from 'react'

function getTikTokVideoId(url) {
  const match = url.match(/\/video\/(\d+)/)
  return match ? match[1] : null
}

export default function MediaCarousel({ mediaUrls, mediaTypes }) {
  const [current, setCurrent] = useState(0)
  const touchStartX = useRef(null)

  const urls = (mediaUrls || '').split('|').map(s => s.trim()).filter(Boolean)
  const types = (mediaTypes || '').split('|').map(s => s.trim().toLowerCase())

  if (urls.length === 0) return null

  const total = urls.length
  const type = types[current] || 'image'
  const url = urls[current]

  const prev = () => setCurrent(i => (i - 1 + total) % total)
  const next = () => setCurrent(i => (i + 1) % total)

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx < -40) next()
    else if (dx > 40) prev()
    touchStartX.current = null
  }

  const videoId = type === 'tiktok' ? getTikTokVideoId(url) : null

  return (
    <div className="media-carousel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="media-carousel__track">
        {type === 'tiktok' ? (
          videoId ? (
            <iframe
              src={`https://www.tiktok.com/embed/v2/${videoId}`}
              className="media-carousel__tiktok"
              allowFullScreen
              allow="encrypted-media"
              title="TikTok video"
              loading="lazy"
            />
          ) : (
            <div className="media-carousel__placeholder">Video unavailable</div>
          )
        ) : (
          <img src={url} alt="" loading="lazy" className="media-carousel__img" />
        )}
      </div>

      {total > 1 && (
        <>
          <button className="media-carousel__arrow media-carousel__arrow--prev" onClick={prev} aria-label="Previous">&#8249;</button>
          <button className="media-carousel__arrow media-carousel__arrow--next" onClick={next} aria-label="Next">&#8250;</button>
          <div className="media-carousel__dots">
            {urls.map((_, i) => (
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
