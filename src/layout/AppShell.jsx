import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useSession } from '../session.jsx'
import { Icon, Mark } from '../components/ui.jsx'
import { EmergencyBanner } from '../components/EmergencyBanner.jsx'
import { ROLE_LABEL, initials, labelOf } from '../lib/format.js'
import { useSocketEvent, useSocketSession } from '../lib/socket.js'
import { reloadThreadsSoon, threadsStore, totalUnread, useThreads } from '../lib/threads.js'

const NAV = [
  { to: '/', label: 'Board', icon: 'grid_view', end: true },
  { to: '/my-tasks', label: 'My tasks', icon: 'checklist', badge: 'mine' },
  { to: '/messages', label: 'Messages', icon: 'forum', badge: 'messages' },
  { to: '/check-in', label: 'Check-in', icon: 'qr_code_2' },
  { to: '/profile', label: 'Profile', icon: 'person' },
  { to: '/admin', label: 'Admin', icon: 'shield_person', adminOnly: true },
]

export function AppShell({ children }) {
  const { me, orgs, signOut, devAuth } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const onBoard = location.pathname === '/'
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [mineCount, setMineCount] = useState(0)
  const [weather, setWeather] = useState(null)
  const { threads } = useThreads()
  const unreadCount = totalUnread(threads)

  // D11 weather chip: Open-Meteo via the server, which caches for 10 minutes —
  // the client re-asks on the same cadence. Any failure keeps the last good
  // reading; only a failure before the first success falls back to the static
  // placeholder text.
  useEffect(() => {
    let cancelled = false
    const load = () =>
      api
        .get('/weather')
        .then((d) => {
          if (!cancelled) setWeather(d)
        })
        .catch(() => {})
    load()
    const timer = setInterval(load, 10 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  // One socket while signed in; the cookie (or dev handshake header) identifies it.
  useSocketSession(me.id)

  // Badge on "Messages": unread totals, refreshed whenever a thread nudges us
  // while we are not sitting in it looking at it.
  useEffect(() => {
    threadsStore.reload()
  }, [me.id])

  useSocketEvent('message:new', (payload) => {
    const assignmentId = payload?.assignmentId ?? payload?.message?.assignmentId
    if (!assignmentId) return
    const lookingAtIt =
      threadsStore.getState().openThreadId === assignmentId && document.hasFocus()
    if (!lookingAtIt) reloadThreadsSoon()
  })

  // Badge on "My tasks": applicants waiting on you plus reviews you owe.
  useEffect(() => {
    let cancelled = false
    api
      .get('/me/tasks')
      .then((d) => {
        if (cancelled) return
        const applicants = d.posted.reduce(
          (n, t) => n + t.assignments.filter((a) => a.status === 'APPLIED').length,
          0,
        )
        setMineCount(applicants + d.needsReview.length)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  // On the board the box drives the URL live, so the board refetches as you type.
  // Anywhere else it waits for Enter and takes you to the board.
  const onSearchChange = (value) => {
    setQuery(value)
    if (onBoard) setSearchParams(value ? { q: value } : {}, { replace: true })
  }

  const submitSearch = (e) => {
    e.preventDefault()
    if (!onBoard) navigate(query.trim() ? `/?q=${encodeURIComponent(query.trim())}` : '/')
  }

  const roleLine = orgs.length
    ? `${labelOf(ROLE_LABEL, me.role)} · ${orgs[0].name}`
    : labelOf(ROLE_LABEL, me.role)

  return (
    <div className="shell">
      <EmergencyBanner />
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Mark size={42} />
          <span
            className="hide-narrow"
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 19,
              letterSpacing: '-0.02em',
            }}
          >
            AU Bounty
          </span>
        </div>

        <button className="btn btn-primary btn-block" onClick={() => navigate('/create')}>
          <Icon name="add" size={18} />
          <span className="hide-narrow">New post</span>
        </button>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.filter((n) => !n.adminOnly || me.role === 'ADMIN').map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <Icon name={n.icon} size={19} />
              <span>{n.label}</span>
              {n.badge === 'mine' && mineCount > 0 ? (
                <span className="nav-badge">{mineCount}</span>
              ) : null}
              {n.badge === 'messages' && unreadCount > 0 ? (
                <span className="nav-badge">{unreadCount}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <button
          className="btn btn-outline-dark btn-block"
          style={{ color: 'var(--red-soft-2)', fontSize: 13 }}
          onClick={() => navigate('/emergency')}
        >
          <Icon name="emergency" size={18} />
          <span className="hide-narrow">Emergency</span>
        </button>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              borderTop: '1px solid var(--ink-3)',
              paddingTop: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 11,
            }}
          >
            <div
              className="avatar"
              style={{ width: 36, height: 36, fontSize: 13, background: 'var(--red)', color: '#fff' }}
            >
              {initials(me.name)}
            </div>
            <div className="hide-narrow" style={{ lineHeight: 1.25, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {me.name}
              </div>
              {/* muted-3 is the ink-surface step; muted-2 is tuned for paper
                  and goes muddy against the sidebar. */}
              <div style={{ fontSize: 11, color: 'var(--muted-3)' }}>{roleLine}</div>
            </div>
          </div>
          <button
            className="btn btn-outline-dark btn-sm btn-block hide-narrow"
            onClick={() => {
              signOut()
              navigate('/login')
            }}
          >
            <Icon name={devAuth ? 'swap_horiz' : 'logout'} size={17} color="var(--gold)" />
            {devAuth ? 'Switch user' : 'Sign out'}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <form className="searchbox" onSubmit={submitSearch}>
            <Icon name="search" size={19} color="var(--muted-2)" />
            <input
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tasks, tags, buildings"
              aria-label="Search"
            />
            {query ? (
              <button
                type="button"
                className="btn"
                style={{ padding: 0 }}
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                <Icon name="close" size={18} color="var(--muted-2)" />
              </button>
            ) : null}
          </form>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
            {weather ? (
              <span
                className="topbar-weather"
                title={`Live campus weather · ${weather.label} · refreshed every 10 minutes`}
              >
                <Icon name="rainy" size={18} color="var(--gold)" />
                {Math.round(weather.temperatureC)}° {weather.label} · {weather.locationLabel}
              </span>
            ) : (
              <span
                className="topbar-weather"
                title="Static placeholder. Live weather is unavailable right now."
              >
                <Icon name="rainy" size={18} color="var(--gold)" />
                31° Bang Na
              </span>
            )}
            <button
              className="btn"
              style={{ padding: 0 }}
              onClick={() => navigate('/messages')}
              aria-label="Messages"
            >
              <Icon name="forum" size={22} color="var(--muted)" />
            </button>
            <button
              className="btn"
              style={{ padding: 0 }}
              onClick={() => navigate('/profile')}
              aria-label="Profile"
            >
              <Icon name="account_circle" size={22} color="var(--muted)" />
            </button>
          </div>
        </div>

        <div className="page">{children ?? <Outlet />}</div>
      </main>
    </div>
  )
}
