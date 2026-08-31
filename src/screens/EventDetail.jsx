import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { useToast } from '../components/Toast.jsx'
import { ErrorState, Icon, Loading } from '../components/ui.jsx'
import { dateTime, rewardLabel } from '../lib/format.js'

export function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { flash, flashError } = useToast()
  const { data, error, loading, reload } = useApi(() => api.get(`/tasks/${id}`), [id])

  if (loading) return <Loading label="Loading event" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const task = data.task
  const reserved = task.takenCount
  const pct = Math.min(100, Math.round((reserved / task.maxTakers) * 100))
  const mine = task.myAssignment
  const going = mine && !['WITHDRAWN', 'REJECTED'].includes(mine.status)

  const rsvp = async () => {
    try {
      await api.post(`/tasks/${task.id}/apply`)
      flash('Seat reserved. Check in with the rotating code at the door.')
      reload()
    } catch (err) {
      flashError(err)
    }
  }

  const cancelSeat = async () => {
    try {
      await api.post(`/assignments/${mine.id}/withdraw`)
      flash('Seat released.')
      reload()
    } catch (err) {
      flashError(err)
    }
  }

  return (
    <div style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <button className="btn btn-link" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/')}>
        <Icon name="arrow_back" size={17} />
        Back to board
      </button>

      <div
        className="panel-dark"
        style={{ padding: '40px 44px', display: 'flex', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}
      >
        <div style={{ maxWidth: 620 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span
              className="chip"
              style={{ background: 'var(--gold-light)', color: 'var(--ink)', fontWeight: 800, letterSpacing: '0.1em' }}
            >
              {rewardLabel(task.reward).toUpperCase()}
            </span>
            {task.org ? <span className="chip chip-dark">{task.org.name}</span> : null}
            {!task.org ? <span className="chip chip-dark">{task.poster.name}</span> : null}
          </div>

          <h1 className="display" style={{ fontSize: 42, lineHeight: 1.06, margin: '18px 0 0' }}>
            {task.title}
          </h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, color: 'var(--muted-3)', margin: '16px 0 0' }}>
            {task.content}
          </p>

          <div style={{ display: 'flex', gap: 26, marginTop: 22, fontSize: 13.5, color: '#e7dfd4', flexWrap: 'wrap' }}>
            <span className="meta-item">
              <Icon name="event" size={18} color="var(--gold)" />
              {task.startsAt ? dateTime(task.startsAt) : 'Date to be announced'}
            </span>
            <span className="meta-item">
              <Icon name="location_on" size={18} color="var(--gold)" />
              {task.location.name}
            </span>
            <span className="meta-item">
              <Icon name="qr_code_2" size={18} color="var(--gold)" />
              QR-verified attendance
            </span>
          </div>

          <div style={{ marginTop: 20, fontSize: 12.5, color: 'var(--muted-2)' }}>
            Posted by <Link to={`/u/${task.poster.id}`}>{task.poster.name}</Link> · {task.poster.role}
          </div>
        </div>

        <div style={{ width: 300, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--ink-2)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted-3)' }}>
              <span>Seats reserved</span>
              <span>
                <strong style={{ color: '#fff' }}>{reserved}</strong> / {task.maxTakers}
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--ink-4)', marginTop: 12, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)' }} />
            </div>
          </div>

          {task.isMine ? (
            <div
              style={{
                border: '1px solid var(--gold)',
                padding: 15,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--gold-light)',
              }}
            >
              You are the organizer
            </div>
          ) : going ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <Link className="btn btn-bone btn-block" to="/check-in">
                <Icon name="qr_code_2" size={19} color="var(--red)" />
                Open check-in
              </Link>
              <button className="btn btn-outline-dark btn-block" onClick={cancelSeat}>
                Release my seat
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-block" disabled={task.status !== 'OPEN'} onClick={rsvp}>
              {task.status === 'OPEN' ? 'Reserve a seat' : `Closed · ${task.status}`}
            </button>
          )}

          <button className="btn btn-outline-dark btn-block" disabled title="Not wired in v0.5">
            Add to calendar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div
          className="card"
          style={{ flex: '1 1 380px', padding: 24, display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <Icon name="picture_as_pdf" size={26} color="var(--red)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15 }}>
              event-poster.pdf
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 2 }}>
              Placeholder. File attachments need the S3 bucket, which is not wired in v0.5.
            </div>
          </div>
          <Icon name="download" size={21} color="var(--muted-4)" />
        </div>
        <div className="note" style={{ flex: '1 1 380px', padding: 24, fontSize: 14 }}>
          Events skip reviews. Attendance verification is the only check. Rating 200 keynote
          attendees one by one would be meaningless.
        </div>
      </div>
    </div>
  )
}
