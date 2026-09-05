import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { useToast } from '../components/Toast.jsx'
import { useSession } from '../session.jsx'
import { Empty, ErrorState, Icon, Kicker, Loading, Stat } from '../components/ui.jsx'
import { initials, relativeTime } from '../lib/format.js'

/**
 * Microsoft sign-in can create an account before it knows the student id, so
 * the id is asked for once here (the server refuses a second change) next to
 * the freely editable bio.
 */
function AboutCard({ user, onSaved }) {
  const { flash, flashError } = useToast()
  const [universityId, setUniversityId] = useState('')
  const [bio, setBio] = useState(user.bio ?? '')
  const [saving, setSaving] = useState(false)
  const idPending = !user.universityId

  const save = async () => {
    const trimmed = universityId.trim()
    if (idPending && !trimmed) return
    setSaving(true)
    try {
      await api.put('/me', idPending ? { universityId: trimmed, bio } : { bio })
      await onSaved()
      flash('Profile saved.')
    } catch (err) {
      flashError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Kicker>ABOUT YOU</Kicker>
      {idPending ? (
        <div>
          <div className="label">STUDENT ID · CAN ONLY BE SET ONCE</div>
          <input
            className="field"
            style={{ maxWidth: 260 }}
            value={universityId}
            onChange={(e) => setUniversityId(e.target.value)}
            placeholder="e.g. 6700001"
            inputMode="numeric"
          />
          <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 7 }}>
            Shown on your profile so other students know who they are dealing with. Once saved it
            cannot be changed.
          </div>
        </div>
      ) : null}
      <div>
        <div className="label">BIO</div>
        <textarea
          className="field"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A line or two about you, visible on your public profile."
        />
      </div>
      <div>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || (idPending && !universityId.trim())}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export function Profile() {
  const params = useParams()
  const { me, tags: myTags, reload: reloadSession, devAuth } = useSession()
  const { flash, flashError } = useToast()

  const userId = params.id ?? me?.id
  const isSelf = userId === me?.id

  const profile = useApi(() => api.get(`/users/${userId}`), [userId])
  const allTags = useApi(() => (isSelf ? api.get('/tags') : Promise.resolve(null)), [isSelf])
  const [editing, setEditing] = useState(false)
  const [draftTags, setDraftTags] = useState([])

  if (profile.loading) return <Loading label="Loading profile" />
  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.reload} />

  const { user, stats, reviews } = profile.data

  const startEditing = () => {
    setDraftTags(myTags.map((t) => t.id))
    setEditing(true)
  }

  const saveTags = async () => {
    try {
      await api.put('/me/tags', { tagIds: draftTags })
      await reloadSession()
      profile.reload()
      setEditing(false)
      flash('Skill tags updated. The Matches tab uses these.')
    } catch (err) {
      flashError(err)
    }
  }

  const copyLink = async () => {
    const url = `${window.location.origin}/u/${user.id}`
    try {
      await navigator.clipboard.writeText(url)
      flash('Public link copied. It opens without signing in.')
    } catch {
      flash(url)
    }
  }

  const saveAbout = async () => {
    await reloadSession()
    profile.reload()
  }

  // Dev-picker accounts are seeded complete, and older backends have no PUT
  // /me, so the card only appears for them if the id is genuinely missing.
  const showAbout = isSelf && (!devAuth || !user.universityId)

  return (
    <div style={{ maxWidth: 1080, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div
        className="panel-dark"
        style={{ padding: '40px 44px', display: 'flex', justifyContent: 'space-between', gap: 34, flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            className="avatar"
            style={{ width: 86, height: 86, fontSize: 30, background: 'var(--red)', color: '#fff' }}
          >
            {initials(user.name)}
          </div>
          <div>
            <h1 className="display" style={{ fontSize: 34 }}>
              {user.name}
            </h1>
            <div
              style={{
                fontSize: 13.5,
                color: 'var(--muted-3)',
                marginTop: 7,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <Icon name="verified" size={17} color="#7fba00" />
              {user.role}
              {user.universityId ? ` · ${user.universityId}` : ''}
              {user.orgs.length ? ` · ${user.orgs.map((o) => `${o.name} (${o.position})`).join(', ')}` : ''}
              {` · joined ${new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
            </div>
            {user.bio ? (
              <div style={{ fontSize: 13.5, color: 'var(--muted-3)', marginTop: 8, maxWidth: 520 }}>
                {user.bio}
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
              {user.tags.length ? (
                user.tags.map((t) => (
                  <span key={t.id} className="chip chip-dark">
                    {t.name}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>No skill tags yet.</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 26 }}>
            <Stat value={stats.completed} caption="Completed" />
            <Stat value={stats.rating ?? '—'} caption="Rating" color="var(--gold-light)" />
            <Stat value={stats.events} caption="Events" />
          </div>
          <button className="btn btn-outline-dark btn-sm" onClick={copyLink}>
            <Icon name="link" size={17} color="var(--gold)" />
            Copy public link — works without login
          </button>
          {isSelf && !editing ? (
            <button className="btn btn-outline-dark btn-sm" onClick={startEditing}>
              <Icon name="sell" size={17} color="var(--gold)" />
              Edit skill tags
            </button>
          ) : null}
        </div>
      </div>

      {showAbout ? <AboutCard user={user} onSaved={saveAbout} /> : null}

      {isSelf && editing && allTags.data ? (
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Kicker>YOUR SKILL TAGS</Kicker>
          <div className="seg-row">
            {allTags.data.tags.map((t) => (
              <button
                key={t.id}
                className="seg"
                aria-pressed={draftTags.includes(t.id)}
                onClick={() =>
                  setDraftTags((d) => (d.includes(t.id) ? d.filter((x) => x !== t.id) : [...d, t.id]))
                }
              >
                {t.name}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={saveTags}>
              Save tags
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="row">
        <div style={{ flex: '1 1 560px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Kicker>REVIEWS · ALL OF THEM, GOOD AND BAD</Kicker>
          {reviews.length === 0 ? (
            <Empty>
              No published reviews yet. A review stays sealed until the double-blind window closes.
            </Empty>
          ) : null}
          {reviews.map((r) => (
            <div key={r.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16 }}>
                  {r.reviewer.name}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)}
                </span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-4)' }}>
                {r.textHidden ? (
                  <em style={{ color: 'var(--muted-2)' }}>
                    Text removed by an admin. The {r.rating}★ rating still counts.
                  </em>
                ) : (
                  r.text || <em style={{ color: 'var(--muted-2)' }}>No comment left.</em>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>
                {r.task.title} · {relativeTime(r.createdAt)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ width: 320, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="note-quiet">
            Bad reviews stay up. Admins can remove abusive wording, but the rating itself always
            counts, so moderation can never inflate a score.
          </div>
          <div className="note-quiet">
            {stats.reviewCount} published review{stats.reviewCount === 1 ? '' : 's'}. Anything newer
            is still inside the double-blind window.
          </div>
        </div>
      </div>
    </div>
  )
}
