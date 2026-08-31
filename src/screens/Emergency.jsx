import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { Empty, ErrorState, Icon, Kicker, Loading, StubBanner } from '../components/ui.jsx'
import { relativeTime, rewardLabel } from '../lib/format.js'

export function Emergency() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useApi(() => api.get('/tasks?type=EMERGENCY'), [])

  return (
    <div style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 className="display">Emergency</h1>
        <p className="page-sub">
          The button sends an alert. Emergency tasks recruit people. They are separate on purpose.
        </p>
      </div>

      <div className="row">
        {/* The button is display-only in v0.5: the alert row, the cooldown rule and
            the call out to the partner's system all land together. */}
        <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <StubBanner>The alert button writes nothing yet and calls no partner system.</StubBanner>
          <div className="panel-dark" style={{ padding: 34 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
              <Kicker gold>CAMPUS ALERT BUTTON</Kicker>
              <button
                disabled
                style={{
                  width: 190,
                  height: 190,
                  borderRadius: '50%',
                  background: 'var(--red)',
                  border: '6px solid var(--red-dark)',
                  color: '#fff',
                  fontFamily: 'var(--display)',
                  fontWeight: 800,
                  fontSize: 17,
                  cursor: 'not-allowed',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: 0.75,
                }}
              >
                <Icon name="emergency" size={48} />
                SEND ALERT
              </button>
              <div
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: 'var(--muted-3)',
                  textAlign: 'center',
                  maxWidth: 330,
                }}
              >
                When this is wired it sends your identity, location and time to the SL Systems campus
                alert service. It does not create a task, because a distress signal with no details
                makes a useless task. One active alert per person, with a cooldown between presses.
              </div>
              <button className="btn btn-outline-dark btn-block" onClick={() => navigate('/create')}>
                Post an emergency task instead
              </button>
            </div>
          </div>
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
