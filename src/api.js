const BASE = '/aubounty/api'
const STORAGE_KEY = 'aubounty.userId'

export const getStoredUserId = () => localStorage.getItem(STORAGE_KEY)
export const setStoredUserId = (id) => localStorage.setItem(STORAGE_KEY, id)
export const clearStoredUserId = () => localStorage.removeItem(STORAGE_KEY)

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error?.message || `Request failed (${status})`)
    this.status = status
    this.code = payload?.error?.code || 'UNKNOWN'
    this.details = payload?.error?.details
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  // v0.5 stand-in for a bearer token. One header, one middleware on the server.
  const userId = getStoredUserId()
  if (userId) headers['x-dev-user-id'] = userId

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await res.text()
  const payload = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, payload)
  return payload
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
}
