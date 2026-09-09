export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/**
 * One place where a database enum becomes a sentence. Every screen reads from
 * these maps, so a status never reaches a student as PENDING_CONFIRMATION.
 * Each falls back to the raw value rather than rendering an empty element.
 */
export const TYPE_LABEL = {
  REQUEST: 'Request',
  EVENT: 'Event',
  EMERGENCY: 'Emergency',
}

export const TASK_STATUS_LABEL = {
  OPEN: 'Open',
  LOCKED: 'Full',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const REWARD_TYPE_LABEL = {
  NONE: 'No reward',
  CASH: 'Cash',
  EXTRA_CREDIT: 'Extra credit',
  OTHER: 'Other',
}

export const ROLE_LABEL = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  ADMIN: 'Admin',
  SERVICE: 'Service',
}

export const ACCEPTANCE_LABEL = {
  AUTO: 'First come',
  APPROVAL: 'Apply & approve',
}

export const TAG_CATEGORY_LABEL = {
  LANGUAGE: 'Language',
  ACADEMIC: 'Academic',
  PRACTICAL: 'Practical',
  ERRAND: 'Errand',
}

export const ALERT_STATUS_LABEL = {
  ACTIVE: 'Active',
  RESOLVED: 'Resolved',
  FLAGGED: 'Flagged',
}

/** The alert chip's colours, shared by the emergency screen and the console. */
export const ALERT_STATUS_STYLE = {
  ACTIVE: { background: 'var(--red)', color: '#fff' },
  RESOLVED: { background: 'var(--bone-2)', color: 'var(--green)' },
  FLAGGED: { background: 'var(--bone-2)', color: 'var(--muted)' },
}

/** Reads a label out of a map without ever rendering nothing. */
export const labelOf = (map, value) => map[value] ?? value ?? ''

export function rewardLabel(reward) {
  if (!reward || reward.type === 'NONE') return 'No reward'
  return reward.description || REWARD_TYPE_LABEL[reward.type] || reward.type
}

export const TYPE_CLASS = {
  REQUEST: 'chip-request',
  EVENT: 'chip-event',
  EMERGENCY: 'chip-emergency',
}

export const ACCENT_CLASS = {
  REQUEST: '',
  EVENT: 'accent-event',
  EMERGENCY: 'accent-emergency',
}

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export function relativeTime(value) {
  if (!value) return ''
  const then = new Date(value).getTime()
  const diff = Date.now() - then
  const future = diff < 0
  const abs = Math.abs(diff)

  // Past a week the answer is a date, not a distance. "Aug 31" is already
  // absolute, so it must not collect an "ago" or an "in".
  if (abs >= 7 * DAY) {
    return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }

  let text
  if (abs < MIN) text = 'just now'
  else if (abs < HOUR) text = `${Math.round(abs / MIN)} min`
  else if (abs < DAY) text = `${Math.round(abs / HOUR)} h`
  else text = `${Math.round(abs / DAY)} d`

  if (text === 'just now') return text
  return future ? `in ${text}` : `${text} ago`
}

export function dateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Message bubbles carry only the clock time; the day is in the thread row. */
export const timeOnly = (value) =>
  value ? new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''

export function spotsLabel(task) {
  if (task.type === 'EVENT') return `${task.spotsLeft} seats left`
  if (task.spotsLeft === 0) return 'Full'
  const applied = task.takenCount
  const s = `${task.spotsLeft} spot${task.spotsLeft === 1 ? '' : 's'}`
  return applied ? `${s} · ${applied} taken` : s
}

export const STATUS_LABEL = {
  APPLIED: 'Applied',
  ACCEPTED: 'Accepted',
  REJECTED: 'Declined',
  IN_PROGRESS: 'In progress',
  PENDING_CONFIRMATION: 'Waiting on poster',
  COMPLETED: 'Completed',
  WITHDRAWN: 'Withdrawn',
}

/* ------------------------------------------------------------ coordinates */

/** Where the manual-coordinate forms start when the device gives no position. */
export const CAMPUS_DEFAULT = { lat: 13.6146, lng: 100.7121 }

/** Five decimal places is about a metre, which is the useful limit on campus. */
export const formatCoords = (lat, lng) => `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`

/**
 * Shared by the create form and the emergency fallback, so both refuse the
 * same values and say the same thing about why.
 */
export function validateCoords(lat, lng) {
  const bothBlank = lat === '' && lng === ''
  if (bothBlank) return null
  const a = Number.parseFloat(lat)
  const b = Number.parseFloat(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return 'Enter both latitude and longitude as numbers, or leave both empty.'
  }
  if (a < -90 || a > 90) return 'Latitude must be between -90 and 90.'
  if (b < -180 || b > 180) return 'Longitude must be between -180 and 180.'
  return null
}

/**
 * Whether a posting has anything worth drawing on a map. Screens use it to drop
 * the whole map card: a remote task showing an empty grid claimed a place it
 * does not have.
 */
export const hasLocation = (location) =>
  Boolean(location && (location.name || (location.lat != null && location.lng != null)))
