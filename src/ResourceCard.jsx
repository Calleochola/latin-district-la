export default function ResourceCard({ name, area, description, phone, tel, email, website, badge, note }) {
  return (
    <div className="resource-card">
      {badge && <span className="resource-badge resource-badge--escort">{badge}</span>}
      {area && <div className="resource-card__area">{area}</div>}
      <h4 className="resource-card__title">{name}</h4>
      {description && <p className="resource-card__desc">{description}</p>}
      {note && <p className="resource-card__note">{note}</p>}
      {email && <a href={`mailto:${email}`} className="resource-card__link">{email}</a>}
      <div className="resource-card__actions">
        {phone && (
          <a
            href={`tel:${(tel || phone).replace(/\D/g, '')}`}
            className="btn btn-red"
            style={{ fontSize: 13, padding: '8px 16px', minHeight: 36 }}
          >
            Call {phone}
          </a>
        )}
        {website && (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline-blue"
            style={{ fontSize: 13, padding: '8px 16px', minHeight: 36 }}
          >
            Website
          </a>
        )}
      </div>
    </div>
  )
}
