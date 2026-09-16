import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  api,
  clearStoredUserId,
  fetchMeta,
  microsoftLoginUrl,
  NO_CAPABILITIES,
  setStoredUserId,
} from './api.js'

const SessionContext = createContext(null)

/**
 * Holds whoever is currently "signed in". Three credentials, one shape:
 *
 * - Dev picker (meta.devAuth true): a seeded user id in localStorage, sent as
 *   the x-dev-user-id header. This is the only mode until /meta exists.
 * - Microsoft SSO (meta.devAuth false): an httpOnly cookie the server set on
 *   /auth/callback. Nothing is stored or attached client-side.
 * - Admin password (/admin-login, any mode): the same httpOnly cookie, set on
 *   POST /auth/admin/login instead. The server prefers a cookie over the dev
 *   header, so an admin session survives a leftover picker id.
 *
 * Because a cookie can be present in either mode, /me is always attempted; a
 * 401 is the normal "nobody is signed in" answer, not an error.
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

  /**
   * Admin console sign-in. The server answers with a session cookie, so the
   * only client-side work is dropping any picker id that would otherwise ride
   * along as a conflicting header, then reloading /me. Errors propagate for the
   * form to show.
   */
  const signInWithPassword = useCallback(
    async (email, password) => {
      clearStoredUserId()
      await api.post('/auth/admin/login', { email, password })
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
    // Unconditional: an admin password session leaves a cookie to clear even
    // while the dev picker is enabled.
    api.get('/auth/logout').catch(() => {})
    clearStoredUserId()
    setState((s) => ({ me: null, loading: false, devAuth: s.devAuth, capabilities: s.capabilities }))
  }, [])

  const value = {
    me: state.me?.user ?? null,
    orgs: state.me?.orgs ?? [],
    tags: state.me?.tags ?? [],
    stats: state.me?.stats ?? null,
    loading: state.loading,
    devAuth: state.devAuth,
    capabilities: state.capabilities ?? NO_CAPABILITIES,
    signIn,
    signInWithPassword,
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
