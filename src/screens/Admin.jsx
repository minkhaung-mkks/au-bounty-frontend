import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useApi, useDebounced } from '../lib/useApi.js'
import { useSession } from '../session.jsx'
import { useToast } from '../components/Toast.jsx'
import { Avatar, Empty, ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import { relativeTime } from '../lib/format.js'

const TABS = [
  { key: 'alerts', label: 'Alerts' },
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
  const [tab, setTab] = useState('alerts')

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
        <Icon name="lock" size={48} color="var(--muted-4)" />
        <div className="display" style={{ fontSize: 26 }}>
          403 · Admins only
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'var(--muted)', margin: 0 }}>
          You are signed in as <strong>{me.role}</strong>. Authorization checks the role before the
          route runs. Sign in as the admin account to see this screen.
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
          <p className="page-sub">Alerts, roles, organizations and review moderation.</p>
        </div>
        <div className="seg-row">
          {TABS.map((t) => (
            <button key={t.key} className="seg" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'alerts' ? <AlertsTab /> : null}
      {tab === 'people' ? <PeopleTab /> : null}
      {tab === 'orgs' ? <OrgsTab /> : null}
      {tab === 'reviews' ? <ReviewsTab /> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ alerts */

const ALERT_VIEWS = ['ACTIVE', 'RESOLVED', 'FLAGGED', 'ALL']

const ALERT_STATUS_STYLE = {
  ACTIVE: { background: 'var(--red)', color: '#fff' },
  RESOLVED: { background: 'var(--bone-2)', color: 'var(--green)' },
  FLAGGED: { background: 'var(--bone-2)', color: 'var(--muted)' },
}

const titleCase = (value) => value[0] + value.slice(1).toLowerCase()

function AlertsTab() {
  const { flash, flashError } = useToast()
  const [view, setView] = useState('ACTIVE')
  const { data, error, loading, reload } = useApi(
    () => api.get(view === 'ALL' ? '/admin/alerts' : `/admin/alerts?status=${view}`),
    [view],
  )
  const [pending, setPending] = useState(null) // { id, status } awaiting confirm
  const [busyId, setBusyId] = useState(null)

  const setStatus = async (alert, status) => {
    setBusyId(alert.id)
    try {
      await api.patch(`/admin/alerts/${alert.id}`, { status })
      flash(status === 'RESOLVED' ? 'Alert resolved.' : 'Alert flagged as a false alarm.')
      setPending(null)
      reload()
    } catch (err) {
      flashError(err)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Loading label="Loading alerts" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const alerts = data?.alerts ?? []

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
        <Kicker>EMERGENCY ALERTS</Kicker>
        <div className="seg-row">
          {ALERT_VIEWS.map((v) => (
            <button key={v} className="seg" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'ALL' ? 'All' : titleCase(v)}
            </button>
          ))}
        </div>
      </div>

      {alerts.length === 0 ? (
        <Empty>
          {view === 'ACTIVE'
            ? 'No active alerts. Quiet campus.'
            : view === 'ALL'
              ? 'No alerts recorded.'
              : `No ${view.toLowerCase()} alerts.`}
        </Empty>
      ) : null}

      {alerts.map((a) => (
        <div
          key={a.id}
          className="card"
          style={{ borderLeft: `3px solid ${a.status === 'ACTIVE' ? 'var(--red)' : 'var(--line)'}` }}
        >
          <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16.5 }}>
                <Link to={`/u/${a.user.id}`}>{a.user.name}</Link>
                {a.user.universityId ? (
                  <span style={{ color: 'var(--muted-2)', fontWeight: 400 }}> · {a.user.universityId}</span>
                ) : null}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 4 }}>
                {a.lat.toFixed(5)}, {a.lng.toFixed(5)} · {relativeTime(a.createdAt)}
                {a.resolvedAt ? ` · resolved ${relativeTime(a.resolvedAt)}` : ''}
              </div>
              {a.message ? (
                <div style={{ fontSize: 13.5, color: 'var(--ink-4)', marginTop: 7, fontStyle: 'italic' }}>
                  “{a.message}”
                </div>
              ) : null}
            </div>
            <span className="chip" style={ALERT_STATUS_STYLE[a.status]}>
              {a.status}
            </span>
            <span
              className="chip"
              style={
                a.forwardedToPeer
                  ? { background: 'var(--gold-wash)', color: 'var(--gold-ink)' }
                  : { background: 'var(--red-wash)', color: 'var(--red)' }
              }
              title={
                a.forwardedToPeer
                  ? 'The peer partner acknowledged this alert.'
                  : 'The peer partner has not acknowledged it yet; delivery keeps retrying.'
              }
            >
              <Icon name={a.forwardedToPeer ? 'send' : 'sync'} size={13} />
              {a.forwardedToPeer ? 'sent to partner' : 'retrying'}
            </span>
            {a.status === 'ACTIVE' && pending?.id !== a.id ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-dark btn-sm"
                  onClick={() => setPending({ id: a.id, status: 'RESOLVED' })}
                >
                  Resolve
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ color: 'var(--red)' }}
                  onClick={() => setPending({ id: a.id, status: 'FLAGGED' })}
                >
                  Flag false alarm
                </button>
              </div>
            ) : null}
          </div>
          {pending?.id === a.id ? (
            <div style={{ borderTop: '1px solid var(--line-3)', background: 'var(--bone)', padding: '12px 20px' }}>
              <Confirm
                message={
                  pending.status === 'RESOLVED'
                    ? 'Mark this alert resolved? It leaves the active queue.'
                    : 'Flag as a false alarm? It leaves the active queue and is marked FLAGGED.'
                }
                confirmLabel={pending.status === 'RESOLVED' ? 'Resolve' : 'Flag'}
                tone={pending.status === 'RESOLVED' ? 'dark' : 'red'}
                busy={busyId === a.id}
                onConfirm={() => setStatus(a, pending.status)}
                onCancel={() => setPending(null)}
              />
            </div>
          ) : null}
        </div>
      ))}
    </section>
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

  if (loading) return <Loading label="Loading people" />
  if (error) return <ErrorState error={error} onRetry={reload} />

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
            className="field"
            style={{ width: 260, padding: '10px 13px' }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, id"
            aria-label="Search users"
          />
          <select
            className="field"
            style={{ width: 160, padding: '10px 13px' }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {users.length === 0 ? (
          <Empty>Nobody matches. Service accounts never appear in this list.</Empty>
        ) : null}
        {users.map((u, i) => (
          <div
            key={u.id}
            style={{ borderBottom: i < users.length - 1 ? '1px solid var(--line-3)' : undefined }}
          >
            <div style={{ padding: '15px 22px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <Avatar name={u.name} size={36} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>
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
                className="field"
                style={{ width: 140, padding: '9px 12px' }}
                value={u.role}
                disabled={u.id === me.id || busyId === u.id}
                title={u.id === me.id ? 'You cannot change your own role.' : undefined}
                onChange={(e) => request(u, e.target.value)}
                aria-label={`Role for ${u.name}`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
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
        <div style={{ padding: '14px 22px', fontSize: 12.5, color: 'var(--muted-2)', lineHeight: 1.55 }}>
          Newest 50 at most. Org membership is not a role: a member stays a student and gets org
          powers through the membership record, managed on the Organizations tab.
        </div>
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
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{o.name}</span>
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
              maxLength={80}
              required
            />
            <input
              className="field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
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
            <div className="note-quiet">
              Pick an organization to see and manage its members. Membership stays separate from
              roles: a member keeps being a student and gets org powers through the membership
              record, which also says which org they can act for.
            </div>
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
            <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !name.trim()}>
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
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 21 }}>{org.name}</div>
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
        {members.map((m) => (
          <div
            key={m.userId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '9px 0',
              borderBottom: '1px solid var(--line-3)',
            }}
          >
            <Avatar name={m.name} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                <Link to={`/u/${m.userId}`}>{m.name}</Link>
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted-2)' }}> · {m.position}</span>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--red)' }}
              disabled={removingId === m.userId}
              onClick={() => removeMember(m)}
            >
              {removingId === m.userId ? 'Removing…' : 'Remove'}
            </button>
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
  const { data, loading } = useApi(
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
          className="field"
          style={{ flex: '1 1 170px', padding: '10px 13px' }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, id"
          aria-label="Search users to add"
        />
        <input
          className="field"
          style={{ width: 150, padding: '10px 13px' }}
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
      {trimmed && !loading && results.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>
          Nobody found, or everyone matching is already a member.
        </div>
      ) : null}
      {results.map((u) => (
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
      flash(`Tag "${tag.name}" added under ${titleCase(category)}.`)
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
          maxLength={40}
          required
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={creating || !name.trim()}>
          {creating ? 'Creating…' : 'Create tag'}
        </button>
      </div>
      <div className="seg-row">
        {TAG_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className="seg"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {titleCase(c)}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted-2)', lineHeight: 1.55 }}>
        Tags come from one fixed list so similar skills never split into copies that never match.
        Duplicates are refused by the server.
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

  if (loading) return <Loading label="Loading reviews" />
  if (error) return <ErrorState error={error} onRetry={reload} />

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

      {reviews.length === 0 ? (
        <Empty>
          {view === 'HIDDEN'
            ? 'No hidden review texts.'
            : view === 'VISIBLE'
              ? 'No visible review texts.'
              : 'No reviews yet.'}
        </Empty>
      ) : null}

      {reviews.length ? (
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
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {r.reviewer.name} <span style={{ color: 'var(--muted-2)', fontWeight: 400 }}>→</span>{' '}
                    {r.reviewee.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>
                    {'★'.repeat(r.rating)}
                    {'☆'.repeat(5 - r.rating)}
                  </span>
                  {r.textHidden ? (
                    <span className="chip" style={{ background: 'var(--red-wash)', color: 'var(--red)' }}>
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
