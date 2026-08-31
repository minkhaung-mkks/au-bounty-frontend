import { useSession } from '../session.jsx'
import { Icon, Kicker, StubBanner } from '../components/ui.jsx'

const ALERTS = [
  { name: 'Student Five', meta: '14:22 · car park · forwarded to SL Systems', status: 'ACTIVE' },
  { name: 'Student Six', meta: '14:05 · library · third press today, cooldown violated', status: 'ACTIVE' },
]

const PEOPLE = [
  { name: 'Student Five', detail: 'STUDENT · requested Teacher', action: 'Make Teacher' },
  { name: 'Student Six', detail: 'STUDENT · no organization', action: 'Add to Organization A' },
  { name: 'Partner Alert System', detail: 'SERVICE · peer API key, no interactive login', action: 'Rotate key' },
]

export function Admin() {
  const { me } = useSession()

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
    <div style={{ maxWidth: 1240, display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <h1 className="display">Admin console</h1>
        <p className="page-sub">Alerts, roles, organizations and review moderation.</p>
      </div>

      <StubBanner>
        Designed, not wired. Every row here is hardcoded and every button is inert.
      </StubBanner>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <Kicker>EMERGENCY ALERTS</Kicker>
        {ALERTS.map((a) => (
          <div
            key={a.name}
            className="card"
            style={{
              borderLeft: '3px solid var(--red)',
              padding: 22,
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 17 }}>{a.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 4 }}>{a.meta}</div>
            </div>
            <span className="chip">{a.status}</span>
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="btn btn-dark btn-sm" disabled>
                Resolve
              </button>
              <button className="btn btn-outline btn-sm" disabled>
                Flag false alarm
              </button>
            </div>
          </div>
        ))}
      </section>

      <div className="row">
        <section style={{ flex: '1 1 520px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Kicker>ROLES &amp; ORGANIZATIONS</Kicker>
          <div className="card">
            {PEOPLE.map((p) => (
              <div
                key={p.name}
                style={{
                  padding: '18px 22px',
                  borderBottom: '1px solid var(--line-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>{p.detail}</div>
                </div>
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--red)' }} disabled>
                  {p.action}
                </button>
              </div>
            ))}
            <div style={{ padding: '16px 22px', fontSize: 12.5, color: 'var(--muted-2)', lineHeight: 1.55 }}>
              Org membership is not a role. A member stays a Student and gets org powers through the
              membership record, which also says which org they can act for.
            </div>
          </div>
        </section>

        <section style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Kicker>REVIEW MODERATION</Kicker>
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-4)', fontStyle: 'italic' }}>
              "Showed up late and then ████ ███ ████."
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>
              Reported by 2 users · the 2★ rating stays counted either way
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled>
                Remove abusive text
              </button>
              <button className="btn btn-outline btn-sm" style={{ flex: 1 }} disabled>
                Keep as is
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-2)', lineHeight: 1.55 }}>
              The schema already carries the flag this writes: <code>Review.textHidden</code> blanks
              the wording while the rating keeps counting.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
