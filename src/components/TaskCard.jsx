import { useNavigate } from 'react-router-dom'
import { ACCENT_CLASS, TYPE_CLASS, relativeTime, rewardLabel, spotsLabel } from '../lib/format.js'
import { Icon } from './ui.jsx'

export function TaskCard({ task }) {
  const navigate = useNavigate()
  const to = task.type === 'EVENT' ? `/events/${task.id}` : `/tasks/${task.id}`
  const snippet = task.content.length > 96 ? `${task.content.slice(0, 96)}…` : task.content

  return (
    <button className={`task-card ${ACCENT_CLASS[task.type]}`} onClick={() => navigate(to)}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span className={`chip chip-type ${TYPE_CLASS[task.type]}`}>{task.type}</span>
        <span className="chip chip-reward">{rewardLabel(task.reward)}</span>
        {task.isMine ? <span className="chip">YOUR POST</span> : null}
        {task.matchScore ? (
          <span className="chip chip-skill">
            {task.matchScore} tag{task.matchScore === 1 ? '' : 's'} match
          </span>
        ) : null}
      </span>

      <h3>{task.title}</h3>
      <p>{snippet}</p>

      <span className="task-meta">
        <span className="meta-item">
          <Icon name="location_on" />
          {task.location.name}
        </span>
        <span className="meta-item">
          <Icon name="schedule" />
          {task.type === 'EVENT' && task.startsAt
            ? relativeTime(task.startsAt)
            : relativeTime(task.createdAt)}
        </span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--red)' }}>
          {spotsLabel(task)}
        </span>
      </span>
    </button>
  )
}
