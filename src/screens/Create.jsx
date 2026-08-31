import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { useToast } from '../components/Toast.jsx'
import { canOfferExtraCredit, canPostEvent, useSession } from '../session.jsx'
import { ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import { TYPE_CLASS } from '../lib/format.js'

const TYPES = ['REQUEST', 'EVENT', 'EMERGENCY']
const REWARDS = ['NONE', 'CASH', 'EXTRA_CREDIT', 'OTHER']

const TYPE_NOTE = {
  REQUEST: 'Takers apply, you approve, then both sides review each other afterwards.',
  EVENT: 'Seats and check-in at the door. Events skip reviews.',
  EMERGENCY: 'Shown with a red accent and its own page. Realtime push lands with websockets.',
}

const REWARD_NOTE = {
  NONE: 'No reward. Plenty of small tasks get taken anyway.',
  CASH: 'We record the amount. You two settle it in person, no payments run through us.',
  EXTRA_CREDIT: 'Verified on AU Bounty. Entering it in the grade book is still the teacher’s job.',
  OTHER: 'Described in words and recorded with the task.',
}

export function Create() {
  const navigate = useNavigate()
  const { flash, flashError } = useToast()
  const { me, orgs } = useSession()
  const tagsReq = useApi(() => api.get('/tags'), [])

  const [form, setForm] = useState({
    type: 'REQUEST',
    title: '',
    content: '',
    rewardType: 'NONE',
    rewardDescription: '',
    maxTakers: 1,
    acceptanceMode: 'APPROVAL',
    locationName: '',
    orgId: '',
    startsAt: '',
    deadline: '',
  })
  const [tagIds, setTagIds] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const mayEvent = canPostEvent(me, orgs)
  const mayCredit = canOfferExtraCredit(me)

  const toggleTag = (id) => {
    setTagIds((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id)
      if (current.length >= 3) {
        flash('Three tags maximum. A fixed, short list is the whole point.', 'error')
        return current
      }
      return [...current, id]
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const body = {
        title: form.title,
        content: form.content,
        type: form.type,
        rewardType: form.rewardType,
        rewardDescription: form.rewardDescription,
        maxTakers: Number(form.maxTakers) || 1,
        acceptanceMode: form.type === 'EVENT' ? 'AUTO' : form.acceptanceMode,
        locationName: form.locationName,
        tagIds,
      }
      if (form.orgId) body.orgId = form.orgId
      if (form.startsAt) body.startsAt = new Date(form.startsAt).toISOString()
      if (form.deadline) body.deadline = new Date(form.deadline).toISOString()

      const { task } = await api.post('/tasks', body)
      flash('Posted. Students whose profile tags match see it first.')
      navigate(task.type === 'EVENT' ? `/events/${task.id}` : `/tasks/${task.id}`)
    } catch (err) {
      flashError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (tagsReq.loading) return <Loading label="Loading tags" />
  if (tagsReq.error) return <ErrorState error={tagsReq.error} onRetry={tagsReq.reload} />

  const allTags = tagsReq.data.tags
  const picked = allTags.filter((t) => tagIds.includes(t.id))

  return (
    <form onSubmit={submit} style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 className="display">New post</h1>
        <p className="page-sub">
          Your role decides what you can post. Tags come from a fixed list so "Thai" never splits
          into three tags that never match.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div
          className="card"
          style={{ flex: '1 1 460px', minWidth: 0, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          <div>
            <div className="label">TYPE</div>
            <div style={{ display: 'flex', gap: 9 }}>
              {TYPES.map((t) => {
                const locked = t === 'EVENT' && !mayEvent
                return (
                  <button
                    key={t}
                    type="button"
                    className="seg"
                    style={{ flex: 1, padding: 14 }}
                    aria-pressed={form.type === t}
                    onClick={() =>
                      locked
                        ? flash('Only org members, teachers and admins can post events.', 'error')
                        : set({ type: t })
                    }
                  >
                    {t}
                    {locked ? ' · locked' : ''}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
              {TYPE_NOTE[form.type]}
            </div>
          </div>

          <div>
            <div className="label">TITLE</div>
            <input
              className="field"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="What do you need?"
              style={{ fontWeight: 600, fontSize: 14.5 }}
              required
            />
          </div>

          <div>
            <div className="label">DETAILS</div>
            <textarea
              className="field"
              rows={4}
              value={form.content}
              onChange={(e) => set({ content: e.target.value })}
              placeholder="What exactly is needed, when, and for how long?"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <div className="label">REWARD</div>
              <div className="seg-row">
                {REWARDS.map((r) => {
                  const locked = r === 'EXTRA_CREDIT' && !mayCredit
                  return (
                    <button
                      key={r}
                      type="button"
                      className="seg"
                      aria-pressed={form.rewardType === r}
                      onClick={() =>
                        locked
                          ? flash('Extra-credit rewards are teacher-only.', 'error')
                          : set({ rewardType: r })
                      }
                    >
                      {r.replace('_', ' ')}
                      {locked ? ' · locked' : ''}
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 9, lineHeight: 1.5 }}>
                {REWARD_NOTE[form.rewardType]}
              </div>
            </div>
            <div style={{ width: 190 }}>
              <div className="label">REWARD DETAIL</div>
              <input
                className="field"
                value={form.rewardDescription}
                onChange={(e) => set({ rewardDescription: e.target.value })}
                placeholder={form.rewardType === 'CASH' ? '200 THB' : 'Describe it'}
                disabled={form.rewardType === 'NONE'}
                required={form.rewardType !== 'NONE'}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <div className="label">{form.type === 'EVENT' ? 'SEATS' : 'SPOTS'}</div>
              <input
                className="field"
                type="number"
                min="1"
                max="1000"
                value={form.maxTakers}
                onChange={(e) => set({ maxTakers: e.target.value })}
              />
            </div>
            {form.type !== 'EVENT' ? (
              <div style={{ flex: '1 1 260px' }}>
                <div className="label">WHO GETS IN</div>
                <div className="seg-row">
                  {['APPROVAL', 'AUTO'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="seg"
                      aria-pressed={form.acceptanceMode === m}
                      onClick={() => set({ acceptanceMode: m })}
                    >
                      {m === 'AUTO' ? 'First come' : 'Apply & approve'}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px' }}>
              <div className="label">{form.type === 'EVENT' ? 'STARTS AT' : 'DEADLINE'}</div>
              <input
                className="field"
                type="datetime-local"
                value={form.type === 'EVENT' ? form.startsAt : form.deadline}
                onChange={(e) =>
                  set(form.type === 'EVENT' ? { startsAt: e.target.value } : { deadline: e.target.value })
                }
              />
            </div>
            {form.type === 'EVENT' && orgs.length > 1 ? (
              <div style={{ flex: '1 1 260px' }}>
                <div className="label">ON BEHALF OF</div>
                <select
                  className="field"
                  value={form.orgId}
                  onChange={(e) => set({ orgId: e.target.value })}
                >
                  <option value="">Pick an organization</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div>
            <div className="label">TAGS · {tagIds.length} OF 3</div>
            <div className="seg-row">
              {allTags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="seg"
                  aria-pressed={tagIds.includes(t.id)}
                  onClick={() => toggleTag(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label">LOCATION</div>
            <input
              className="field"
              value={form.locationName}
              onChange={(e) => set({ locationName: e.target.value })}
              placeholder="Building, room, landmark"
              required
            />
            <div
              className="map-fake"
              style={{ height: 150, marginTop: 10, border: '1px solid var(--line)' }}
            >
              <Icon name="add_location_alt" size={38} color="var(--red)" />
              <span className="tag">Typed in for now · geocoding lands with the Maps key</span>
            </div>
          </div>

          <div className="divider" style={{ display: 'flex', gap: 11, paddingTop: 22 }}>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Posting…' : 'Post to board'}
            </button>
            <button className="btn btn-outline" type="button" onClick={() => navigate('/')}>
              Cancel
            </button>
          </div>
        </div>

        <div style={{ width: 352, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Kicker>LIVE PREVIEW</Kicker>
          <div className="task-card" style={{ cursor: 'default' }}>
            <span style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <span className={`chip chip-type ${TYPE_CLASS[form.type]}`}>{form.type}</span>
              <span className="chip chip-reward">
                {form.rewardType === 'NONE' ? 'No reward' : form.rewardDescription || form.rewardType}
              </span>
            </span>
            <h3>{form.title || 'Your title appears here'}</h3>
            <p>{form.content || 'And the details go here.'}</p>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {picked.map((t) => (
                <span key={t.id} className="chip">
                  {t.name}
                </span>
              ))}
            </span>
            <span className="task-meta">
              <span className="meta-item">
                <Icon name="location_on" />
                {form.locationName || 'Location'}
              </span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--red)' }}>
                {form.maxTakers}{' '}
                {form.type === 'EVENT'
                  ? Number(form.maxTakers) === 1
                    ? 'seat'
                    : 'seats'
                  : Number(form.maxTakers) === 1
                    ? 'spot'
                    : 'spots'}
              </span>
            </span>
          </div>
          <div className="note-quiet">
            Students whose profile tags overlap with these see the card ranked first on their
            Matches tab.
          </div>
        </div>
      </div>
    </form>
  )
}
