import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { Avatar, Empty, ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import { dateTime, timeOnly } from '../lib/format.js'
import { subscribe, unsubscribe, useSocketEvent } from '../lib/socket.js'

/** The code rotates every 60s; refetch just before the boundary so the swap is seamless. */
const REFRESH_EARLY_SECONDS = 2
/** Floor between any two polls, so boundary misses, tab focus and retries cannot stampede. */
const MIN_FETCH_INTERVAL_MS = 3000

/* ------------------------------------------------------------------ shared */

/** An event assignment counts as attended once the check-in landed. */
const isCheckedIn = (assignment) =>
  Boolean(assignment) && Boolean(assignment.checkedInAt || assignment.status === 'COMPLETED')

/** Most recent first, so the list reads like a door log. */
const byCheckinTime = (a, b) => (b.checkedInAt ?? '').localeCompare(a.checkedInAt ?? '')

const QrCanvas = ({ value, size = 176 }) => {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !value) return
    QRCode.toCanvas(ref.current, value, { width: size, margin: 1 }).catch(() => {})
  }, [value, size])
  return (
    <div style={{ background: '#fff', padding: 14, display: 'inline-flex', lineHeight: 0 }}>
      <canvas ref={ref} width={size} height={size} aria-label={`QR code ${value}`} />
    </div>
  )
}

/** One list row used by both pickers: dark-bordered when selected. */
function EventRow({ icon, title, meta, right, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '15px 4px',
        borderBottom: '1px solid var(--line-3)',
        background: 'transparent',
        borderLeft: 0,
        borderRight: 0,
        borderTop: 0,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--body)',
        flexWrap: 'wrap',
      }}
    >
      <Icon name={icon} size={24} color="var(--gold)" />
      <span style={{ flex: 1, minWidth: 180 }}>
        <span style={{ display: 'block', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16 }}>
          {title}
        </span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted-2)', marginTop: 3 }}>
          {meta}
        </span>
      </span>
      {right}
    </button>
  )
}

/* ---------------------------------------------------------- code polling */

/**
 * Keeps the organizer's code current with one fetch per rotation window: the
 * first fetch on mount, one ~2s before each boundary, one when the tab becomes
 * visible again after sleeping through one. No fixed short interval anywhere.
 */
function useCheckinCode(taskId) {
  const [state, setState] = useState(null) // { code, remainingSeconds, periodSeconds, fetchedAt }
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const hasCode = useRef(false)
  const inFlight = useRef(false)
  const lastFetch = useRef(0)

  const fetchCode = useCallback(async () => {
    if (!taskId || inFlight.current) return
    if (Date.now() - lastFetch.current < MIN_FETCH_INTERVAL_MS) return
    inFlight.current = true
    lastFetch.current = Date.now()
    try {
      const payload = await api.get(`/tasks/${taskId}/checkin-code`)
      hasCode.current = true
      setState({ ...payload, fetchedAt: Date.now() })
      setError(null)
    } catch (err) {
      // Nothing on screen yet: a hard error the organizer can read. Something
      // on screen: ride out the hiccup until the next boundary retries.
      if (!hasCode.current) setError(err)
    } finally {
      inFlight.current = false
    }
  }, [taskId])

  useEffect(() => {
    hasCode.current = false
    setState(null)
    setError(null)
    fetchCode()
  }, [fetchCode])

  // Local clock for the countdown; ticks never touch the network.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 500)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchCode()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fetchCode])

  const remaining = state
    ? Math.max(0, state.remainingSeconds - (Date.now() - state.fetchedAt) / 1000)
    : 0
  // While due (boundary imminent, or a refetch that failed or was throttled),
  // every tick asks again; fetchCode itself caps the attempts at one per 3s.
  const dueForRotationFetch = Boolean(state) && remaining <= REFRESH_EARLY_SECONDS
  useEffect(() => {
    if (dueForRotationFetch) fetchCode()
  }, [dueForRotationFetch, tick, fetchCode])

  return { state, remaining, error, refetch: fetchCode }
}

/* ----------------------------------------------------------------- picker */

function Picker({ kicker, children }) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Kicker>{kicker}</Kicker>
      {children}
    </div>
  )
}

/* --------------------------------------------------------------- attendee */

function AttendeeCheckin({ reserved, eventId, onPick, onClear, onCheckedIn }) {
  // A deep link can name an event that is not in "reserved" anymore (withdrawn
  // seat, shared link), so the selected event comes from the list when present
  // and from a detail fetch otherwise.
  const listEntry = reserved.find((e) => e.task.id === eventId) ?? null
  const needsDetail = Boolean(eventId) && !listEntry
  const detail = useApi(
    () => (needsDetail ? api.get(`/tasks/${eventId}`) : Promise.resolve(null)),
    [needsDetail, eventId],
  )

  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null) // { at, already }

  // Switching events (or back to the picker) starts the form from scratch.
  useEffect(() => {
    setCode('')
    setError(null)
    setDone(null)
  }, [eventId])

  const task = listEntry?.task ?? detail.data?.task ?? null
  const assignment = listEntry?.assignment ?? detail.data?.task?.myAssignment ?? null
  const checkedInAlready = isCheckedIn(assignment)
  const confirmed = done || checkedInAlready ? (done?.at ?? assignment?.checkedInAt ?? null) : null

  if (needsDetail && detail.loading) return <Loading label="Loading event" />
  if (needsDetail && detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} />

  /* ---------------------------------------------------------- the picker */

  if (!task) {
    return (
      <Picker kicker="EVENTS YOU RESERVED A SEAT FOR">
        {reserved.length === 0 ? (
          <Empty>
            No seat reserved yet.{' '}
            <Link to="/" className="btn btn-link">
              Browse the board
            </Link>{' '}
            and reserve one first.
          </Empty>
        ) : (
          reserved.map(({ task: t, assignment: a }) => (
            <EventRow
              key={a.id}
              icon="qr_code_2"
              title={t.title}
              meta={`${t.startsAt ? dateTime(t.startsAt) : 'Date to be announced'} · ${t.location.name}`}
              right={
                isCheckedIn(a) ? (
                  <span className="chip" style={{ background: 'var(--gold-wash)', color: 'var(--gold-ink)' }}>
                    <Icon name="check" size={13} color="var(--green)" />
                    Checked in {a.checkedInAt ? timeOnly(a.checkedInAt) : ''}
                  </span>
                ) : (
                  <span className="chip">Seat reserved</span>
                )
              }
              onClick={() => onPick(t.id)}
            />
          ))
        )}
      </Picker>
    )
  }

  /* --------------------------------------------------- code entry / done */

  const submit = async (e) => {
    e.preventDefault()
    if (code.length !== 6 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = await api.post(`/tasks/${task.id}/checkin`, { code })
      const updated = payload?.assignment ?? payload
      setDone({ at: updated?.checkedInAt ?? new Date().toISOString(), already: false })
      onCheckedIn()
    } catch (err) {
      if (err.status === 409) {
        setDone({ at: null, already: true })
        onCheckedIn()
      } else if (err.code === 'BAD_CODE' || err.status === 400) {
        setError('That code does not match. It may have just rotated — take the current one from the screen at the door.')
      } else if (err.status === 403) {
        setError('You need an accepted seat on this event before you can check in. Reserve one first.')
      } else {
        setError(err?.message || 'Checking in failed. Try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const confirmedPanel = done || checkedInAlready

  return (
    <div className="row">
      <div
        className="panel-dark"
        style={{
          flex: '0 0 auto',
          width: 400,
          padding: 34,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {confirmedPanel ? (
          <>
            <Kicker gold>ATTENDANCE VERIFIED</Kicker>
            <Icon name="check_circle" size={64} color="var(--green)" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24 }}>
                {task.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted-3)', marginTop: 8, lineHeight: 1.6 }}>
                {confirmed
                  ? `Checked in · ${dateTime(confirmed)}`
                  : 'You are already checked in for this event.'}
              </div>
            </div>
            <div
              className="note"
              style={{ width: '100%', fontSize: 12.5, textAlign: 'center' }}
            >
              Attendance was verified with the rotating code. Show this screen if anyone asks at
              the door.
            </div>
            <button type="button" className="btn btn-bone btn-block" onClick={onClear}>
              Check in to another event
            </button>
          </>
        ) : (
          <>
            <Kicker gold>ENTER THE DOOR CODE</Kicker>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 21 }}>
                {task.title}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted-3)', marginTop: 5 }}>
                {task.startsAt ? dateTime(task.startsAt) : 'Date to be announced'} ·{' '}
                {task.location.name}
              </div>
            </div>
            <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                className="field"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                autoFocus
                aria-label="6-digit check-in code"
                style={{
                  background: 'var(--ink-2)',
                  border: '1px solid var(--ink-4)',
                  color: '#fff',
                  textAlign: 'center',
                  fontFamily: 'var(--display)',
                  fontWeight: 800,
                  fontSize: 34,
                  letterSpacing: '0.35em',
                  padding: '18px 14px 18px 30px',
                }}
              />
              {error ? (
                <div
                  role="alert"
                  style={{
                    border: '1px solid var(--red-bright)',
                    background: 'rgba(166, 25, 46, 0.25)',
                    color: 'var(--red-soft-2)',
                    fontSize: 13,
                    lineHeight: 1.55,
                    padding: '12px 14px',
                  }}
                >
                  {error}
                </div>
              ) : null}
              <button
                type="submit"
                className="btn btn-bone btn-block"
                disabled={code.length !== 6 || submitting}
              >
                {submitting ? 'Verifying…' : 'Verify attendance'}
              </button>
            </form>
            <div style={{ fontSize: 12.5, color: 'var(--muted-3)', textAlign: 'center', lineHeight: 1.6 }}>
              The organizer's code rotates every 60 seconds. A code that has just been replaced is
              rejected.
            </div>
            <button type="button" className="btn btn-link" style={{ color: 'var(--gold-light)' }} onClick={onClear}>
              Pick a different event
            </button>
          </>
        )}
      </div>

      <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="note" style={{ padding: 24, fontSize: 14 }}>
          The code changes every 60 seconds and is derived from the event's stored secret, so a
          screenshot passed to a friend outside the venue expires before it can be used.
        </div>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Kicker>WHAT YOU GET</Kicker>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Icon name="school" size={22} color="var(--red)" />
            <span style={{ fontSize: 14 }}>Extra score, recorded by the teacher on AU Bounty</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Icon name="badge" size={22} color="var(--red)" />
            <span style={{ fontSize: 14 }}>Verified attendance on your public profile</span>
          </div>
          <div
            className="divider"
            style={{ paddingTop: 14, fontSize: 12.5, color: 'var(--muted-2)', lineHeight: 1.55 }}
          >
            Putting the score in the actual grade book is still the teacher's job. We do not touch
            the registrar.
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- organizer */

function OrganizerCheckin({ myEvents, eventId, onPick, onClear }) {
  const detail = useApi(
    () => (eventId ? api.get(`/tasks/${eventId}`) : Promise.resolve(null)),
    [eventId],
  )
  const { state, remaining, error, refetch } = useCheckinCode(eventId)
  const reloadTimer = useRef(null)

  const task = detail.data?.task ?? myEvents.find((t) => t.id === eventId) ?? null

  // Live seat/check-in changes: the socket only says "this task changed", so
  // the detail refetches (debounced, a door takes many codes at once).
  useEffect(() => {
    if (!eventId) return undefined
    subscribe({ taskId: eventId })
    return () => {
      clearTimeout(reloadTimer.current)
      unsubscribe({ taskId: eventId })
    }
  }, [eventId])

  useSocketEvent('task:updated', (payload) => {
    if (!payload || payload.taskId !== eventId) return
    clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => detail.reload(), 400)
  })

  if (!eventId) {
    return (
      <Picker kicker="YOUR EVENTS">
        {myEvents.length === 0 ? (
          <Empty>
            You have not posted an event yet.{' '}
            <Link to="/create" className="btn btn-link">
              Post one
            </Link>
            .
          </Empty>
        ) : (
          myEvents.map((t) => (
            <EventRow
              key={t.id}
              icon="event"
              title={t.title}
              meta={`${t.startsAt ? dateTime(t.startsAt) : 'Date to be announced'} · ${t.location.name} · ${t.takenCount}/${t.maxTakers} seats`}
              right={<span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Show code →</span>}
              onClick={() => onPick(t.id)}
            />
          ))
        )}
      </Picker>
    )
  }

  if (detail.loading || (detail.data === null && !detail.error)) return <Loading label="Loading event" />
  if (detail.error) return <ErrorState error={detail.error} onRetry={detail.reload} />
  if (!task) return <ErrorState error={{ message: 'Event not found.' }} onRetry={detail.reload} />

  const attendees = task.assignments ?? []
  const checkedInRows = attendees.filter((a) => isCheckedIn(a))
  const waitingRows = attendees.filter((a) => !isCheckedIn(a))
  const ordered = [...checkedInRows].sort(byCheckinTime).concat(waitingRows)
  const periodSeconds = state?.periodSeconds ?? 60
  const pct = Math.max(0, Math.min(100, (remaining / periodSeconds) * 100))

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div
        className="panel-dark"
        style={{ flex: '1 1 460px', padding: 34, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}
      >
        <Kicker gold>PROJECT THIS AT THE DOOR</Kicker>

        {error ? (
          <div style={{ width: '100%' }}>
            <ErrorState error={error} onRetry={refetch} />
            <button type="button" className="btn btn-link" style={{ marginTop: 12 }} onClick={onClear}>
              Pick another event
            </button>
          </div>
        ) : !state ? (
          <Loading label="Fetching the current code" />
        ) : (
          <>
            <div key={state.code} className="code-swap" style={{ width: '100%' }}>
              <div
                style={{
                  fontFamily: 'var(--display)',
                  fontWeight: 800,
                  fontSize: 92,
                  letterSpacing: '0.12em',
                  lineHeight: 1,
                  color: 'var(--gold-light)',
                }}
              >
                {state.code}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
                <QrCanvas value={state.code} size={168} />
              </div>
            </div>
            <div style={{ width: '100%' }}>
              <div style={{ height: 6, background: 'var(--ink-4)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: 'var(--gold)',
                    transition: 'width 0.5s linear',
                  }}
                />
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted-3)', marginTop: 12 }}>
                New code in {Math.max(0, Math.ceil(remaining))}s · attendees scan or type it
              </div>
            </div>
          </>
        )}

        <div style={{ fontSize: 13, color: 'var(--muted-3)' }}>
          {task.title} · {task.location.name}
        </div>
        <button type="button" className="btn btn-link" style={{ color: 'var(--gold-light)' }} onClick={onClear}>
          Pick another event
        </button>
      </div>

      {attendees.length ? (
        <div style={{ width: 340, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div className="card" style={{ flex: 1, padding: 20 }}>
              <div className="stat-num">{checkedInRows.length}</div>
              <div className="stat-cap">Checked in</div>
            </div>
            <div className="card" style={{ flex: 1, padding: 20 }}>
              <div className="stat-num">{task.takenCount}</div>
              <div className="stat-cap">Reserved</div>
            </div>
          </div>
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Kicker>ATTENDEES</Kicker>
            {ordered.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '11px 0',
                  borderBottom: '1px solid var(--line-3)',
                }}
              >
                <Avatar name={a.taker.name} size={32} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>
                  {a.taker.name}
                </span>
                {isCheckedIn(a) ? (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: 'var(--green)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Icon name="check_circle" size={15} color="var(--green)" />
                    {a.checkedInAt ? timeOnly(a.checkedInAt) : 'Checked in'}
                  </span>
                ) : (
                  <span style={{ fontSize: 11.5, color: 'var(--muted-3)', whiteSpace: 'nowrap' }}>
                    Not yet
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ screen */

export function Checkin() {
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'organizer' ? 'organizer' : 'attendee'
  const eventId = searchParams.get('event') || null

  const { data, error, loading, reload } = useApi(() => api.get('/me/tasks'), [])

  const pickEvent = (id) => setSearchParams({ event: id, mode })
  const clearEvent = () => setSearchParams({ mode })
  const switchMode = (next) => {
    const params = { mode: next }
    if (eventId) params.event = eventId
    setSearchParams(params)
  }

  if (loading) return <Loading label="Loading check-in" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const reserved = data.events ?? []
  const myEvents = (data.posted ?? []).filter((t) => t.type === 'EVENT')

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
          <h1 className="display">Check-in</h1>
          <p className="page-sub">Rotating attendance code, verified at the door.</p>
        </div>
        <div className="seg-row">
          <button className="seg" aria-pressed={mode === 'attendee'} onClick={() => switchMode('attendee')}>
            Attendee view
          </button>
          <button className="seg" aria-pressed={mode === 'organizer'} onClick={() => switchMode('organizer')}>
            Organizer view
          </button>
        </div>
      </div>

      {mode === 'attendee' ? (
        <AttendeeCheckin
          reserved={reserved}
          eventId={eventId}
          onPick={pickEvent}
          onClear={clearEvent}
          onCheckedIn={reload}
        />
      ) : (
        <OrganizerCheckin myEvents={myEvents} eventId={eventId} onPick={pickEvent} onClear={clearEvent} />
      )}
    </div>
  )
}
