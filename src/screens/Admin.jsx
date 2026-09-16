import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useApi, useDebounced } from '../lib/useApi.js'
import { useSession } from '../session.jsx'
import { useToast } from '../components/Toast.jsx'
import { Avatar, Empty, ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import { ROLE_LABEL, TAG_CATEGORY_LABEL, labelOf, relativeTime } from '../lib/format.js'

const TABS = [
  { key: 'people', label: 'People & roles' },
  { key: 'orgs', label: 'Organizations' },
  { key: 'reviews', label: 'Reviews' },
]

const ROLES = ['STUDENT', 'TEACHER', 'ADMIN']

const joined = (value) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

/** Inline second look for the moves that should never happen on one click. */
function Confirm({ message, confirmLabel = 'Confirm', tone = 'dark', busy = false, onConfirm, onCancel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, color: 'var(--muted)', flex: '1 1 200px' }}>{message}</span>
      <button
        className={`btn btn-sm ${tone === 'red' ? 'btn-primary' : 'btn-dark'}`}
        disabled={busy}
        onClick={onConfirm}
      >
        {busy ? 'Working…' : confirmLabel}
      </button>
      <button className="btn btn-outline btn-sm" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

export function Admin() {
  const { me } = useSession()
  // The open tab lives in the URL, so a refresh, the back button or a pasted
  // link all land on the panel the admin was actually reading.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : TABS[0].key
  const setTab = (key) => setSearchParams({ tab: key })

  if (me.role !== 'ADMIN') {
    return (
      <div
        className="card"
        style={{
          maxWidth: 620,
          padding: 56,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Icon name="lock" size={48} color="var(--muted-2)" />
        <h1 className="display" style={{ fontSize: 34 }}>
          Admins only
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--muted)', margin: 0 }}>
          You are signed in as <strong>{labelOf(ROLE_LABEL, me.role)}</strong>. Sign in as the
          admin account to see this screen.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1240, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="display">Admin console</h1>
          <p className="page-sub">Roles, organizations and review moderation.</p>
        </div>
        <div className="seg-row">
          {TABS.map((t) => (
            <button key={t.key} className="seg" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* the panel is named after the pressed tab, so the swap is announced as
          a change of region rather than the page silently becoming something else */}
      <div role="region" aria-label={TABS.find((t) => t.key === tab).label}>
        {tab === 'people' ? <PeopleTab /> : null}
        {tab === 'orgs' ? <OrgsTab /> : null}
        {tab === 'reviews' ? <ReviewsTab /> : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ people */

function PeopleTab() {
  const { me } = useSession()
  const { flash, flashError } = useToast()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const debouncedQ = useDebounced(q, 300)

  const qs = new URLSearchParams()
  if (debouncedQ.trim()) qs.set('q', debouncedQ.trim())
  if (role) qs.set('role', role)
  const suffix = qs.size ? `?${qs.toString()}` : ''
  const { data, error, loading, reload } = useApi(() => api.get(`/admin/users${suffix}`), [suffix])

  const [pending, setPending] = useState(null) // { user, role } awaiting the admin confirm
  const [busyId, setBusyId] = useState(null)

  const apply = async (user, nextRole) => {
    setBusyId(user.id)
    try {
      await api.patch(`/admin/users/${user.id}/role`, { role: nextRole })
      flash(`${user.name} is now ${nextRole === 'ADMIN' ? 'an admin' : `a ${nextRole.toLowerCase()}`}.`)
      setPending(null)
      reload()
    } catch (err) {
      flashError(err)
    } finally {
      setBusyId(null)
    }
  }

  const request = (user, nextRole) => {
    if (nextRole === user.role) return
    // Granting admin, or taking it away, is the one change worth a second look.
    if (nextRole === 'ADMIN' || user.role === 'ADMIN') setPending({ user, role: nextRole })
    else apply(user, nextRole)
  }

  const users = data?.users ?? []

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Kicker>PEOPLE &amp; ROLES</Kicker>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <input
            className="field field-sm"
            style={{ width: 260 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, id"
            aria-label="Search users"
          />
          <select
            className="field field-sm"
            style={{ width: 160 }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {labelOf(ROLE_LABEL, r)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* only the results swap while a search or filter loads; unmounting the
          search box would steal focus out from under whoever is typing in it */}
      <div className="card">
        {loading ? <Loading label="Loading people" /> : null}
        {!loading && error ? <ErrorState error={error} onRetry={reload} /> : null}
        {!loading && !error && users.length === 0 ? (
          <Empty>Nobody matches. Service accounts never appear in this list.</Empty>
        ) : null}
        {(error ? [] : users).map((u, i) => (
          <div
            key={u.id}
            style={{ borderBottom: i < users.length - 1 ? '1px solid var(--line-3)' : undefined }}
          >
            <div style={{ padding: '15px 22px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <Avatar name={u.name} size={36} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: 'var(--display)', fontSize: 14.5, fontWeight: 700 }}>
                  <Link to={`/u/${u.id}`}>{u.name}</Link>
                  {u.id === me.id ? (
                    <span style={{ color: 'var(--muted-2)', fontWeight: 500 }}> · you</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>
                  {u.email}
                  {u.universityId ? ` · ${u.universityId}` : ''} · joined {joined(u.createdAt)}
                </div>
              </div>
              <select
                className="field field-sm"
                style={{ width: 140 }}
                value={u.role}
                disabled={u.id === me.id || busyId === u.id}
                title={u.id === me.id ? 'You cannot change your own role.' : undefined}
                onChange={(e) => request(u, e.target.value)}
                aria-label={`Role for ${u.name}`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {labelOf(ROLE_LABEL, r)}
                  </option>
                ))}
              </select>
            </div>
            {pending?.user.id === u.id ? (
              <div
                style={{
                  borderTop: '1px solid var(--line-3)',
                  background: 'var(--bone)',
                  padding: '12px 22px',
                }}
              >
                <Confirm
                  message={
                    pending.role === 'ADMIN'
                      ? `Make ${pending.user.name} an admin? They get the whole console, including role changes.`
                      : `Demote ${pending.user.name} from admin to ${pending.role.toLowerCase()}? They lose console access.`
                  }
                  confirmLabel={pending.role === 'ADMIN' ? 'Make admin' : `Make ${pending.role.toLowerCase()}`}
                  tone={pending.role === 'ADMIN' ? 'red' : 'dark'}
                  busy={busyId === u.id}
                  onConfirm={() => apply(pending.user, pending.role)}
                  onCancel={() => setPending(null)}
                />
              </div>
            ) : null}
          </div>
        ))}
        {!loading && !error ? (
          <div style={{ padding: '14px 22px', fontSize: 12.5, color: 'var(--muted-2)', lineHeight: 1.55 }}>
            Newest 50 at most. Org membership is managed on the Organizations tab.
          </div>
        ) : null}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------- orgs */

function OrgsTab() {
  const { flash, flashError } = useToast()
  const orgsReq = useApi(() => api.get('/admin/orgs'), [])
  const [selectedId, setSelectedId] = useState(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const createOrg = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const { org } = await api.post('/admin/orgs', {
        name: name.trim(),
        description: description.trim(),
      })
      flash(`${org.name} created.`)
      setName('')
      setDescription('')
      setSelectedId(org.id)
      orgsReq.reload()
    } catch (err) {
      flashError(err)
    } finally {
      setCreating(false)
    }
  }

  if (orgsReq.loading) return <Loading label="Loading organizations" />
  if (orgsReq.error) return <ErrorState error={orgsReq.error} onRetry={orgsReq.reload} />

  const orgs = orgsReq.data?.orgs ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="row">
        <section style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Kicker>ORGANIZATIONS</Kicker>
          <div className="card">
            {orgs.length === 0 ? <Empty>No organizations yet. Create the first one below.</Empty> : null}
            {orgs.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`thread-row${selectedId === o.id ? ' active' : ''}`}
                onClick={() => setSelectedId(o.id)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: 150 }}>
                    <span
                      style={{
                        display: 'block',
                        fontFamily: 'var(--display)',
                        fontSize: 14.5,
                        fontWeight: 700,
                      }}
                    >
                      {o.name}
                    </span>
                    {o.description ? (
                      <span
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: 'var(--muted-2)',
                          marginTop: 2,
                          lineHeight: 1.5,
                        }}
                      >
                        {o.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="chip">
                    {o.memberCount} member{o.memberCount === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <form
            className="card card-pad"
            onSubmit={createOrg}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <Kicker>NEW ORGANIZATION</Kicker>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              aria-label="Organization name"
              maxLength={80}
              required
            />
            <input
              className="field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              aria-label="Organization description"
              maxLength={500}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={creating || !name.trim()}>
              {creating ? 'Creating…' : 'Create organization'}
            </button>
          </form>
        </section>

        <section style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Kicker>DETAIL</Kicker>
          {selectedId ? (
            <OrgDetail key={selectedId} orgId={selectedId} onChanged={orgsReq.reload} />
          ) : (
            <div className="note-quiet">Pick an organization to see and manage its members.</div>
          )}
        </section>
      </div>

      <TagsCard />
    </div>
  )
}

function OrgDetail({ orgId, onChanged }) {
  const { flash, flashError } = useToast()
  const { data, error, loading, reload } = useApi(() => api.get(`/admin/orgs/${orgId}`), [orgId])
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [pendingRemoval, setPendingRemoval] = useState(null) // member awaiting the confirm

  const startEdit = () => {
    setName(data.org.name)
    setDescription(data.org.description ?? '')
    setEditing(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Absent keys keep their stored value server-side, so only send what moved.
      const body = {}
      if (name.trim() && name.trim() !== data.org.name) body.name = name.trim()
      if (description.trim() !== (data.org.description ?? '')) body.description = description.trim()
      await api.patch(`/admin/orgs/${orgId}`, body)
      flash('Organization updated.')
      setEditing(false)
      reload()
      onChanged()
    } catch (err) {
      flashError(err)
    } finally {
      setSaving(false)
    }
  }

  const removeMember = async (member) => {
    setRemovingId(member.userId)
    try {
      await api.del(`/admin/orgs/${orgId}/members/${member.userId}`)
      flash(`${member.name} removed.`)
      setPendingRemoval(null)
      reload()
      onChanged()
    } catch (err) {
      flashError(err)
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) return <Loading label="Loading members" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { org, members } = data

  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
      {editing ? (
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div className="label" style={{ marginBottom: 0 }}>
            RENAME / EDIT DESCRIPTION
          </div>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Organization name"
            maxLength={80}
            required
          />
          <input
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Organization description"
            placeholder="Description"
            maxLength={500}
          />
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="btn btn-dark btn-sm" type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 19 }}>{org.name}</div>
            {org.description ? (
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 5, lineHeight: 1.55 }}>
                {org.description}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 5 }}>No description.</div>
            )}
          </div>
          <button className="btn btn-outline btn-sm" onClick={startEdit}>
            Rename / edit
          </button>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Kicker>MEMBERS · {members.length}</Kicker>
        {members.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted-2)', padding: '10px 0' }}>
            Nobody yet. Add the first member below.
          </div>
        ) : null}
        {members.map((m, i) => (
          <div
            key={m.userId}
            style={{ borderBottom: i < members.length - 1 ? '1px solid var(--line-3)' : undefined }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
              <Avatar name={m.name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--display)', fontSize: 13.5, fontWeight: 700 }}>
                  <Link to={`/u/${m.userId}`}>{m.name}</Link>
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted-2)' }}> · {m.position}</span>
              </div>
              {pendingRemoval?.userId !== m.userId ? (
                <button
                  className="btn btn-outline-red btn-sm"
                  disabled={removingId === m.userId}
                  onClick={() => setPendingRemoval(m)}
                >
                  Remove
                </button>
              ) : null}
            </div>
            {/* dropping a member is as destructive as a role change, so it gets
                the same second look rather than going through on one click */}
            {pendingRemoval?.userId === m.userId ? (
              <div style={{ background: 'var(--bone)', padding: '10px 12px', marginBottom: 9 }}>
                <Confirm
                  message={`Remove ${m.name} from ${org.name}? They lose the powers the membership carries.`}
                  confirmLabel="Remove"
                  tone="red"
                  busy={removingId === m.userId}
                  onConfirm={() => removeMember(m)}
                  onCancel={() => setPendingRemoval(null)}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <MemberPicker orgId={orgId} memberIds={members.map((m) => m.userId)} onAdded={() => { reload(); onChanged() }} />
    </div>
  )
}

/** The org detail's "add member" box: the same /admin/users search, pick to add. */
function MemberPicker({ orgId, memberIds, onAdded }) {
  const { flash, flashError } = useToast()
  const [q, setQ] = useState('')
  const [position, setPosition] = useState('Member')
  const debouncedQ = useDebounced(q, 300)
  const trimmed = debouncedQ.trim()
  const { data, error, loading, reload } = useApi(
    () => (trimmed ? api.get(`/admin/users?q=${encodeURIComponent(trimmed)}`) : Promise.resolve(null)),
    [trimmed],
  )
  const [addingId, setAddingId] = useState(null)

  // Existing members are filtered out client-side; the server's 409 is the backstop.
  const results = (data?.users ?? []).filter((u) => !memberIds.includes(u.id)).slice(0, 8)

  const add = async (user) => {
    setAddingId(user.id)
    try {
      const trimmedPosition = position.trim()
      await api.post(`/admin/orgs/${orgId}/members`, {
        userId: user.id,
        position: trimmedPosition || 'Member',
      })
      flash(`${user.name} added${trimmedPosition && trimmedPosition !== 'Member' ? ` as ${trimmedPosition}` : ''}.`)
      setQ('')
      onAdded()
    } catch (err) {
      flashError(err)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div
      style={{
        borderTop: '1px solid var(--line-2)',
        paddingTop: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <div className="label" style={{ marginBottom: 0 }}>
        ADD A MEMBER
      </div>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <input
          className="field field-sm"
          style={{ flex: '1 1 170px' }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, id"
          aria-label="Search users to add"
        />
        <input
          className="field field-sm"
          style={{ width: 150 }}
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Position"
          maxLength={80}
          aria-label="Position"
        />
      </div>
      {trimmed && loading ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>Searching…</div>
      ) : null}
      {/* a failed search is not an empty search: saying "nobody found" here
          would report a network fault as a fact about the directory */}
      {trimmed && !loading && error ? (
        <div style={{ fontSize: 12.5, color: 'var(--red)' }}>
          The search did not come back.{' '}
          <button type="button" className="btn btn-link" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}
      {trimmed && !loading && !error && results.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>
          Nobody found, or everyone matching is already a member.
        </div>
      ) : null}
      {(error ? [] : results).map((u) => (
        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
          <Avatar name={u.name} size={26} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
            {u.name}
            <span style={{ color: 'var(--muted-2)' }}>
              {' '}· {u.role.toLowerCase()}
              {u.universityId ? ` · ${u.universityId}` : ''}
            </span>
          </span>
          <button className="btn btn-outline btn-sm" disabled={addingId === u.id} onClick={() => add(u)}>
            {addingId === u.id ? 'Adding…' : 'Add'}
          </button>
        </div>
      ))}
    </div>
  )
}

const TAG_CATEGORIES = ['LANGUAGE', 'ACADEMIC', 'PRACTICAL', 'ERRAND']

/** Orgs own the taxonomy: a small fixed control for adding to the shared tag list. */
function TagsCard() {
  const { flash, flashError } = useToast()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('LANGUAGE')
  const [creating, setCreating] = useState(false)

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const { tag } = await api.post('/admin/tags', { name: name.trim(), category })
      flash(`Tag "${tag.name}" added under ${labelOf(TAG_CATEGORY_LABEL, category)}.`)
      setName('')
    } catch (err) {
      flashError(err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <form
      className="card card-pad"
      style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 12 }}
      onSubmit={create}
    >
      <Kicker>CREATE A SKILL TAG</Kicker>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <input
          className="field"
          style={{ flex: '1 1 190px' }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Data Analysis"
          aria-label="Tag name"
          maxLength={40}
          required
        />
        <button className="btn btn-dark btn-sm" type="submit" disabled={creating || !name.trim()}>
          {creating ? 'Creating…' : 'Create tag'}
        </button>
      </div>
      <div className="seg-row" role="group" aria-label="Tag category">
        {TAG_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className="seg"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {labelOf(TAG_CATEGORY_LABEL, c)}
          </button>
        ))}
      </div>
    </form>
  )
}

/* ----------------------------------------------------------------- reviews */

const REVIEW_VIEWS = [
  { key: 'ALL', label: 'All' },
  { key: 'HIDDEN', label: 'Hidden' },
  { key: 'VISIBLE', label: 'Visible' },
]

function ReviewsTab() {
  const { flash, flashError } = useToast()
  const [view, setView] = useState('ALL')
  const suffix = view === 'ALL' ? '' : `?hidden=${view === 'HIDDEN'}`
  const { data, error, loading, reload } = useApi(() => api.get(`/admin/reviews${suffix}`), [suffix])
  const [busyId, setBusyId] = useState(null)

  const setHidden = async (review, hidden) => {
    setBusyId(review.id)
    try {
      await api.patch(`/admin/reviews/${review.id}/hide-text`, { hidden })
      flash(hidden ? 'Text hidden. The rating keeps counting.' : 'Text restored.')
      reload()
    } catch (err) {
      flashError(err)
    } finally {
      setBusyId(null)
    }
  }

  const reviews = data?.reviews ?? []

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Kicker>REVIEW MODERATION</Kicker>
        <div className="seg-row">
          {REVIEW_VIEWS.map((v) => (
            <button key={v.key} className="seg" aria-pressed={view === v.key} onClick={() => setView(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* only the results swap while a view loads; the segment row above stays
          put so the filter the admin just pressed is still there to press again */}
      {loading ? <Loading label="Loading reviews" /> : null}
      {!loading && error ? <ErrorState error={error} onRetry={reload} /> : null}

      {!loading && !error && reviews.length === 0 ? (
        <Empty>
          {view === 'HIDDEN'
            ? 'No hidden review texts.'
            : view === 'VISIBLE'
              ? 'No visible review texts.'
              : 'No reviews yet.'}
        </Empty>
      ) : null}

      {!loading && !error && reviews.length ? (
        <div className="card">
          {reviews.map((r, i) => (
            <div
              key={r.id}
              style={{
                padding: '16px 22px',
                borderBottom: i < reviews.length - 1 ? '1px solid var(--line-3)' : undefined,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 18,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700 }}>
                    {r.reviewer.name} <span style={{ color: 'var(--muted-2)', fontWeight: 400 }}>→</span>{' '}
                    {r.reviewee.name}
                  </span>
                  {/* the glyphs are decoration; the rating is read out once */}
                  <span
                    style={{ display: 'inline-flex', alignItems: 'center' }}
                    aria-label={`${r.rating} out of 5`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Icon
                        key={n}
                        name={n <= r.rating ? 'star' : 'star_border'}
                        size={15}
                        color={n <= r.rating ? 'var(--gold)' : 'var(--line-control)'}
                      />
                    ))}
                  </span>
                  {r.textHidden ? (
                    <span className="chip chip-request">
                      <Icon name="visibility_off" size={13} />
                      hidden
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 3 }}>
                  <Link to={`/tasks/${r.taskId}`}>{r.taskTitle}</Link> · {relativeTime(r.createdAt)}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: 'var(--ink-4)',
                    marginTop: 7,
                    fontStyle: r.textHidden ? 'italic' : 'normal',
                  }}
                >
                  {r.text || <em style={{ color: 'var(--muted-2)' }}>No comment left.</em>}
                </div>
              </div>
              <button
                className={`btn btn-sm ${r.textHidden ? 'btn-outline' : 'btn-dark'}`}
                style={{ alignSelf: 'center' }}
                disabled={busyId === r.id}
                onClick={() => setHidden(r, !r.textHidden)}
              >
                {busyId === r.id ? 'Working…' : r.textHidden ? 'Show text' : 'Hide text'}
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>
        Newest first, up to 50. Hiding removes the wording everywhere; the rating keeps counting in
        the public average.
      </div>
    </section>
  )
}
