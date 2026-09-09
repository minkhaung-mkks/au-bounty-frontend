import { useEffect, useRef, useState } from 'react'
import { CAMPUS_DEFAULT, formatCoords } from '../lib/format.js'
import { loadGoogleMaps } from '../lib/googleMaps.js'
import { Icon } from './ui.jsx'

const SAME = (a, b) => a != null && b != null && Math.abs(a - b) < 1e-7

/**
 * Click-to-pin map for the create form. The pin is the authoritative location:
 * the API stores supplied coordinates as given and never geocodes the name
 * over them, so what the poster clicks is what takers navigate to.
 *
 * `onPick` receives { lat, lng, name }, where `name` is the reverse-geocoded
 * street address when Google returns one and null otherwise — the caller
 * decides whether to overwrite a name the poster typed.
 */
export function MapPicker({ lat, lng, onPick, height = 280 }) {
  const holder = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const geocoder = useRef(null)
  const [status, setStatus] = useState('loading')

  // The listeners below outlive the render that created them, so the callback
  // is read from a ref instead of being captured.
  const pick = useRef(onPick)
  useEffect(() => {
    pick.current = onPick
  }, [onPick])

  // Same reason: the initial centre must not re-run the loader when the pin
  // moves, so the first coordinates are read once.
  const initial = useRef({ lat, lng })

  useEffect(() => {
    let cancelled = false

    /** Move the pin, then hand the caller coordinates and a name for them. */
    const place = (position) => {
      const next = { lat: position.lat(), lng: position.lng() }
      if (marker.current) marker.current.setPosition(position)
      pick.current({ ...next, name: null })

      geocoder.current?.geocode({ location: next }, (results, state) => {
        if (cancelled || state !== 'OK' || !results?.[0]) return
        pick.current({ ...next, name: results[0].formatted_address ?? null })
      })
    }

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !holder.current) return

        const start = initial.current
        const centre = start.lat != null && start.lng != null ? start : CAMPUS_DEFAULT

        map.current = new maps.Map(holder.current, {
          center: centre,
          zoom: start.lat != null ? 17 : 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        marker.current = new maps.Marker({
          map: map.current,
          position: start.lat != null && start.lng != null ? start : null,
          draggable: true,
        })
        geocoder.current = new maps.Geocoder()

        map.current.addListener('click', (e) => place(e.latLng))
        marker.current.addListener('dragend', (e) => place(e.latLng))
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  // A pin cleared or typed into the coordinate fields has to reach the map too.
  useEffect(() => {
    if (status !== 'ready' || !marker.current) return
    const current = marker.current.getPosition()

    if (lat == null || lng == null) {
      marker.current.setPosition(null)
      return
    }
    if (current && SAME(current.lat(), lat) && SAME(current.lng(), lng)) return

    marker.current.setPosition({ lat, lng })
    map.current.panTo({ lat, lng })
  }, [lat, lng, status])

  /** The browser's own fix, for a poster standing where the task is. */
  const useMyLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { lat: coords.latitude, lng: coords.longitude }
        pick.current({ ...next, name: null })
        map.current?.setZoom(17)
        map.current?.panTo(next)
      },
      () => {},
      { timeout: 8_000 },
    )
  }

  if (status === 'error') {
    return (
      <div className="map-fake" style={{ height, flexDirection: 'column', gap: 8 }}>
        <Icon name="location_off" size={34} color="var(--muted-2)" />
        <span style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>
          The map could not be loaded. Enter coordinates below instead.
        </span>
      </div>
    )
  }

  return (
    <div>
      <div style={{ position: 'relative', border: '1px solid var(--line)' }}>
        <div ref={holder} style={{ height }} />
        {status === 'loading' ? (
          <div
            className="map-fake"
            style={{ height, position: 'absolute', inset: 0, fontSize: 12.5, color: 'var(--muted-2)' }}
          >
            Loading the map…
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 12.5,
          color: 'var(--muted-2)',
        }}
      >
        <span>
          {lat != null && lng != null ? formatCoords(lat, lng) : 'Click the map to drop a pin.'}
        </span>
        <button
          type="button"
          className="btn btn-link"
          style={{ fontSize: 12.5, marginLeft: 'auto' }}
          onClick={useMyLocation}
        >
          <Icon name="my_location" size={15} />
          Use my location
        </button>
        {lat != null && lng != null ? (
          <button
            type="button"
            className="btn btn-link"
            style={{ fontSize: 12.5 }}
            onClick={() => pick.current({ lat: null, lng: null, name: null })}
          >
            Clear pin
          </button>
        ) : null}
      </div>
    </div>
  )
}
