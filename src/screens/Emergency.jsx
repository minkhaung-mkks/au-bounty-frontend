import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useApi, useDebounced } from '../lib/useApi.js'
import { useSocketEvent } from '../lib/socket.js'
import { TaskCard } from '../components/TaskCard.jsx'
import { Empty, ErrorState, Icon, Loading } from '../components/ui.jsx'

const VIEWS = [
  { key: 'OPEN', label: 'Open', empty: 'No open emergency tasks right now.' },
  { key: 'ALL', label: 'All', empty: 'No emergency tasks have been posted yet.' },
]

export function Emergency() {
  const navigate = useNavigate()

  const [view, setView] = useState('OPEN')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query, 300)

  const qs = new URLSearchParams({ type: 'EMERGENCY', status: view })
  if (debouncedQuery.trim()) qs.set('q', debouncedQuery.trim())

  const { data, error, loading, refreshing, reload } = useApi(
    () => api.get(`/tasks?${qs.toString()}`),
    [view, debouncedQuery],
  )

  // Every socket joins the global emergencies room, so a task posted elsewhere
  // lands here without a refresh. The list is small and the page is an
  // emergency feed: reload outright rather than hiding it behind a "show new"
  // button the reader has to notice and press.
  const reloadRef = useRef(reload)
  useEffect(() => {
    reloadRef.current = reload
  })
  const [liveNote, setLiveNote] = useState(null)
  useSocketEvent('emergency:new', (alert) => {
    setLiveNote(alert?.title ? `New emergency task: ${alert.title}` : 'A new emergency task was posted.')
    reloadRef.current()
  })

  const active = VIEWS.find((v) => v.key === view)
  const tasks = data?.tasks ?? []

  return (
    <div style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 22 }}>
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
          <h1 className="display">Emergency</h1>
          <p className="page-sub">
            Emergency tasks recruit people to help, right now. Posting one broadcasts it to everyone
            signed in.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/create')}>
          <Icon name="emergency" size={18} />
          Post an emergency task
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <label className="sr-only" htmlFor="emergency-search">
          Search emergency tasks
        </label>
        <input
          id="emergency-search"
          className="field"
          style={{ flex: '1 1 260px', maxWidth: 380 }}
          type="search"
          placeholder="Search title, text, location or tag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="seg-row" role="group" aria-label="Which emergency tasks to show">
          {VIEWS.map((v) => (
            <button key={v.key} className="seg" aria-pressed={view === v.key} onClick={() => setView(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <p className="page-sub" style={{ margin: 0 }} aria-live="polite">
        {loading
          ? 'Loading…'
          : `${tasks.length} ${view === 'OPEN' ? 'open' : 'total'} · newest first${refreshing ? ' · refreshing' : ''}`}
        {liveNote ? ` · ${liveNote}` : ''}
      </p>

      {loading && !data ? <Loading label="Loading emergency tasks" /> : null}
      {error ? <ErrorState error={error} onRetry={reload} /> : null}
      {!loading && !error && tasks.length === 0 ? (
        <Empty>
          {debouncedQuery.trim() ? `No emergency task matches “${debouncedQuery.trim()}”.` : active.empty}
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
  )
}
