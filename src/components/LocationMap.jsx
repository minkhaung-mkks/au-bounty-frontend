import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui.jsx'
import { formatCoords, hasLocation } from '../lib/format.js'
import { hasMapsBrowserKey, loadGoogleMaps } from '../lib/googleMaps.js'

/**
 * Real Google tiles for stored coordinates, drawn through the Maps JS API the
 * create-form picker already loads. Panning and zooming stay on so the pin can
 * be read in context; the controls are hidden because this is a thumbnail
 * inside a card, not a map screen.
 */
function MapTiles({ lat, lng, name, height }) {
  const holder = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !holder.current) return
        const map = new maps.Map(holder.current, {
          center: { lat, lng },
          zoom: 16,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          clickableIcons: false,
        })
        new maps.Marker({ map, position: { lat, lng }, title: name ?? undefined })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [lat, lng, name])

  if (failed) {
    return (
      <div className="map-fake" style={{ height }}>
        <Icon name="location_on" size={46} color="var(--red)" />
        <span className="tag">Pinned by coordinates</span>
      </div>
    )
  }

  return <div ref={holder} style={{ height }} />
}

/**
 * The map half of D9. With coordinates and a browser Maps key it draws live
 * tiles; without the key it falls back to the server's static thumbnail
 * (`mapUrl`, present only when the server is keyed) and then to the grid
 * placeholder. Coordinates always buy a "Directions" deep link, which needs no
 * key at all.
 *
 * `location` follows the task serialization: { name, lat, lng, mapUrl }.
 */
export function LocationMap({ location, height = 230, caption = true }) {
  // A key can be valid for geocoding and still be refused by the Static Maps
  // API, which answers 403 with a plain-text body. That reaches the page as a
  // broken image, so a failed load falls back to the placeholder grid.
  const [imageFailed, setImageFailed] = useState(false)

  if (!hasLocation(location)) return null
  const { name, lat, lng, mapUrl } = location
  const hasCoords = lat != null && lng != null

  return (
    <div>
      {hasCoords && hasMapsBrowserKey ? (
        <MapTiles lat={lat} lng={lng} name={name} height={height} />
      ) : mapUrl && !imageFailed ? (
        <img
          src={mapUrl}
          alt={name ? `Map of ${name}` : 'Map of the location'}
          style={{ width: '100%', height, objectFit: 'cover', display: 'block' }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="map-fake" style={{ height }}>
          <Icon name="location_on" size={46} color="var(--red)" />
          {hasCoords ? <span className="tag">Pinned by coordinates</span> : null}
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
              {name || 'No location'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 3 }}>
              {hasCoords ? formatCoords(lat, lng) : 'No coordinates stored yet'}
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
      ) : null}
    </div>
  )
}
