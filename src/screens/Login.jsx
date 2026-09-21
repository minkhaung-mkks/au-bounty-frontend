import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { useSession } from '../session.jsx'
import { Avatar, ErrorState, Icon, Loading, Mark } from '../components/ui.jsx'
import { ROLE_LABEL } from '../lib/format.js'

const TRUST = [
  ['verified_user', 'Real ABAC identities only'],
  ['reviews', 'Double-blind reviews'],
  ['qr_code_2', 'QR-verified attendance'],
]

/** The four-square Microsoft mark, drawn in CSS so no dependency or asset is needed. */
const MicrosoftMark = ({ size = 18 }) => (
  <span
    style={{
      display: 'inline-grid',
      gridTemplateColumns: '1fr 1fr',
      width: size,
      height: size,
      gap: Math.max(1, Math.round(size / 9)),
      flex: '0 0 auto',
    }}
    aria-hidden="true"
  >
    {['#f25022', '#7fba00', '#00a4ef', '#ffb900'].map((c) => (
      <span key={c} style={{ background: c }} />
    ))}
  </span>
)

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signInWithMicrosoft, devAuth } = useSession()
  // /dev/users only exists while the backend runs with dev auth enabled.
  const { data, error, loading, reload } = useApi(
    () => (devAuth ? api.get('/dev/users') : Promise.resolve(null)),
    [devAuth],
  )

  // Where RequireUser intercepted the user from, so sign-in ends there.
  // RequireUser stores path and query; accept a location object too.
  const from = location.state?.from
  const intendedPath =
    (typeof from === 'string' ? from : from && `${from.pathname ?? ''}${from.search ?? ''}`) || '/'

  const pick = async (id) => {
    await signIn(id)
    navigate(intendedPath)
  }

  return (
    <div className="login-split">
      <div className="login-hero">
        <div
          style={{
            position: 'absolute',
            width: 760,
            height: 760,
            borderRadius: '50%',
            border: '1px solid rgba(250,246,240,.13)',
            top: -260,
            right: -300,
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 480,
            height: 480,
            borderRadius: '50%',
            border: '1px solid rgba(250,246,240,.13)',
            top: -120,
            right: -180,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <Mark size={50} onRed />
          <span
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: '-0.02em',
            }}
          >
            AU Bounty
          </span>
        </div>

        <div style={{ position: 'relative', maxWidth: 560 }}>
          <h1 className="login-title">
            Small problems.
            <br />
            Fast answers.
            <br />
            Real credit.
          </h1>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: 'var(--red-soft)',
              margin: '26px 0 0',
              maxWidth: 480,
              textWrap: 'pretty',
            }}
          >
            Post what you need and set your own reward. Help someone out and build a record you can
            hand to a recruiter. Orgs and teachers post events with extra score, verified at the door.
          </p>
        </div>

        {/* Stacked, not wrapped: three assurances in a row broke 2+1 at laptop
            widths and left the third orphaned on its own line. One per line
            reads as a deliberate list at every width. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 13,
            position: 'relative',
            fontSize: 13,
            color: 'var(--red-soft-2)',
          }}
        >
          {TRUST.map(([icon, label]) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Icon name={icon} size={17} color="var(--gold-light)" />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="login-panel">
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <h2 className="display" style={{ fontSize: 34 }}>
              Sign in
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--muted)', margin: '10px 0 0' }}>
              {devAuth
                ? 'Pick one of the seeded accounts.'
                : 'Use your ABAC Microsoft account. You will be sent to the university sign-in page and brought straight back to where you were.'}
            </p>
          </div>

          {!devAuth ? (
            <button
              className="btn btn-primary"
              style={{ padding: '15px 18px', gap: 11 }}
              onClick={() => signInWithMicrosoft(intendedPath)}
            >
              <MicrosoftMark size={19} />
              Sign in with your ABAC Microsoft account
            </button>
          ) : null}

          {devAuth && loading ? <Loading label="Loading accounts" /> : null}
          {devAuth && error ? <ErrorState error={error} onRetry={reload} /> : null}

          {devAuth && data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => pick(u.id)}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                  }}
                >
                  <Avatar name={u.name} size={42} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15 }}>
                      {u.name}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>
                      {ROLE_LABEL[u.role] ?? u.role}
                      {u.orgs.length ? ` · ${u.orgs.map((o) => o.name).join(', ')}` : ''}
                      {u.universityId ? ` · ${u.universityId}` : ''}
                    </span>
                  </span>
                  <Icon name="arrow_forward" size={18} color="var(--red)" />
                </button>
              ))}
            </div>
          ) : null}

          <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>CSX4110 · Section 542 · v0.5</div>
        </div>
      </div>
    </div>
  )
}
