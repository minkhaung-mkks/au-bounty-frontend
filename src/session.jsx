import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  api,
  clearStoredUserId,
  fetchMeta,
  getStoredUserId,
  microsoftLoginUrl,
  NO_CAPABILITIES,
  setStoredUserId,
} from './api.js'

const SessionContext = createContext(null)

/**
 * Holds whoever is currently "signed in". Two credentials, one shape:
 *
 * - Dev picker (meta.devAuth true): a seeded user id in localStorage, sent as
 *   the x-dev-user-id header. This is the only mode until /meta exists.
 * - Microsoft SSO (meta.devAuth false): an httpOnly cookie the server set on
 *   /auth/callback. Nothing is stored or attached client-side.
 */
export function SessionProvider({ children }) {
  const [state, setState] = useState({
    me: null,
    loading: true,
    devAuth: true,
    capabilities: NO_CAPABILITIES,
  })

  const load = useCallback(async () => {
    const { devAuth, capabilities } = await fetchMeta()
    // A cookie session authenticates by cookie alone; drop any picker id left
    // over from earlier so requests never send a conflicting header.
    if (!devAuth) clearStoredUserId()
    if (devAuth && !getStoredUserId()) {
      setState({ me: null, loading: false, devAuth, capabilities })
      return
    }
    try {
      const me = await api.get('/me')
      setState({ me, loading: false, devAuth, capabilities })
    } catch {
      // 401 (no or expired cookie), or a stale picked id after a reseed.
      clearStoredUserId()
      setState({ me: null, loading: false, devAuth, capabilities })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const signIn = useCallback(
    async (userId) => {
      setStoredUserId(userId)
      setState({ me: null, loading: true })
      await load()
    },
    [load],
  )

  /** Leaves the SPA entirely; the server brings the browser back via returnTo. */
  const signInWithMicrosoft = useCallback((returnTo) => {
    clearStoredUserId()
    window.location.assign(microsoftLoginUrl(returnTo))
  }, [])

  const signOut = useCallback(() => {
    // Only a cookie session has server-side state to end.
    if (!state.devAuth) api.get('/auth/logout').catch(() => {})
    clearStoredUserId()
    setState((s) => ({ me: null, loading: false, devAuth: s.devAuth, capabilities: s.capabilities }))
  }, [state.devAuth])

  const value = {
    me: state.me?.user ?? null,
    orgs: state.me?.orgs ?? [],
    tags: state.me?.tags ?? [],
    stats: state.me?.stats ?? null,
    loading: state.loading,
    devAuth: state.devAuth,
    capabilities: state.capabilities ?? NO_CAPABILITIES,
    signIn,
    signInWithMicrosoft,
    signOut,
    reload: load,
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = () => useContext(SessionContext)

/** Mirrors the server's rules so the UI can disable what the API would refuse. */
export const canPostEvent = (me, orgs) =>
  Boolean(me) && (orgs.length > 0 || me.role === 'TEACHER' || me.role === 'ADMIN')
export const canOfferExtraCredit = (me) => me?.role === 'TEACHER' || me?.role === 'ADMIN'
