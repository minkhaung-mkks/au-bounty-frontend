import { Icon } from './ui.jsx'

/**
 * The map half of D9: the server fills `mapUrl` only when a Google Maps key
 * exists, so this component renders the static image when it has one and the
 * grid placeholder otherwise. Coordinates, when stored, always buy a
 * "Directions" deep link — that part needs no key at all.
 *
 * `location` follows the task serialization: { name, lat, lng, mapUrl }.
 */
export function LocationMap({ location, height = 230, caption = true }) {
  if (!location) return null
  const { name, lat, lng, mapUrl } = location
  const hasCoords = lat != null && lng != null

  return (
    <div>
      {mapUrl ? (
        <img
          src={mapUrl}
          alt={name ? `Map of ${name}` : 'Map of the location'}
          style={{ width: '100%', height, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div className="map-fake" style={{ height }}>
          <Icon name="location_on" size={46} color="var(--red)" />
          <span className="tag">
            {hasCoords ? 'Pinned by coordinates · map image lands with the Maps key' : 'Placeholder map'}
          </span>
        </div>
      )}

      {caption ? (
        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16 }}>
              {name || 'Location'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 3 }}>
              {hasCoords ? `${lat}, ${lng}` : 'No coordinates stored yet'}
            </div>
          </div>
          {hasCoords ? (
            <a
              className="btn btn-outline btn-sm"
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="directions" size={16} color="var(--red)" />
              Directions
            </a>
          ) : null}
        </div>
      ) : hasCoords ? (
        <div style={{ padding: '12px 16px 0' }}>
          <a
            className="btn btn-link"
            style={{ fontSize: 12.5 }}
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="directions" size={16} />
            Directions
          </a>
        </div>
      ) : null}
    </div>
  )
}
