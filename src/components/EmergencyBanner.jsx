import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocketEvent } from '../lib/socket.js'
import { Icon } from './ui.jsx'
import { relativeTime } from '../lib/format.js'

/**
 * Live emergency broadcasts from the global emergencies room. Events queue and
 * stack (newest on top) until each is dismissed; nothing auto-dismisses, and
 * the stack is position:fixed so the layout underneath never shifts.
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

  return (
    <div className="emergency-stack" role="alert">
      {queue.map((b) => (
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
    </div>
  )
}
