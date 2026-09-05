import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { useToast } from '../components/Toast.jsx'
import { useSession } from '../session.jsx'
import { Avatar, ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import { STATUS_LABEL, TYPE_CLASS, dateTime, relativeTime, rewardLabel, spotsLabel } from '../lib/format.js'
import { subscribe, unsubscribe, useSocketEvent } from '../lib/socket.js'

export function TaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { flash, flashError } = useToast()
  const { me } = useSession()
  const { data, error, loading, reload } = useApi(() => api.get(`/tasks/${id}`), [id])

  // Live status/occupancy from the task room, patched onto the loaded row.
  const [live, setLive] = useState(null)
  const lastStatusRef = useRef(null)

  useEffect(() => {
    setLive(null)
    lastStatusRef.current = null
    subscribe({ taskId: id })
    return () => unsubscribe({ taskId: id })
  }, [id])

  useSocketEvent('task:updated', (payload) => {
    if (!payload || payload.taskId !== id) return
    const prev = lastStatusRef.current
    if (payload.status) lastStatusRef.current = payload.status
    setLive((current) => ({ ...current, ...payload }))
    if (payload.status && prev && prev !== payload.status) {
      flash(`Status is now ${STATUS_LABEL[payload.status] ?? payload.status.toLowerCase()}`)
    }
  })

  const task = data ? { ...data.task, ...live } : null
  // Once the row is loaded, the socket's next different status is a transition.
  useEffect(() => {
    if (data?.task && !live) lastStatusRef.current = data.task.status
  }, [data, live])

  if (loading) return <Loading label="Loading task" />
  if (error) return <ErrorState error={error} onRetry={reload} />
  // Events have their own screen: seats and check-in instead of apply and review.
  if (task.type === 'EVENT') return <Navigate to={`/events/${task.id}`} replace />

  const act = async (fn, message) => {
    try {
      await fn()
      flash(message)
      setLive(null)
      reload()
    } catch (err) {
      flashError(err)
    }
  }

  const mine = task.myAssignment
  const applicants = task.assignments ?? []

  return (
    <div style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <button className="btn btn-link" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/')}>
        <Icon name="arrow_back" size={17} />
        Back to board
      </button>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <span className={`chip chip-type ${TYPE_CLASS[task.type]}`}>{task.type}</span>
              {task.tags.map((t) => (
                <span key={t.id} className="chip">
                  {t.name.toUpperCase()}
                </span>
              ))}
              <span className="chip chip-reward">
                {task.acceptanceMode === 'AUTO' ? 'FIRST COME' : 'APPLY & APPROVE'}
              </span>
              {task.status !== 'OPEN' ? <span className="chip">{task.status}</span> : null}
            </div>

            <h1 className="display" style={{ fontSize: 38, lineHeight: 1.1, margin: '16px 0 0' }}>
              {task.title}
            </h1>
            <p
              style={{
                fontSize: 15.5,
                lineHeight: 1.65,
                color: 'var(--ink-4)',
                margin: '16px 0 0',
                maxWidth: 640,
                textWrap: 'pretty',
              }}
            >
              {task.content}
            </p>

            <div
              className="divider"
              style={{
                display: 'flex',
                gap: 26,
                marginTop: 24,
                paddingTop: 20,
                fontSize: 13,
                color: 'var(--muted)',
                flexWrap: 'wrap',
              }}
            >
              <span className="meta-item">
                <Icon name="schedule" size={18} color="var(--red)" />
                Posted {relativeTime(task.createdAt)}
              </span>
              {task.deadline ? (
                <span className="meta-item">
                  <Icon name="event_busy" size={18} color="var(--red)" />
                  Deadline {dateTime(task.deadline)}
                </span>
              ) : null}
              <span className="meta-item">
                <Icon name="group" size={18} color="var(--red)" />
                {spotsLabel(task)}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="map-fake">
              <Icon name="location_on" size={46} color="var(--red)" />
              <span className="tag">Placeholder map · Google Geocoding not wired in v0.5</span>
            </div>
            <div
              style={{
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16 }}>
                  {task.location.name}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 3 }}>
                  {task.location.lat != null
                    ? `${task.location.lat}, ${task.location.lng}`
                    : 'No coordinates stored yet'}
                </div>
              </div>
            </div>
          </div>

          {task.isMine && applicants.length ? (
            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Kicker>APPLICANTS</Kicker>
              {applicants.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 0',
                    borderBottom: '1px solid var(--line-3)',
                  }}
                >
                  <Avatar name={a.taker.name} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                      <Link to={`/u/${a.taker.id}`}>{a.taker.name}</Link>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 2 }}>
                      Applied {relativeTime(a.appliedAt)}
                    </div>
                  </div>
                  {a.status === 'APPLIED' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() =>
                          act(() => api.post(`/assignments/${a.id}/reject`), 'Application declined.')
                        }
                      >
                        Decline
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 12.5 }}
                        onClick={() =>
                          act(
                            () => api.post(`/assignments/${a.id}/accept`),
                            'Accepted. A private thread opens for this assignment once messaging is wired.',
                          )
                        }
                      >
                        Accept
                      </button>
                    </div>
                  ) : a.status === 'PENDING_CONFIRMATION' ? (
                    <button
                      className="btn btn-dark btn-sm"
                      onClick={() =>
                        act(() => api.post(`/assignments/${a.id}/confirm`), 'Completion confirmed.')
                      }
                    >
                      Confirm completion
                    </button>
                  ) : (
                    <span className="chip">{STATUS_LABEL[a.status]}</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ width: 352, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel-dark" style={{ padding: 26 }}>
            <Kicker gold>REWARD</Kicker>
            <div
              style={{
                fontFamily: 'var(--display)',
                fontWeight: 800,
                fontSize: 34,
                letterSpacing: '-0.02em',
                marginTop: 6,
              }}
            >
              {rewardLabel(task.reward)}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 6, lineHeight: 1.5 }}>
              We record what was promised. The exchange happens between you two. No payments run
              through AU Bounty.
            </div>

            {task.isMine ? (
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div
                  style={{
                    border: '1px solid var(--gold)',
                    padding: 14,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--gold-light)',
                  }}
                >
                  Your post
                </div>
                {task.status !== 'CANCELLED' && task.status !== 'COMPLETED' ? (
                  <button
                    className="btn btn-outline-dark btn-block"
                    onClick={() =>
                      act(() => api.post(`/tasks/${task.id}/cancel`), 'Post cancelled.')
                    }
                  >
                    Cancel this post
                  </button>
                ) : null}
              </div>
            ) : !mine || mine.status === 'WITHDRAWN' || mine.status === 'REJECTED' ? (
              <button
                className="btn btn-primary btn-block"
                style={{ marginTop: 20 }}
                disabled={task.status !== 'OPEN'}
                onClick={() =>
                  act(
                    () => api.post(`/tasks/${task.id}/apply`),
                    task.acceptanceMode === 'AUTO'
                      ? 'You are on the task.'
                      : 'Application sent. The poster approves or declines.',
                  )
                }
              >
                {task.status !== 'OPEN'
                  ? `Closed · ${task.status}`
                  : task.acceptanceMode === 'AUTO'
                    ? 'Take this task'
                    : 'Apply to help'}
              </button>
            ) : (
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div
                  style={{
                    border: '1px solid var(--gold)',
                    padding: 14,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--gold-light)',
                  }}
                >
                  {STATUS_LABEL[mine.status]}
                </div>
                {['ACCEPTED', 'IN_PROGRESS'].includes(mine.status) ? (
                  <button
                    className="btn btn-bone btn-block"
                    onClick={() =>
                      act(
                        () => api.post(`/assignments/${mine.id}/complete`),
                        'Marked done. The poster has 7 days before it auto-confirms.',
                      )
                    }
                  >
                    Mark work done
                  </button>
                ) : null}
                {['APPLIED', 'ACCEPTED', 'IN_PROGRESS'].includes(mine.status) ? (
                  <button
                    className="btn btn-outline-dark btn-block"
                    onClick={() => act(() => api.post(`/assignments/${mine.id}/withdraw`), 'Withdrawn.')}
                  >
                    Withdraw
                  </button>
                ) : null}
                {mine.status === 'COMPLETED' ? (
                  <Link className="btn btn-bone btn-block" to={`/review/${task.id}/${task.poster.id}`}>
                    Leave a review
                  </Link>
                ) : null}
              </div>
            )}
          </div>

          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Kicker>POSTED BY</Kicker>
            <Link
              to={`/u/${task.poster.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 13, color: 'inherit' }}
            >
              <Avatar name={task.poster.name} size={46} />
              <span>
                <span style={{ display: 'block', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15.5 }}>
                  {task.poster.name}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted-2)', marginTop: 2 }}>
                  {task.poster.role}
                  {task.poster.universityId ? ` · ${task.poster.universityId}` : ''}
                </span>
              </span>
            </Link>
            <div
              className="divider"
              style={{ paddingTop: 14, fontSize: 12.5, lineHeight: 1.6, color: 'var(--muted)' }}
            >
              If the poster never confirms your work, completion goes through automatically after 7
              days.
            </div>
          </div>

          {me?.role === 'ADMIN' && !task.isMine ? (
            <div className="note-quiet">
              You are an admin, so the API lets you moderate this post as if it were yours.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
