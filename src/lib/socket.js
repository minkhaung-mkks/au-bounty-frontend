import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { getStoredUserId } from '../api.js'

/**
 * One shared socket for the whole signed-in app.
 *
 * - The server pins it to /aubounty/socket.io, same-origin, so the session
 *   cookie rides along with no auth payload.
 * - Dev-picker sessions have no cookie, so the picked user id travels the same
 *   way the REST calls send it: the x-dev-user-id header. Browsers can only
 *   set that on the polling handshake, which is the transport every
 *   connection starts on before upgrading.
 * - Screens never touch the socket directly. They subscribe to rooms through
 *   subscribe()/unsubscribe() (bookkept here and replayed on every reconnect,
 *   since the server forgets rooms when a socket drops) and listen for server
 *   events through useSocketEvent().
 */

const SOCKET_PATH = '/aubounty/socket.io'
const SERVER_EVENTS = ['emergency:new', 'message:new', 'message:read', 'task:updated']

let socket = null
const listeners = new Map() // event name -> Set of handlers
const rooms = new Map() // room key -> payload to (re)subscribe

const roomKey = (room) =>
  room.assignmentId ? `assignment:${room.assignmentId}` : room.taskId ? `task:${room.taskId}` : null

function notify(event, payload) {
  const set = listeners.get(event)
  if (!set) return
  for (const handler of set) handler(payload)
}

/** Registers a handler and returns its unregister function. */
export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(handler)
  return () => listeners.get(event)?.delete(handler)
}

function create() {
  const devUserId = getStoredUserId()
  socket = io({
    path: SOCKET_PATH,
    withCredentials: true,
    ...(devUserId ? { extraHeaders: { 'x-dev-user-id': devUserId } } : {}),
  })

  socket.on('connect', () => {
    // The server dropped all room membership with the old connection; ask again.
    for (const room of rooms.values()) emitSubscribe(room, true)
    notify('status', { connected: true })
  })
  socket.on('disconnect', () => notify('status', { connected: false }))
  socket.onAny((event, payload) => {
    if (SERVER_EVENTS.includes(event)) notify(event, payload)
  })
  return socket
}

export const connectSocket = () => socket ?? create()

export function disconnectSocket() {
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
  rooms.clear()
  notify('status', { connected: false })
}

/** The server answers { ok: true, room } or { ok: false, error }; REST stays authoritative either way. */
const emitSubscribe = (room, subscribing) => {
  const event = subscribing ? 'subscribe' : 'unsubscribe'
  socket.emit(event, room, (ack) => {
    if (ack?.ok === false) {
      console.warn(`socket ${event} rejected for ${roomKey(room)}: ${ack.error}`)
    }
  })
}

/**
 * Joins a room: { taskId } for a task detail page, { assignmentId } for a chat
 * thread. Safe to call before the socket connects; the room replays on connect.
 * Assignment rooms admit only the two participants; the server decides.
 */
export function subscribe(room) {
  const key = roomKey(room)
  if (!key) return
  rooms.set(key, room)
  if (socket?.connected) emitSubscribe(room, true)
}

export function unsubscribe(room) {
  const key = roomKey(room)
  if (!key) return
  rooms.delete(key)
  if (socket?.connected) emitSubscribe(room, false)
}

/** Listens for one server event for as long as the calling component lives. */
export function useSocketEvent(event, handler) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => on(event, (payload) => ref.current(payload)), [event])
}

/**
 * Owns the connection's lifetime: up while a signed-in shell is mounted, down
 * on unmount (sign-out, login screen) and rebuilt when the user id changes
 * (dev user switch carries a different handshake identity).
 */
export function useSocketSession(userId) {
  useEffect(() => {
    if (!userId) return undefined
    connectSocket()
    return () => disconnectSocket()
  }, [userId])
}
