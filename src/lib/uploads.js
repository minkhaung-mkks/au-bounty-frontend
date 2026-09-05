import { api } from '../api.js'

/**
 * D5 attachment uploads. The API never proxies bytes: it validates, records the
 * Attachment row and hands back a presigned PUT; the browser then talks to the
 * object store directly. Everything the three screens share about that flow
 * lives here: the client-side mirror of the server's allowlist, friendly
 * rejection messages, one presign-then-PUT with progress, and downloads via the
 * short-lived GET url.
 */

export const MAX_UPLOAD_MB = 10
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024

// Mirrors MIME_TYPES in backend/src/routes/files.js. Keep both lists in step.
export const ALLOWED_TYPES = [
  ['application/pdf', 'pdf', 'PDF'],
  ['image/png', 'png', 'PNG'],
  ['image/jpeg', 'jpg', 'JPG'],
  ['image/webp', 'webp', 'WebP'],
  ['image/gif', 'gif', 'GIF'],
  ['text/plain', 'txt', 'TXT'],
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'docx',
    'DOCX',
  ],
]

const BY_TYPE = new Map(ALLOWED_TYPES.map(([type, ext, label]) => [type, { ext, label }]))
const BY_EXT = new Map(ALLOWED_TYPES.map(([type, ext]) => [ext, type]))

/** The file-picker filter: extensions AND mime types, so both kinds of browser match. */
export const ACCEPT_SELECTOR = ALLOWED_TYPES.flatMap(([type, ext]) => [type, `.${ext}`])
  .concat('.jpeg')
  .join(',')

/**
 * The type to presign with. Some browsers report no mime type for less common
 * extensions (.docx especially); when that happens the extension decides. The
 * server records the declared type either way, so the client only has to stay
 * self-consistent: this value is what the PUT's Content-Type header must repeat.
 */
export function effectiveMime(file) {
  if (BY_TYPE.has(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  return BY_EXT.get(ext) ?? file.type
}

/** Friendly, file-specific reason this file cannot be uploaded, or null. */
export function uploadRejection(file) {
  const mime = effectiveMime(file)
  if (!BY_TYPE.has(mime)) {
    const labels = ALLOWED_TYPES.map(([, , label]) => label).join(', ')
    return `${file.name}: that file type is not allowed. Accepted: ${labels}.`
  }
  if (file.size < 1) return `${file.name}: the file is empty.`
  if (file.size > MAX_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}; the limit is ${MAX_UPLOAD_MB} MB.`
  }
  return null
}

/**
 * Presigns then uploads one file, resolving with the Attachment row the parent
 * payload will carry. XHR rather than fetch because upload progress is the
 * point. No auto-retry: a failure rejects (ApiError from presign, plain Error
 * from the PUT) and the caller decides what to surface.
 */
export function uploadFile({ file, taskId, messageId, onProgress }) {
  const mimeType = effectiveMime(file)
  const parent = taskId ? { taskId } : { messageId }
  return api
    .post('/files/presign', { fileName: file.name, mimeType, sizeBytes: file.size, ...parent })
    .then((presigned) =>
      putBytes(presigned.uploadUrl, file, mimeType, onProgress)
        .catch((err) => {
          // Presigning already created the Attachment row; a PUT that never
          // lands would leave a chip that downloads nothing, so the row goes
          // best-effort. A retry presigns fresh.
          api.del(`/files/${presigned.attachmentId}`).catch(() => {})
          throw err
        })
        .then(() => ({
          id: presigned.attachmentId,
          fileName: file.name,
          mimeType,
          sizeBytes: file.size,
          createdAt: new Date().toISOString(),
        })),
    )
}

/** The PUT half, separated so its errors read as upload errors, not presign ones. */
function putBytes(uploadUrl, file, mimeType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    // The signature covers the declared content type only loosely (host header),
    // so the store accepts mismatches silently; sending exactly what was
    // presigned is the client's job.
    xhr.setRequestHeader('Content-Type', mimeType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`The file server rejected the upload (${xhr.status}).`))
    xhr.onerror = () => reject(new Error('The upload did not reach the file server.'))
    xhr.onabort = () => reject(new Error('Upload cancelled.'))
    xhr.send(file)
  })
}

/**
 * Downloads one attachment. The API is asked for a short-lived url first; that
 * url is credential-free and carries Content-Disposition with the original
 * filename, so a plain navigation is enough and no CORS is involved.
 */
export async function downloadAttachment(attachment) {
  const { url } = await api.get(`/files/${attachment.id}/url`)
  const anchor = document.createElement('a')
  anchor.href = url
  // Browsers ignore `download` cross-origin; it costs nothing and covers a
  // same-origin store, with the disposition header doing the naming otherwise.
  anchor.download = attachment.fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function formatBytes(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MAX_BYTES) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / MAX_BYTES).toFixed(1)} MB`
}

/** Material Symbols name per mime type, so every screen picks the same icon. */
export function attachmentIcon(mimeType) {
  if (mimeType === 'application/pdf') return 'picture_as_pdf'
  if (mimeType?.startsWith('image/')) return 'image'
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return 'description'
  return 'text_snippet'
}
