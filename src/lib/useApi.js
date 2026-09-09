import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Small stand-in for a data-fetching library. Runs `fn` when `deps` change,
 * ignores results from a request that a newer one has already superseded, and
 * hands back a `reload` for after mutations.
 *
 * A refetch keeps the data already on screen. Screens gate their full-page
 * loader on `loading && !data`, so confirming a task or taking a socket nudge
 * refreshes the numbers in place instead of blanking the page the user is
 * reading. `refreshing` is the flag for a quiet inline hint while that runs.
 */
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true, refreshing: false })
  const latest = useRef(0)

  const run = useCallback(async () => {
    const ticket = ++latest.current
    // `loading` means "nothing to show yet", so a screen that guards on it
    // renders its skeleton once and never blanks itself again.
    setState((s) => ({
      data: s.data,
      error: null,
      loading: s.data == null,
      refreshing: s.data != null,
    }))
    try {
      const data = await fn()
      if (ticket === latest.current) setState({ data, error: null, loading: false, refreshing: false })
    } catch (error) {
      // Keep the last good data on a failed refresh; the caller decides whether
      // to show the error inline or replace the view.
      if (ticket === latest.current) {
        setState((s) => ({ data: s.data, error, loading: false, refreshing: false }))
      }
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
