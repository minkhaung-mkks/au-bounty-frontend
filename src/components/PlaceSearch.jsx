import { useEffect, useId, useRef, useState } from 'react'
import { CAMPUS_DEFAULT } from '../lib/format.js'
import { loadPlaces } from '../lib/googleMaps.js'

const DEBOUNCE_MS = 250
const MIN_QUERY = 2
/** Campus first, then the rest of Bangkok; far enough for a mall or an airport. */
const BIAS_RADIUS_M = 30_000

/**
 * Search-as-you-type over Google Places (New), wired to the same field a
 * poster can still type freely into. Picking a suggestion is what drops the
 * pin: the place's own coordinates go straight to `onSelect`, which is why a
 * famous landmark needs no map clicking at all.
 *
 * Typing without picking is still valid — the name goes to the API and the
 * server geocodes it — so the list is an accelerator, never a gate.
 */
export function PlaceSearch({ id, value, onChange, onSelect, placeholder, onFocusInput }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [failed, setFailed] = useState(false)

  const places = useRef(null)
  const token = useRef(null)
  // Set while a suggestion is being applied, so the resulting value change does
  // not immediately query for the text just chosen.
  const applying = useRef(false)
  const listId = useId()

  useEffect(() => {
    let cancelled = false
    loadPlaces()
      .then((lib) => {
        if (!cancelled) places.current = lib
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const query = value.trim()
    if (applying.current) {
      applying.current = false
      return
    }
    if (query.length < MIN_QUERY) {
      setSuggestions([])
      setOpen(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      const lib = places.current
      if (!lib) return
      try {
        token.current ??= new lib.AutocompleteSessionToken()
        const { suggestions: found } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: token.current,
          locationBias: { center: CAMPUS_DEFAULT, radius: BIAS_RADIUS_M },
        })
        if (cancelled) return
        setSuggestions(found.filter((s) => s.placePrediction))
        setActive(-1)
        setOpen(true)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [value])

  /** Turn a prediction into a name and a pin, then end the billing session. */
  const choose = async (suggestion) => {
    const prediction = suggestion.placePrediction
    const label = prediction.structuredFormat?.mainText?.text ?? prediction.text?.toString() ?? ''

    applying.current = true
    onChange(label)
    setOpen(false)
    setSuggestions([])

    try {
      const place = prediction.toPlace()
      await place.fetchFields({ fields: ['displayName', 'location', 'formattedAddress'] })
      const point = place.location
      onSelect({
        name: place.displayName ?? label,
        lat: point ? point.lat() : null,
        lng: point ? point.lng() : null,
      })
    } catch {
      // The name alone still posts: the server geocodes it on create.
      onSelect({ name: label, lat: null, lng: null })
    } finally {
      token.current = null
    }
  }

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      // Enter on a highlighted suggestion picks it instead of posting the form.
      e.preventDefault()
      choose(suggestions[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="suggest-wrap">
      <input
        id={id}
        className="field"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          onFocusInput?.()
          if (suggestions.length > 0) setOpen(true)
        }}
        // Blur fires before a click on an option, so closing waits a tick.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />

      {open && suggestions.length > 0 ? (
        <ul className="suggest" id={listId} role="listbox">
          {suggestions.map((s, i) => {
            const p = s.placePrediction
            return (
              <li
                key={p.placeId ?? i}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="suggest-option"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
              >
                <div className="suggest-main">{p.structuredFormat?.mainText?.text ?? p.text?.toString()}</div>
                {p.structuredFormat?.secondaryText?.text ? (
                  <div className="suggest-sub">{p.structuredFormat.secondaryText.text}</div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {failed ? (
        <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 6 }}>
          Place search is unavailable. Type the name, or drop a pin on the map.
        </div>
      ) : null}
    </div>
  )
}
