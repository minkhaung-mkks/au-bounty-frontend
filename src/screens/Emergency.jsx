import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { Empty, ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import { useToast } from '../components/Toast.jsx'
import { useSession } from '../session.jsx'
import {
  ALERT_STATUS_LABEL,
  ALERT_STATUS_STYLE,
  CAMPUS_DEFAULT,
  dateTime,
  formatCoords,
  labelOf,
  relativeTime,
  rewardLabel,
  validateCoords,
} from '../lib/format.js'

/** Said the same way wherever the forwarder's state is shown. */
const FORWARD_NOTE = {
  yes: 'The peer partner acknowledged this alert.',
  no: 'The peer partner has not acknowledged it yet; delivery keeps retrying.',
}

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
    // The shared validator lets both fields be blank, which means "no location"
    // on the create form. An alert without a position is not an alert, so here
    // blank is its own refusal before the ranges are checked.
    const problem =
      manualLat.trim() === '' || manualLng.trim() === ''
        ? 'Enter both latitude and longitude as numbers.'
        : validateCoords(manualLat, manualLng)
    if (problem) {
      setManualError(problem)
      return
    }
    setCoords({
      lat: Number.parseFloat(manualLat),
      lng: Number.parseFloat(manualLng),
      source: 'manual',
    })
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
        // Without a countdown or an active id there is no note to fall back on,
        // and the flow would reset to idle as if nothing had been pressed. Say
        // outright that the alert did not send.
        flash(
          err.message || 'Alert not sent. Your previous alert is still active.',
          'error',
        )
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
          The button sends an alert to campus safety. Emergency tasks recruit people to help.
        </p>
      </div>

      <div className="row">
        <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <AlertPanel
            phase={phase}
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
              className="task-card accent-emergency"
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
            New emergencies appear when you refresh this page.
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------- the alert panel */

function BigButton({ phase, disabled, onPress, blockReason, blockReasonId }) {
  const busy = phase === 'locating' || phase === 'sending'
  const label = phase === 'locating' ? 'Locating…' : phase === 'sending' ? 'Sending…' : 'Send alert'
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      aria-busy={phase === 'locating' || phase === 'sending'}
      // A disabled button that says nothing is a dead end: the note explaining
      // the block is the button's own description, and its name carries it too.
      aria-describedby={blockReason ? blockReasonId : undefined}
      aria-label={blockReason ? `Send alert, unavailable. ${blockReason}` : undefined}
      className={phase === 'idle' && !disabled ? 'alert-pulse' : undefined}
      style={{
        width: 190,
        maxWidth: '100%',
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
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {/* The class goes on a wrapper because Icon spreads extra props over its
          own className, and losing that class loses the icon font. */}
      <span className={busy ? 'spin' : undefined} style={{ display: 'inline-flex', lineHeight: 0 }}>
        <Icon
          name={phase === 'locating' || phase === 'sending' ? 'progress_activity' : 'emergency'}
          size={48}
        />
      </span>
      {label}
    </button>
  )
}

function AlertPanel(props) {
  const {
    phase,
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

  // Why the button will not go, in one sentence the button itself can point at.
  const blockReason = activeAlert
    ? 'Your previous alert is still active and has to be resolved first.'
    : cooldownRemaining > 0
      ? `Cooldown active. The button unlocks in ${fmtCountdown(cooldownRemaining)}.`
      : null

  return (
    <div className="panel-dark" style={{ padding: 28 }}>
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
            phase={phase}
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
            <BigButton
              phase={phase}
              disabled={buttonLocked}
              onPress={onPress}
              blockReason={blockReason}
              blockReasonId="alert-block-reason"
            />
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
                Sends your name, location and the time to campus safety. Your browser will ask for
                your location; if it cannot get one, you type it in. One active alert at a time.
              </div>
            )}
          </>
        )}
        {/* Only where leaving is harmless: mid-request or on the confirmation
            it would navigate away from an alert the user still needs to see. */}
        {phase === 'idle' || phase === 'manual' ? (
          <button
            className="btn btn-outline-dark btn-block"
            onClick={() => (phase === 'manual' ? onRetryLocation() : onPostTask())}
          >
            {phase === 'manual' ? 'Try device location again' : 'Post an emergency task instead'}
          </button>
        ) : null}
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
      <label className="label" style={{ marginBottom: 0 }} htmlFor="alert-lat">
        Latitude
      </label>
      <input
        id="alert-lat"
        className="field"
        inputMode="decimal"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
      />
      <label className="label" style={{ marginBottom: 0 }} htmlFor="alert-lng">
        Longitude
      </label>
      <input
        id="alert-lng"
        className="field"
        inputMode="decimal"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
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
function ConfirmCard({ phase, coords, note, setNote, meName, onSend, onCancel }) {
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
            {formatCoords(coords.lat, coords.lng)}
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
      <label className="label" style={{ marginBottom: 0 }} htmlFor="alert-note">
        Optional note
      </label>
      <textarea
        id="alert-note"
        className="field"
        rows={2}
        maxLength={500}
        placeholder="e.g. Ground floor, near the north exit"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 9 }}>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1 }}
          disabled={phase === 'sending'}
          onClick={onSend}
        >
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
            {formatCoords(alert.lat, alert.lng)} · {dateTime(alert.createdAt)}
          </div>
          {alert.message ? (
            <div style={{ fontSize: 13.5, color: 'var(--ink-4)', fontStyle: 'italic' }}>“{alert.message}”</div>
          ) : null}
          <ForwardedChip forwarded={alert.forwardedToPeer} explain />
        </>
      ) : null}
      <button className="btn btn-outline btn-sm" onClick={onDone}>
        Done
      </button>
    </div>
  )
}

/** Matches the admin console: "Sent to partner" once acknowledged, else "Retrying". */
function ForwardedChip({ forwarded, explain = false }) {
  const chip = (
    <span className={`chip ${forwarded ? 'chip-reward' : 'chip-request'}`}>
      <Icon name={forwarded ? 'send' : 'sync'} size={13} />
      {forwarded ? 'Sent to partner' : 'Retrying'}
    </span>
  )
  // Where there is room, the sentence sits beside the chip: a title attribute
  // reaches neither a touch screen nor a keyboard.
  if (!explain) return chip
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
      {chip}
      <span style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>
        {forwarded ? FORWARD_NOTE.yes : FORWARD_NOTE.no}
      </span>
    </div>
  )
}

function BlockedNote({ remaining = 0 }) {
  return (
    <div
      id="alert-block-reason"
      className="note-quiet"
      style={{ maxWidth: 360, textAlign: 'left' }}
      role="status"
    >
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
    <div
      id="alert-block-reason"
      style={{ fontSize: 13.5, color: 'var(--red-soft-2)', textAlign: 'center', maxWidth: 330 }}
      role="status"
    >
      Cooldown active. The button unlocks in <strong>{fmtCountdown(remaining)}</strong>. This keeps
      one incident to one alert.
    </div>
  )
}

/* ------------------------------------------------------------ my alerts */

function MyAlerts({ alerts, loading, error, onRetry }) {
  // Repolled every 4s while the forwarder catches up, so the chip flipping from
  // Retrying to Sent to partner is announced rather than just redrawn.
  return (
    <section
      id="my-alerts"
      aria-live="polite"
      style={{ display: 'flex', flexDirection: 'column', gap: 13, scrollMarginTop: 90 }}
    >
      <Kicker>MY ALERTS</Kicker>
      {loading ? <Loading label="Loading your alerts" /> : null}
      {error ? <ErrorState error={error} onRetry={onRetry} /> : null}
      {!loading && !error && alerts.length === 0 ? (
        <div className="note-quiet">No alerts sent.</div>
      ) : null}
      {alerts.map((a) => (
        <div key={a.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{dateTime(a.createdAt)}</span>
            <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>{relativeTime(a.createdAt)}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <span className="chip" style={ALERT_STATUS_STYLE[a.status]}>
                {labelOf(ALERT_STATUS_LABEL, a.status)}
              </span>
              <ForwardedChip forwarded={a.forwardedToPeer} />
            </span>
          </div>
          {!a.forwardedToPeer ? (
            <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>{FORWARD_NOTE.no}</div>
          ) : null}
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{formatCoords(a.lat, a.lng)}</div>
          {a.message ? (
            <div style={{ fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}>“{a.message}”</div>
          ) : null}
        </div>
      ))}
    </section>
  )
}
