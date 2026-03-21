import posthog from 'posthog-js'

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: false,  // manual via React Router
    autocapture: false,
    persistence: 'localStorage',
  })
}

export function trackPageview() {
  posthog.capture('$pageview', { $current_url: window.location.href })
}

export function trackTicketClick(event, category = 'nightlife') {
  posthog.capture('ticket_click', {
    event_name: event.event_name || event.match_name || '',
    venue:      event.venue || '',
    page_path:  window.location.pathname,
    category,
  })
}

export function trackContactSubmit() {
  posthog.capture('contact_form_submitted')
}

export function trackEventSubmit(eventName) {
  posthog.capture('event_form_submitted', { event_name: eventName || '' })
}
