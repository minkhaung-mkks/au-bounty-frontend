import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useApi, useDebounced } from '../lib/useApi.js'
import { useSession } from '../session.jsx'
import { TaskCard } from '../components/TaskCard.jsx'
import { Empty, ErrorState, Icon, Kicker, Loading, Stat } from '../components/ui.jsx'

const TABS = [
  { key: 'All', params: {} },
  { key: 'Matches', params: { matches: 'true' } },
  { key: 'Requests', params: { type: 'REQUEST' } },
  { key: 'Events', params: { type: 'EVENT' } },
  { key: 'Emergency', params: { type: 'EMERGENCY' } },
]

export function Board() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { me, tags, stats } = useSession()

  const [tab, setTab] = useState('All')
  // The search box lives in the top bar and writes ?q=. Debounced so typing does
  // not fire a request per keystroke.
  const query = searchParams.get('q') ?? ''
  const debouncedQuery = useDebounced(query, 300)

  const active = TABS.find((t) => t.key === tab)
  const qs = new URLSearchParams({ ...active.params })
  if (debouncedQuery.trim()) qs.set('q', debouncedQuery.trim())

  const { data, error, loading, reload } = useApi(
    () => api.get(`/tasks?${qs.toString()}`),
    [tab, debouncedQuery],
  )

  const emergencies = useApi(() => api.get('/tasks?type=EMERGENCY'), [])
  const latestEmergency = emergencies.data?.tasks?.[0]

  const tasks = data?.tasks ?? []

  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', maxWidth: 1460, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
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
            <h1 className="display">Bounty board</h1>
            <p className="page-sub">
              {loading
                ? 'Loading…'
                : `${tasks.length} open · ${data?.ranked ? 'ranked by your skill tags' : 'newest first'}`}
            </p>
          </div>
          <div className="seg-row">
            {TABS.map((t) => (
              <button
                key={t.key}
                className="seg"
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.key}
              </button>
            ))}
          </div>
        </div>

        {loading ? <Loading label="Loading the board" /> : null}
        {error ? <ErrorState error={error} onRetry={reload} /> : null}
        {!loading && !error && tasks.length === 0 ? (
          <Empty>
            {tab === 'Matches'
              ? 'No open task matches your profile tags yet. Add tags on your profile, or try the All tab.'
              : query
                ? `Nothing matches “${query}”.`
                : 'Nothing on the board right now.'}
          </Empty>
        ) : null}

        {tasks.length ? (
          <div className="board-grid">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ width: 330, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="panel-dark" style={{ padding: 22 }}>
          <Kicker gold>YOUR RECORD</Kicker>
          <div style={{ display: 'flex', gap: 22, marginTop: 14 }}>
            <Stat value={stats?.completed ?? 0} caption="Completed" />
            <Stat value={stats?.rating ?? '—'} caption="Rating" color="var(--gold-light)" />
            <Stat value={stats?.events ?? 0} caption="Events" />
          </div>
          <button
            className="btn btn-outline-dark btn-block btn-sm"
            style={{ marginTop: 18 }}
            onClick={() => navigate('/profile')}
          >
            View public profile
          </button>
        </div>

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Kicker>YOUR SKILL TAGS</Kicker>
          {tags.length ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tags.map((t) => (
                <span key={t.id} className="chip chip-skill">
                  {t.name}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>
              No tags yet. Add some on your profile and the Matches tab starts working.
            </div>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setTab('Matches')}>
            Show tasks that match
          </button>
          <div style={{ fontSize: 12.5, color: 'var(--muted-2)', lineHeight: 1.55 }}>
            Ranking happens on the server: it counts how many of a task's tags you also have, and
            sorts by that.
          </div>
        </div>

        {latestEmergency ? (
          <button
            onClick={() => navigate('/emergency')}
            style={{
              textAlign: 'left',
              background: 'var(--red)',
              border: 0,
              borderLeft: '3px solid var(--red-dark)',
              padding: 20,
              cursor: 'pointer',
              color: '#fff',
              fontFamily: 'var(--body)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: 'var(--gold-light)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name="bolt" size={15} />
              LATEST EMERGENCY
            </span>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16.5 }}>
              {latestEmergency.title}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--red-soft)' }}>
              {latestEmergency.location.name} · posted by {latestEmergency.poster.name}
            </span>
          </button>
        ) : null}

        {me?.role === 'ADMIN' ? (
          <button className="btn btn-dark btn-block" onClick={() => navigate('/admin')}>
            <Icon name="shield_person" size={19} color="var(--gold-light)" />
            Admin console
          </button>
        ) : null}
      </div>
    </div>
  )
}
