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

  // Only dev-picker sessions identify themselves this way. A Microsoft SSO
  // session is an httpOnly cookie the server set, which same-origin fetch
  // already sends, so nothing is attached for it.
  const devUserId = getStoredUserId()
  if (devUserId) headers['x-dev-user-id'] = devUserId

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
  del: (path) => request(path, { method: 'DELETE' }),
}

/**
 * File downloads need the same credentials as every other request, which a
 * plain <a href> cannot carry (the dev-picker header especially, so anchor
 * downloads 401 in dev mode). The bytes move through fetch and land via a blob
 * object-URL click instead. Errors still come back as the JSON envelope.
 */
export async function downloadFile(path, fileName) {
  const headers = {}
  const devUserId = getStoredUserId()
  if (devUserId) headers['x-dev-user-id'] = devUserId

  const res = await fetch(BASE + path, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }
    throw new ApiError(res.status, payload)
  }

  const url = URL.createObjectURL(await res.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/**
 * How the backend wants sign-in to work. Until the endpoint lands it 404s (or
 * the server is down entirely), and the only safe answer is "dev auth", i.e.
 * exactly today's behavior. Only an explicit `devAuth: false` switches the app
 * over to Microsoft sign-in. Read with a plain fetch because a 404 body is not
 * guaranteed to be JSON.
 */
export async function fetchMeta() {
  try {
    const res = await fetch(`${BASE}/meta`)
    if (!res.ok) return { devAuth: true, auth: null }
    const payload = await res.json().catch(() => null)
    return { devAuth: payload?.devAuth !== false, auth: payload?.auth ?? null }
  } catch {
    return { devAuth: true, auth: null }
  }
}

/** The login route answers with a 302 to Microsoft, so it needs a full page navigation, not fetch. */
export const microsoftLoginUrl = (returnTo) =>
  `${BASE}/auth/login?returnTo=${encodeURIComponent(returnTo || '/')}`
