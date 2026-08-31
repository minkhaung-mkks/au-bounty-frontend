import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { useSession } from '../session.jsx'
import { Avatar, ErrorState, Icon, Loading } from '../components/ui.jsx'

const TRUST = [
  ['verified_user', 'Real ABAC identities only'],
  ['reviews', 'Double-blind reviews'],
  ['qr_code_2', 'QR-verified attendance'],
]

export function Login() {
  const navigate = useNavigate()
  const { signIn } = useSession()
  const { data, error, loading, reload } = useApi(() => api.get('/dev/users'), [])

  const pick = async (id) => {
    await signIn(id)
    navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bone)' }}>
      <div
        style={{
          flex: 1.1,
          background: 'var(--red)',
          color: '#fff',
          padding: '68px 72px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
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
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'var(--red-dark)',
              boxShadow: 'inset 0 0 0 4px var(--bone), inset 0 0 0 7px var(--gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 17,
            }}
          >
            AU
          </div>
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
          <h1
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 66,
              lineHeight: 0.96,
              letterSpacing: '-0.04em',
              margin: 0,
            }}
          >
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

        <div
          style={{
            display: 'flex',
            gap: 34,
            position: 'relative',
            fontSize: 13,
            color: 'var(--red-soft-2)',
            flexWrap: 'wrap',
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

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 60,
        }}
      >
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <h2 className="display" style={{ fontSize: 34 }}>
              Sign in
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--muted)', margin: '10px 0 0' }}>
              Microsoft sign-in lands next. Until then, pick one of the seeded accounts. Each one has
              a different role, so you can see what every role is allowed to do.
            </p>
          </div>

          {loading ? <Loading label="Loading accounts" /> : null}
          {error ? <ErrorState error={error} onRetry={reload} /> : null}

          {data ? (
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
                      {u.role}
                      {u.orgs.length ? ` · ${u.orgs.map((o) => o.name).join(', ')}` : ''}
                      {u.universityId ? ` · ${u.universityId}` : ''}
                    </span>
                  </span>
                  <Icon name="arrow_forward" size={18} color="var(--red)" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="note-quiet">
            No passwords, no tokens. The chosen account id goes in localStorage and rides along on
            every request as a header, which one middleware on the server turns into the current
            user. Swapping that for a real ABAC login touches one file.
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>CSX4110 · Section 542 · v0.5</div>
        </div>
      </div>
    </div>
  )
}
