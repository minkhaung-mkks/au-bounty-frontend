/**
 * Loader for the Google Maps JavaScript API, used by the create form's map
 * picker. The browser key is a build-time Vite variable and therefore public
 * by design (restrict it by HTTP referrer in the Google console); it is a
 * different key from the server's GOOGLE_MAPS_KEY, which geocodes names and
 * signs static thumbnails and must never reach the bundle.
 *
 * Without a key the picker hides itself and the coordinate fields stay the way
 * a location is set, exactly as before this file existed.
 */

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? ''
const CALLBACK = '__aubountyMapsReady'

export const hasMapsBrowserKey = Boolean(KEY)

let loading = null

/**
 * Resolves with `window.google.maps` once the API is live. The script tag is
 * injected once per page; every later call reuses the same promise, so several
 * mounted maps never race each other into duplicate loads.
 */
export function loadGoogleMaps() {
  if (!KEY) return Promise.reject(new Error('No Google Maps browser key configured.'))
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    window[CALLBACK] = () => {
      delete window[CALLBACK]
      resolve(window.google.maps)
    }

    const script = document.createElement('script')
    const params = new URLSearchParams({
      key: KEY,
      v: 'weekly',
      loading: 'async',
      callback: CALLBACK,
    })
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.onerror = () => {
      // A failed load must not poison the promise for a later retry.
      loading = null
      delete window[CALLBACK]
      reject(new Error('The map could not be loaded.'))
    }
    document.head.appendChild(script)
  })

  return loading
}

/**
 * The Places library (New): `AutocompleteSuggestion` for the search-as-you-type
 * list and `AutocompleteSessionToken` so a burst of keystrokes plus the one
 * place fetched afterwards bill as a single session.
 */
export async function loadPlaces() {
  const maps = await loadGoogleMaps()
  return maps.importLibrary('places')
}
