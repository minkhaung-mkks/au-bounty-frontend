import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Small stand-in for a data-fetching library. Runs `fn` when `deps` change,
 * ignores results from a request that a newer one has already superseded, and
 * hands back a `reload` for after mutations.
 */
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const latest = useRef(0)

  const run = useCallback(async () => {
    const ticket = ++latest.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fn()
      if (ticket === latest.current) setState({ data, error: null, loading: false })
    } catch (error) {
      if (ticket === latest.current) setState({ data: null, error, loading: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
  }, [run])

  return { ...state, reload: run }
}

/** Delays a fast-changing value, so typing in the search box does not fire per keystroke. */
export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
