import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocketEvent } from '../lib/socket.js'
import { Icon } from './ui.jsx'
import { relativeTime } from '../lib/format.js'

/** Three banners cover a screen; more than that is noise on top of an emergency. */
const MAX_VISIBLE = 3

/**
 * Live emergency broadcasts from the global emergencies room. Events queue and
 * stack (newest on top) until each is dismissed; nothing auto-dismisses, and
 * the stack is position:fixed so the layout underneath never shifts. Only the
 * newest MAX_VISIBLE show; older ones wait in the queue behind a "+N more"
 * hint and move up as banners are dismissed.
 */
export function EmergencyBanner() {
  const [queue, setQueue] = useState([])
  const navigate = useNavigate()

  useSocketEvent('emergency:new', (alert) => {
    if (!alert?.taskId && !alert?.title) return
    setQueue((q) => [{ ...alert, key: `${alert.taskId}-${alert.createdAt ?? Date.now()}` }, ...q])
  })

  if (!queue.length) return null
  const dismiss = (key) => setQueue((q) => q.filter((b) => b.key !== key))
  const visible = queue.slice(0, MAX_VISIBLE)
  const hidden = queue.length - visible.length

  return (
    <div className="emergency-stack" role="alert">
      {visible.map((b) => (
        <div key={b.key} className="emergency-banner">
          <Icon name="emergency" size={22} color="#fff" />
          <span className="eb-kicker">EMERGENCY</span>
          <span className="eb-title">{b.title || 'New emergency task'}</span>
          <span className="eb-meta">
            {b.locationName ? `${b.locationName} · ` : ''}
            {relativeTime(b.createdAt)}
          </span>
          <span className="eb-actions">
            {b.taskId ? (
              <button
                className="btn eb-btn"
                onClick={() => {
                  dismiss(b.key)
                  navigate(`/tasks/${b.taskId}`)
                }}
              >
                View task
              </button>
            ) : null}
            <button
              className="btn eb-btn"
              onClick={() => {
                dismiss(b.key)
                navigate('/emergency')
              }}
            >
              All emergencies
            </button>
          </span>
          <button className="btn eb-close" aria-label="Dismiss emergency alert" onClick={() => dismiss(b.key)}>
            <Icon name="close" size={18} color="#fff" />
          </button>
        </div>
      ))}
      {hidden > 0 ? (
        <div className="emergency-banner eb-more" role="status">
          <span className="eb-kicker">+{hidden} MORE</span>
          <span className="eb-meta">Older emergency alerts are hidden while these {MAX_VISIBLE} are open.</span>
        </div>
      ) : null}
    </div>
  )
}
