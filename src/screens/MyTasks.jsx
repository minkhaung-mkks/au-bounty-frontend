import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { useToast } from '../components/Toast.jsx'
import { Avatar, Empty, ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import {
  ACCEPTANCE_LABEL,
  STATUS_LABEL,
  TASK_STATUS_LABEL,
  dateTime,
  labelOf,
  relativeTime,
  rewardLabel,
} from '../lib/format.js'

export function MyTasks() {
  const navigate = useNavigate()
  const { flash, flashError } = useToast()
  const { data, error, loading, reload } = useApi(() => api.get('/me/tasks'), [])

  if (loading) return <Loading label="Loading your tasks" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const act = async (fn, message) => {
    try {
      await fn()
      flash(message)
      reload()
    } catch (err) {
      flashError(err)
    }
  }

  const { posted, taking, events, needsReview } = data
  const open = posted.filter((t) => t.status !== 'CANCELLED')
  // Only offer a review where one is actually still owed.
  const owed = new Set(needsReview.map((r) => `${r.taskId}:${r.counterpart.id}`))

  return (
    <div style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 30 }}>
      <div>
        <h1 className="display">My tasks</h1>
        <p className="page-sub">Everything you posted, everything you took, and what you still owe.</p>
      </div>

      {/* ------------------------------------------------------ owed reviews */}
      {needsReview.length ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Kicker>COMPLETED · NEEDS YOUR REVIEW</Kicker>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {needsReview.map((r) => (
              <div
                key={`${r.taskId}:${r.counterpart.id}`}
                className="card card-pad"
                style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 20 }}>
                    {r.taskTitle}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 5 }}>
                    With {r.counterpart.name} · completed {relativeTime(r.completedAt)}
                  </div>
                </div>
                <Link
                  className="btn btn-outline-red"
                  style={{ alignSelf: 'flex-start' }}
                  to={`/review/${r.taskId}/${r.counterpart.id}`}
                >
                  Leave a review
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- I posted */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Kicker>POSTED BY ME</Kicker>
        {open.length === 0 ? (
          <Empty>
            You have not posted anything yet.{' '}
            <button className="btn btn-link" onClick={() => navigate('/create')}>
              Post something
            </button>
          </Empty>
        ) : null}

        {open.map((task) => {
          const applicants = task.assignments.filter((a) =>
            ['APPLIED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_CONFIRMATION', 'COMPLETED'].includes(a.status),
          )
          return (
            <div key={task.id} className="card" style={{ padding: 28 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <Link
                    to={task.type === 'EVENT' ? `/events/${task.id}` : `/tasks/${task.id}`}
                    style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 21, color: 'var(--ink)' }}
                  >
                    {task.title}
                  </Link>
                  <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 5 }}>
                    {labelOf(ACCEPTANCE_LABEL, task.acceptanceMode)} ·{' '}
                    {task.maxTakers} {task.type === 'EVENT' ? 'seats' : 'spots'} · reward:{' '}
                    {rewardLabel(task.reward)} · posted {relativeTime(task.createdAt)}
                  </div>
                </div>
                <span className="chip">{labelOf(TASK_STATUS_LABEL, task.status)}</span>
              </div>

              {applicants.length ? (
                <div className="divider" style={{ marginTop: 22, paddingTop: 8 }}>
                  {applicants.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 0',
                        borderBottom: '1px solid var(--line-3)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Avatar name={a.taker.name} />
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                          <Link to={`/u/${a.taker.id}`}>{a.taker.name}</Link>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 2 }}>
                          {a.taker.role} · applied {relativeTime(a.appliedAt)}
                        </div>
                      </div>

                      {a.status === 'APPLIED' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => act(() => api.post(`/assignments/${a.id}/reject`), 'Declined.')}
                          >
                            Decline
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: 12.5 }}
                            onClick={() => act(() => api.post(`/assignments/${a.id}/accept`), `${a.taker.name} accepted.`)}
                          >
                            Accept
                          </button>
                        </div>
                      ) : a.status === 'PENDING_CONFIRMATION' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>
                            Marked done {relativeTime(a.completionRequestedAt)} · auto-confirms in 7 days
                          </span>
                          <button
                            className="btn btn-dark btn-sm"
                            onClick={() => act(() => api.post(`/assignments/${a.id}/confirm`), 'Completion confirmed.')}
                          >
                            Confirm
                          </button>
                        </div>
                      ) : (
                        <span className="chip">{labelOf(STATUS_LABEL, a.status)}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 18, fontSize: 13, color: 'var(--muted-2)' }}>
                  Nobody has applied yet.
                </div>
              )}
            </div>
          )
        })}
      </section>

      {/* --------------------------------------------------------- I'm helping */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Kicker>I'M HELPING WITH</Kicker>
        {taking.length === 0 ? <Empty>You have not taken any task yet.</Empty> : null}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {taking.map(({ assignment, task }) => (
            <div
              key={assignment.id}
              className="panel-dark"
              style={{ flex: '1 1 420px', padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div>
                <Kicker gold>{labelOf(STATUS_LABEL, assignment.status).toUpperCase()}</Kicker>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 21, marginTop: 8 }}>
                  <Link to={`/tasks/${task.id}`} style={{ color: '#fff' }}>
                    {task.title}
                  </Link>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted-3)', marginTop: 5 }}>
                  {rewardLabel(task.reward)} · posted by {task.poster.name}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 'auto', flexWrap: 'wrap' }}>
                {['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status) ? (
                  <button
                    className="btn btn-bone"
                    style={{ flex: 1 }}
                    onClick={() =>
                      act(
                        () => api.post(`/assignments/${assignment.id}/complete`),
                        'Marked done. The poster has 7 days before it auto-confirms.',
                      )
                    }
                  >
                    Mark work done
                  </button>
                ) : null}
                {assignment.status === 'PENDING_CONFIRMATION' ? (
                  <div className="plate-gold" style={{ flex: 1 }}>
                    Waiting on the poster · auto-confirms in 7 days
                  </div>
                ) : null}
                {assignment.status === 'APPLIED' ? (
                  <div className="plate-quiet" style={{ flex: 1 }}>
                    Awaiting the poster&rsquo;s approval
                  </div>
                ) : null}
                {assignment.status === 'COMPLETED' ? (
                  owed.has(`${task.id}:${task.poster.id}`) ? (
                    <Link className="btn btn-bone" style={{ flex: 1 }} to={`/review/${task.id}/${task.poster.id}`}>
                      Leave a review
                    </Link>
                  ) : (
                    <div className="plate-quiet" style={{ flex: 1 }}>
                      Reviewed
                    </div>
                  )
                ) : null}
                <Link
                  className="btn"
                  style={{ background: 'var(--ink-3)', padding: '14px 17px' }}
                  to="/messages"
                  aria-label={`Message about ${task.title}`}
                  title="Open messages"
                >
                  <Icon name="chat" size={20} color="#fff" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- events */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Kicker>EVENTS I RESERVED</Kicker>
        {events.length === 0 ? <Empty>No seats reserved.</Empty> : null}
        {events.map(({ assignment, task }) => (
          <Link
            key={assignment.id}
            to={`/check-in?event=${task.id}&mode=attendee`}
            className="card"
            style={{
              borderLeft: '3px solid var(--gold)',
              padding: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              color: 'inherit',
              flexWrap: 'wrap',
            }}
          >
            <Icon name="qr_code_2" size={26} color="var(--gold)" />
            <span style={{ flex: 1, minWidth: 200 }}>
              <span style={{ display: 'block', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18 }}>
                {task.title}
              </span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--muted-2)', marginTop: 3 }}>
                {task.startsAt ? dateTime(task.startsAt) : 'Date to be announced'} · {task.location.name ?? 'No location'} ·{' '}
                {rewardLabel(task.reward)}
              </span>
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Open check-in →</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
