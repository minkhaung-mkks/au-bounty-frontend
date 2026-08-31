export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

export function rewardLabel(reward) {
  if (!reward || reward.type === 'NONE') return 'No reward'
  return reward.description || reward.type.replace('_', ' ').toLowerCase()
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

  let text
  if (abs < MIN) text = 'just now'
  else if (abs < HOUR) text = `${Math.round(abs / MIN)} min`
  else if (abs < DAY) text = `${Math.round(abs / HOUR)} h`
  else if (abs < 7 * DAY) text = `${Math.round(abs / DAY)} d`
  else text = new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

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
