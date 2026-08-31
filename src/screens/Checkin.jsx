import { useEffect, useState } from 'react'
import { Icon, Kicker, StubBanner } from '../components/ui.jsx'

// Display only. The real thing derives the code from the event's checkinSecret
// and the current 60-second window, server-side, and validates it on POST.
const FAKE_CODE = '7429'
const FEED = [
  { name: 'Student Five', time: '13:28' },
  { name: 'Student Six', time: '13:27' },
  { name: 'Org Member Two', time: '13:26' },
]

export function Checkin() {
  const [view, setView] = useState('Attendee')
  const [secs, setSecs] = useState(41)

  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s > 1 ? s - 1 : 60)), 1000)
    return () => clearInterval(t)
  }, [])

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
          <p className="page-sub">Rotating attendance code, shown at the door.</p>
        </div>
        <div className="seg-row">
          {['Attendee', 'Organizer'].map((v) => (
            <button key={v} className="seg" aria-pressed={view === v} onClick={() => setView(v)}>
              {v} view
            </button>
          ))}
        </div>
      </div>

      <StubBanner>
        The code below is a fixed placeholder and the countdown is cosmetic. Nothing is verified.
      </StubBanner>

      {view === 'Attendee' ? (
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
            <Kicker gold>SHOW AT THE DOOR</Kicker>
            <div
              style={{
                width: 250,
                height: 250,
                background: '#fff',
                padding: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="qr_code_2" size={190} color="var(--ink)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'var(--display)',
                  fontWeight: 800,
                  fontSize: 46,
                  letterSpacing: '0.14em',
                  color: 'var(--gold-light)',
                }}
              >
                {FAKE_CODE}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted-3)', marginTop: 6 }}>
                Would rotate in {secs}s
              </div>
            </div>
            <button className="btn btn-bone btn-block" disabled>
              Enter code manually
            </button>
          </div>

          <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="note" style={{ padding: 24, fontSize: 14 }}>
              The real code changes every 60 seconds and is derived from the event's stored secret,
              so it survives a server restart and a screenshot passed to a friend outside the venue
              expires before it can be used.
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
      ) : (
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="panel-dark" style={{ flex: '1 1 460px', padding: 34, textAlign: 'center' }}>
            <Kicker gold>PROJECT THIS ON THE SCREEN</Kicker>
            <div
              style={{
                fontFamily: 'var(--display)',
                fontWeight: 800,
                fontSize: 96,
                letterSpacing: '0.12em',
                marginTop: 14,
                lineHeight: 1,
              }}
            >
              {FAKE_CODE}
            </div>
            <div style={{ height: 6, background: 'var(--ink-4)', marginTop: 22, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round((secs / 60) * 100)}%`, background: 'var(--gold)' }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted-3)', marginTop: 12 }}>
              Only the event owner, their org, or an admin will be able to open this
            </div>
          </div>
          <div style={{ width: 340, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div className="card" style={{ flex: 1, padding: 20 }}>
                <div className="stat-num">38</div>
                <div className="stat-cap">Checked in</div>
              </div>
              <div className="card" style={{ flex: 1, padding: 20 }}>
                <div className="stat-num">43</div>
                <div className="stat-cap">Reserved</div>
              </div>
            </div>
            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Kicker>LIVE FEED</Kicker>
              {FEED.map((f) => (
                <div
                  key={f.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    paddingBottom: 10,
                    borderBottom: '1px solid var(--line-3)',
                  }}
                >
                  <Icon name="check" size={18} color="var(--green)" />
                  <span style={{ flex: 1, fontSize: 13.5 }}>{f.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-3)' }}>{f.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
