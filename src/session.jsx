import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, clearStoredUserId, getStoredUserId, setStoredUserId } from './api.js'

const SessionContext = createContext(null)

/**
 * Holds whoever is currently "signed in".
 *
 * In v0.5 that is a seeded user picked from a list, remembered in localStorage.
 * When Microsoft sign-in lands this provider keeps the same shape: only where
 * the credential comes from changes.
 */
export function SessionProvider({ children }) {
  const [state, setState] = useState({ me: null, loading: true })

  const load = useCallback(async () => {
    if (!getStoredUserId()) {
      setState({ me: null, loading: false })
      return
    }
    try {
      const me = await api.get('/me')
      setState({ me, loading: false })
    } catch {
      // Stale id, e.g. the database was reseeded and the old uuid is gone.
      clearStoredUserId()
      setState({ me: null, loading: false })
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

  const signOut = useCallback(() => {
    clearStoredUserId()
    setState({ me: null, loading: false })
  }, [])

  const value = {
    me: state.me?.user ?? null,
    orgs: state.me?.orgs ?? [],
    tags: state.me?.tags ?? [],
    stats: state.me?.stats ?? null,
    loading: state.loading,
    signIn,
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
