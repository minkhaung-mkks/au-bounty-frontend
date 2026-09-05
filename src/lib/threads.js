import { useSyncExternalStore } from 'react'
import { api } from '../api.js'

/**
 * Thread-list state shared between the Messages screen and the shell's unread
 * badge, so reading a thread in one place zeroes the badge in the other without
 * a refetch. /me/threads stays the source of truth; socket nudges only decide
 * when to pull it again.
 */

let state = { threads: [], loading: false, error: null, openThreadId: null }

const listeners = new Set()
const set = (patch) => {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

export const totalUnread = (threads) => threads.reduce((n, t) => n + (t.unreadCount || 0), 0)

export const threadsStore = {
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getState: () => state,

  async reload() {
    set({ loading: true, error: null })
    try {
      const payload = await api.get('/me/threads')
      // The server wraps the list in { threads: [...] }; a bare array is fine too.
      const threads = Array.isArray(payload) ? payload : (payload?.threads ?? [])
      set({ threads, loading: false })
    } catch (error) {
      set({ error, loading: false })
    }
  },

  /** Which thread the Messages screen currently shows, for nudge filtering. */
  openThread(assignmentId) {
    if (state.openThreadId !== assignmentId) set({ openThreadId: assignmentId })
  },
  closeThread() {
    if (state.openThreadId !== null) set({ openThreadId: null })
  },

  /**
   * Zeroes one thread's unread count locally and tells the server. Fire and
   * forget: the next /me/threads pull reconciles if the POST fails.
   */
  markRead(assignmentId) {
    const thread = state.threads.find((t) => t.assignmentId === assignmentId)
    if (thread?.unreadCount) {
      set({
        threads: state.threads.map((t) =>
          t.assignmentId === assignmentId ? { ...t, unreadCount: 0 } : t,
        ),
      })
    }
    api.post(`/assignments/${assignmentId}/read`).catch(() => {})
  },

  /** Applies a live message to its thread row: preview, unread, order. */
  touch(assignmentId, lastMessage, { bump = false } = {}) {
    const index = state.threads.findIndex((t) => t.assignmentId === assignmentId)
    if (index === -1) return
    const threads = state.threads.slice()
    const [thread] = threads.splice(index, 1)
    threads.unshift({
      ...thread,
      lastMessage: lastMessage ?? thread.lastMessage,
      unreadCount: bump ? (thread.unreadCount || 0) + 1 : thread.unreadCount,
    })
    set({ threads })
  },
}

export function useThreads() {
  return useSyncExternalStore(threadsStore.subscribe, threadsStore.getState)
}

let reloadTimer = null
/** Collapses a burst of socket nudges into one /me/threads request. */
export function reloadThreadsSoon(ms = 400) {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(() => threadsStore.reload(), ms)
}
