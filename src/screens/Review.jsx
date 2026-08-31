import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { useToast } from '../components/Toast.jsx'
import { Avatar, ErrorState, Icon, Loading } from '../components/ui.jsx'

const STAR_LABEL = [
  'Tap to rate',
  'Did not deliver',
  'Below what we agreed',
  'Fine',
  'Good, would ask again',
  'Went out of their way',
]

export function Review() {
  const { taskId, userId } = useParams()
  const navigate = useNavigate()
  const { flashError } = useToast()

  const [stars, setStars] = useState(0)
  const [text, setText] = useState('')
  const [sealed, setSealed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const task = useApi(() => api.get(`/tasks/${taskId}`), [taskId])
  const person = useApi(() => api.get(`/users/${userId}`), [userId])

  if (task.loading || person.loading) return <Loading label="Loading" />
  if (task.error) return <ErrorState error={task.error} onRetry={task.reload} />
  if (person.error) return <ErrorState error={person.error} onRetry={person.reload} />

  const name = person.data.user.name

  const submit = async () => {
    if (!stars) return flashError({ message: 'Pick a rating first.' })
    setSubmitting(true)
    try {
      await api.post('/reviews', { taskId, revieweeId: userId, rating: stars, text })
      setSealed(true)
    } catch (err) {
      // Landing here from a stale link is the common case, so say so plainly.
      flashError(
        err.code === 'CONFLICT'
          ? { message: `You already reviewed ${name} for this task.` }
          : err,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <h1 className="display">Leave a review</h1>

      {sealed ? (
        <div
          className="card"
          style={{
            padding: 56,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            animation: 'fadeUp .3s ease both',
          }}
        >
          <div
            className="avatar"
            style={{ width: 78, height: 78 }}
          >
            <Icon name="lock_clock" size={40} color="var(--red)" />
          </div>
          <div className="display" style={{ fontSize: 26 }}>
            Review sealed
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--muted)', margin: 0, maxWidth: 440 }}>
            It publishes 1 day after {name} submits theirs, or in 7 days if they never do. Your
            rating counts toward their record either way.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn btn-outline-red" onClick={() => navigate(`/u/${userId}`)}>
              See their profile
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/my-tasks')}>
              Back to my tasks
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 34, display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <Avatar name={name} size={54} />
            <div>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 20 }}>{name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 2 }}>
                {task.data.task.title} · completed
              </div>
            </div>
          </div>

          <div>
            <div className="label">RATING</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n)}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex' }}
                >
                  <Icon name="star" size={46} color={n <= stars ? 'var(--gold)' : '#ded5c8'} />
                </button>
              ))}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 10 }}>{STAR_LABEL[stars]}</div>
          </div>

          <div>
            <div className="label">WHAT HAPPENED</div>
            <textarea
              className="field"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Was the work as agreed? Was the promised reward given?"
            />
          </div>

          <div className="note">
            <strong>Double-blind.</strong> Ratings do not update until 1 day after both sides submit,
            or 7 days after only one side has. Nobody can rate you back out of spite.
          </div>

          <button
            className="btn btn-primary"
            style={{ alignSelf: 'flex-start' }}
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? 'Sending…' : 'Submit review'}
          </button>
        </div>
      )}
    </div>
  )
}
