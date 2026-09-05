import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { Empty, ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import { useToast } from '../components/Toast.jsx'
import { useSession } from '../session.jsx'
import { dateTime, relativeTime, rewardLabel } from '../lib/format.js'

/** Where the fallback form points when the device will not give a position. */
const CAMPUS_DEFAULT = { lat: 13.6146, lng: 100.7121 }

/** Same chip vocabulary the admin console uses, so one language everywhere. */
const ALERT_STATUS_STYLE = {
  ACTIVE: { background: 'var(--red)', color: '#fff' },
  RESOLVED: { background: 'var(--bone-2)', color: 'var(--green)' },
  FLAGGED: { background: 'var(--bone-2)', color: 'var(--muted)' },
}

const fmtCoords = (lat, lng) => `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`
const fmtCountdown = (seconds) =>
  seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : `${seconds}s`

export function Emergency() {
  const navigate = useNavigate()
  const { me } = useSession()
  const { flash } = useToast()

  const { data, error, loading, reload } = useApi(() => api.get('/tasks?type=EMERGENCY'), [])
  const {
    data: historyData,
    error: historyError,
    loading: historyLoading,
    reload: reloadHistory,
  } = useApi(() => api.get('/me/alerts'), [])

  // The button is a small machine: idle -> locating -> confirm -> sending -> sent,
  // with a manual-location detour when the browser refuses or fails geolocation.
  const [phase, setPhase] = useState('idle') // idle | locating | manual | confirm | sending | sent
  const [coords, setCoords] = useState(null) // { lat, lng, source: 'gps' | 'manual', accuracy? }
  const [manualLat, setManualLat] = useState(String(CAMPUS_DEFAULT.lat))
  const [manualLng, setManualLng] = useState(String(CAMPUS_DEFAULT.lng))
  const [manualError, setManualError] = useState(null)
  const [note, setNote] = useState('')
  const [sentSnapshot, setSentSnapshot] = useState(null) // the 201 body, before history catches up
  const [blockedId, setBlockedId] = useState(null) // 409 fallback if the history reload fails
  const [cooldownEndsAt, setCooldownEndsAt] = useState(null)
  const [now, setNow] = useState(Date.now())

  const historyAlerts = historyData?.alerts ?? []
  const activeAlert = historyAlerts.find((a) => a.status === 'ACTIVE') ?? (blockedId ? { id: blockedId } : null)
  // The success panel prefers the live history row (it tracks the forwarder) but
  // must render instantly from the POST response, before any reload lands.
  const sentAlert = (sentSnapshot && historyAlerts.find((a) => a.id === sentSnapshot.id)) || sentSnapshot
  const cooldownRemaining = cooldownEndsAt ? Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000)) : 0
  const busy = phase === 'locating' || phase === 'sending'
  const buttonLocked = Boolean(activeAlert) || cooldownRemaining > 0 || busy || phase !== 'idle'

  // Once history loads it is the truth about what is active; the 409 fallback
  // only has to survive until then.
  useEffect(() => {
    if (historyData) setBlockedId(null)
  }, [historyData])

  // One ticker while a cooldown runs; the button unlocks itself when it lifts.
  useEffect(() => {
    if (!cooldownEndsAt) return undefined
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [cooldownEndsAt])
  useEffect(() => {
    if (cooldownEndsAt && now >= cooldownEndsAt) setCooldownEndsAt(null)
  }, [now, cooldownEndsAt])

  // The forwarder runs after the 201 is already on its way back, so the panel
  // polls the history a few times until the badge flips to "sent to partner".
  const sentRef = useRef(null)
  useEffect(() => {
    sentRef.current = sentAlert ?? null
  }, [sentAlert])
  useEffect(() => {
    if (!sentSnapshot || sentSnapshot.forwardedToPeer) return undefined
    let tries = 0
    const t = setInterval(() => {
      if (sentRef.current?.forwardedToPeer || tries >= 10) {
        clearInterval(t)
        return
      }
      tries += 1
      reloadHistory()
    }, 4000)
    return () => clearInterval(t)
  }, [sentSnapshot, reloadHistory])

  const startManual = () => {
    setManualLat(String(CAMPUS_DEFAULT.lat))
    setManualLng(String(CAMPUS_DEFAULT.lng))
    setManualError(null)
    setCoords(null)
    setPhase('manual')
  }

  const press = () => {
    setNote('')
    setSentSnapshot(null)
    if (!('geolocation' in navigator)) {
      startManual()
      return
    }
    setPhase('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: 'gps',
          accuracy: pos.coords.accuracy ?? null,
        })
        setPhase('confirm')
      },
      // Denied, unavailable or the 8s timeout: same answer, the manual form.
      () => startManual(),
      { timeout: 8000, maximumAge: 30000, enableHighAccuracy: true },
    )
  }

  const continueManual = (e) => {
    e.preventDefault()
    const lat = Number.parseFloat(manualLat)
    const lng = Number.parseFloat(manualLng)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setManualError('Latitude must be -90 to 90 and longitude -180 to 180.')
      return
    }
    setCoords({ lat, lng, source: 'manual' })
    setPhase('confirm')
  }

  const cancelFlow = () => {
    setPhase('idle')
    setCoords(null)
    setNote('')
    setManualError(null)
  }

  const send = async () => {
    setPhase('sending')
    try {
      const trimmed = note.trim()
      const { alert } = await api.post('/alerts', {
        lat: coords.lat,
        lng: coords.lng,
        ...(trimmed ? { message: trimmed } : {}),
      })
      setSentSnapshot(alert)
      setCoords(null)
      setNote('')
      setPhase('sent')
      reloadHistory()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALERT_COOLDOWN') {
        const details = err.details ?? {}
        if (details.activeAlertId) setBlockedId(details.activeAlertId)
        if (details.retryAfterSeconds > 0) {
          setCooldownEndsAt(Date.now() + details.retryAfterSeconds * 1000)
          setNow(Date.now())
        }
        cancelFlow()
        reloadHistory()
        return
      }
      // Network drop or a 5xx: loud toast, and the confirm card stays up so the
      // Send button is the retry.
      flash(
        err instanceof ApiError && err.status < 500
          ? err.message
          : 'Could not reach the alert service. Check your connection and send again.',
        'error',
      )
      setPhase('confirm')
    }
  }

  return (
    <div style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 className="display">Emergency</h1>
        <p className="page-sub">
          The button sends an alert. Emergency tasks recruit people. They are separate on purpose.
        </p>
      </div>

      <div className="row">
        <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <AlertPanel
            phase={phase}
            busy={busy}
            buttonLocked={buttonLocked}
            activeAlert={activeAlert}
            cooldownRemaining={cooldownRemaining}
            coords={coords}
            note={note}
            setNote={setNote}
            manualLat={manualLat}
            manualLng={manualLng}
            setManualLat={setManualLat}
            setManualLng={setManualLng}
            manualError={manualError}
            sentAlert={sentAlert}
            meName={me?.name}
            onPress={press}
            onContinueManual={continueManual}
            onCancel={cancelFlow}
            onSend={send}
            onDone={() => {
              setSentSnapshot(null)
              setPhase('idle')
            }}
            onRetryLocation={() => {
              cancelFlow()
              press()
            }}
            onPostTask={() => navigate('/create')}
          />
          <MyAlerts
            alerts={historyAlerts}
            loading={historyLoading}
            error={historyError}
            onRetry={reloadHistory}
          />
        </div>

        <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Kicker>LIVE EMERGENCY TASKS</Kicker>
          {loading ? <Loading label="Loading emergencies" /> : null}
          {error ? <ErrorState error={error} onRetry={reload} /> : null}
          {data?.tasks?.length === 0 ? <Empty>No open emergency tasks right now.</Empty> : null}
          {data?.tasks?.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/tasks/${t.id}`)}
              className="card"
              style={{
                textAlign: 'left',
                borderLeft: '3px solid var(--red)',
                padding: 22,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                font: 'inherit',
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--red)' }}>
                {relativeTime(t.createdAt).toUpperCase()}
              </span>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18 }}>{t.title}</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>
                {t.location.name} · {rewardLabel(t.reward)} · {t.poster.name}
              </span>
            </button>
          ))}
          <div className="note-quiet">
            This list is real, straight from the tasks API. Pushing new emergencies to everyone
            online without a refresh needs websockets, which land with the realtime layer.
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------- the alert panel */

function BigButton({ phase, disabled, onPress }) {
  const busy = phase === 'locating' || phase === 'sending'
  const label = phase === 'locating' ? 'LOCATING…' : phase === 'sending' ? 'SENDING…' : 'SEND ALERT'
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      aria-busy={phase === 'locating' || phase === 'sending'}
      className={phase === 'idle' && !disabled ? 'alert-pulse' : undefined}
      style={{
        width: 190,
        height: 190,
        borderRadius: '50%',
        background: disabled ? 'var(--red-dark)' : 'var(--red)',
        border: '6px solid var(--red-dark)',
        color: '#fff',
        fontFamily: 'var(--display)',
        fontWeight: 800,
        fontSize: 17,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: disabled ? 0.8 : 1,
      }}
    >
      <Icon
        name={phase === 'locating' || phase === 'sending' ? 'progress_activity' : 'emergency'}
        size={48}
        style={busy ? { animation: 'spin 1s linear infinite' } : undefined}
      />
      {label}
    </button>
  )
}

function AlertPanel(props) {
  const {
    phase,
    busy,
    buttonLocked,
    activeAlert,
    cooldownRemaining,
    coords,
    note,
    setNote,
    manualLat,
    manualLng,
    setManualLat,
    setManualLng,
    manualError,
    sentAlert,
    meName,
    onPress,
    onContinueManual,
    onCancel,
    onSend,
    onDone,
    onRetryLocation,
    onPostTask,
  } = props

  return (
    <div className="panel-dark" style={{ padding: 34 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
        <Kicker gold>CAMPUS ALERT BUTTON</Kicker>

        {phase === 'manual' ? (
          <ManualLocationForm
            lat={manualLat}
            lng={manualLng}
            setLat={setManualLat}
            setLng={setManualLng}
            error={manualError}
            onContinue={onContinueManual}
            onCancel={onCancel}
          />
        ) : phase === 'confirm' ? (
          <ConfirmCard
            coords={coords}
            note={note}
            setNote={setNote}
            meName={meName}
            onSend={onSend}
            onCancel={onCancel}
          />
        ) : phase === 'sent' ? (
          <SentPanel alert={sentAlert} onDone={onDone} />
        ) : (
          <>
            <BigButton phase={phase} disabled={busy || buttonLocked} onPress={onPress} />
            {activeAlert ? (
              <BlockedNote remaining={cooldownRemaining} />
            ) : cooldownRemaining > 0 ? (
              <CooldownNote remaining={cooldownRemaining} />
            ) : (
              <div
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: 'var(--muted-3)',
                  textAlign: 'center',
                  maxWidth: 330,
                }}
              >
                Sends your identity, location and time to the SL Systems campus alert service. Your
                browser will ask for location; if it cannot get one you type it in. It does not
                create a task, because a distress signal with no details makes a useless task. One
                active alert per person, with a cooldown between presses.
              </div>
            )}
          </>
        )}
        <button
          className="btn btn-outline-dark btn-block"
          onClick={() => (phase === 'manual' ? onRetryLocation() : onPostTask())}
        >
          {phase === 'manual' ? 'Try device location again' : 'Post an emergency task instead'}
        </button>
      </div>
    </div>
  )
}

/** Denied or unavailable GPS: a small form on the campus default, user-adjusted. */
function ManualLocationForm({ lat, lng, setLat, setLng, error, onContinue, onCancel }) {
  return (
    <form
      className="card"
      style={{ padding: 24, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 13 }}
      onSubmit={onContinue}
    >
      <div style={{ fontWeight: 700, fontSize: 14.5 }}>Location unavailable</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>
        The browser could not get your position. Check these coordinates point at where you are,
        then continue. You confirm once more before anything is sent.
      </div>
      <label className="label" style={{ marginBottom: 0 }}>
        Latitude
      </label>
      <input
        className="field"
        inputMode="decimal"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
        aria-label="Latitude"
      />
      <label className="label" style={{ marginBottom: 0 }}>
        Longitude
      </label>
      <input
        className="field"
        inputMode="decimal"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
        aria-label="Longitude"
      />
      {error ? (
        <div style={{ fontSize: 12.5, color: 'var(--red)', fontWeight: 700 }} role="alert">
          {error}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 9 }}>
        <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
          Continue
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** The mandatory second look: coords + note + who the partner will see. */
function ConfirmCard({ coords, note, setNote, meName, onSend, onCancel }) {
  return (
    <div
      className="card"
      style={{ padding: 24, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 13 }}
    >
      <div style={{ fontWeight: 700, fontSize: 14.5 }}>Check before you send</div>
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <dt style={{ color: 'var(--muted-2)', width: 78, flex: '0 0 auto' }}>Location</dt>
          <dd style={{ margin: 0, fontWeight: 700 }}>
            {fmtCoords(coords.lat, coords.lng)}
            <span style={{ fontWeight: 400, color: 'var(--muted)' }}>
              {coords.source === 'gps'
                ? coords.accuracy
                  ? ` · from your device, ~${Math.round(coords.accuracy)} m`
                  : ' · from your device'
                : ' · entered manually'}
            </span>
          </dd>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <dt style={{ color: 'var(--muted-2)', width: 78, flex: '0 0 auto' }}>From</dt>
          <dd style={{ margin: 0 }}>
            {meName || 'You'} · campus safety sees who sent this
          </dd>
        </div>
      </dl>
      <label className="label" style={{ marginBottom: 0 }}>
        Optional note
      </label>
      <textarea
        className="field"
        rows={2}
        maxLength={500}
        placeholder="e.g. Ground floor, near the north exit"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 9 }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={onSend}>
          Send alert
        </button>
        <button className="btn btn-outline btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function SentPanel({ alert, onDone }) {
  return (
    <div
      className="card"
      style={{ padding: 24, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 13 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name="check_circle" size={22} color="var(--green)" />
        <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 16.5 }}>
          Alert sent to campus safety partners
        </span>
      </div>
      {alert ? (
        <>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {fmtCoords(alert.lat, alert.lng)} · {dateTime(alert.createdAt)}
          </div>
          {alert.message ? (
            <div style={{ fontSize: 13.5, color: 'var(--ink-4)', fontStyle: 'italic' }}>“{alert.message}”</div>
          ) : null}
          <ForwardedChip forwarded={alert.forwardedToPeer} />
        </>
      ) : null}
      <button className="btn btn-outline btn-sm" onClick={onDone}>
        Done
      </button>
    </div>
  )
}

/** Matches the admin console: "sent to partner" once acknowledged, else "retrying". */
function ForwardedChip({ forwarded }) {
  return (
    <span
      className="chip"
      style={
        forwarded
          ? { background: 'var(--gold-wash)', color: 'var(--gold-ink)' }
          : { background: 'var(--red-wash)', color: 'var(--red)' }
      }
      title={
        forwarded
          ? 'The peer partner acknowledged this alert.'
          : 'The peer partner has not acknowledged it yet; delivery keeps retrying.'
      }
    >
      <Icon name={forwarded ? 'send' : 'sync'} size={13} />
      {forwarded ? 'sent to partner' : 'retrying'}
    </span>
  )
}

function BlockedNote({ remaining = 0 }) {
  return (
    <div className="note" style={{ maxWidth: 360, textAlign: 'left', padding: 16 }} role="status">
      Your previous alert is still <strong>active</strong>. A campus safety admin has to resolve it
      before the button unlocks; until then a new alert cannot be sent.{' '}
      <a href="#my-alerts">View my alerts</a>.
      {remaining > 0 ? (
        <div style={{ marginTop: 7 }}>Cooldown after that: {fmtCountdown(remaining)}.</div>
      ) : null}
    </div>
  )
}

function CooldownNote({ remaining }) {
  return (
    <div style={{ fontSize: 13.5, color: 'var(--red-soft)', textAlign: 'center', maxWidth: 330 }} role="status">
      Cooldown active. The button unlocks in <strong>{fmtCountdown(remaining)}</strong>. This keeps
      one incident to one alert.
    </div>
  )
}

/* ------------------------------------------------------------ my alerts */

function MyAlerts({ alerts, loading, error, onRetry }) {
  return (
    <section id="my-alerts" style={{ display: 'flex', flexDirection: 'column', gap: 13, scrollMarginTop: 90 }}>
      <Kicker>MY ALERTS</Kicker>
      {loading ? <Loading label="Loading your alerts" /> : null}
      {error ? <ErrorState error={error} onRetry={onRetry} /> : null}
      {!loading && !error && alerts.length === 0 ? (
        <div className="note-quiet">You have never pressed the button. May it stay that way.</div>
      ) : null}
      {alerts.map((a) => (
        <div key={a.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{dateTime(a.createdAt)}</span>
            <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>{relativeTime(a.createdAt)}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <span className="chip" style={ALERT_STATUS_STYLE[a.status]}>
                {a.status}
              </span>
              <ForwardedChip forwarded={a.forwardedToPeer} />
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fmtCoords(a.lat, a.lng)}</div>
          {a.message ? (
            <div style={{ fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}>“{a.message}”</div>
          ) : null}
        </div>
      ))}
    </section>
  )
}
