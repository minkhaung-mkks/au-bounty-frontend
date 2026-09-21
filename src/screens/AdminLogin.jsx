import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../session.jsx'
import { BrandMark, Icon } from '../components/ui.jsx'

/**
 * The console's own sign-in, at /admin-login. Nothing in the app links here:
 * it is reached by typing the URL, which is why the page carries none of the
 * shell's chrome and never appears in the nav.
 *
 * Not being linked is convenience, not protection — the password and the ADMIN
 * role check on the server are what actually keep people out.
 *
 * One sheet on the bone ground, the way every other form in the app is drawn.
 * The login hero's full-bleed red is that screen's one sanctioned exception and
 * does not travel here; a moderator signing in is an ordinary, quiet act.
 */
export function AdminLogin() {
  const navigate = useNavigate()
  const { signInWithPassword } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signInWithPassword(email, password)
      navigate('/admin', { replace: true })
    } catch (err) {
      // The server answers every rejection with the same message on purpose;
      // showing it verbatim keeps the throttle's "try again in N minutes"
      // readable without the form guessing at what went wrong.
      setError(err.message || 'Sign-in failed.')
      setPassword('')
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bone-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px 60px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18 }}>
          {/* On bone the badge takes the control-grey edge instead of the
              hairline white that carries it on ink. */}
          <BrandMark size={38} onDark={false} />
          <span
            style={{
              fontFamily: 'var(--display)',
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: '-0.02em',
            }}
          >
            AU Bounty
          </span>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div className="label" style={{ color: 'var(--gold)', letterSpacing: '0.12em' }}>
            ADMIN CONSOLE
          </div>
          <h1 className="display" style={{ fontSize: 30, margin: 0 }}>
            Sign in
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: 'var(--muted)',
              margin: '9px 0 0',
            }}
          >
            For the accounts that moderate the board. Everyone else signs in with Microsoft on the
            main page.
          </p>

          <form
            onSubmit={submit}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 22 }}
            noValidate
          >
            <div>
              <label className="label" htmlFor="admin-email" style={{ display: 'block' }}>
                EMAIL
              </label>
              <input
                id="admin-email"
                className="field"
                type="email"
                name="email"
                autoComplete="username"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin.one@au.edu"
              />
            </div>

            <div>
              <label className="label" htmlFor="admin-password" style={{ display: 'block' }}>
                PASSWORD
              </label>
              <input
                id="admin-password"
                className="field"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  borderLeft: '3px solid var(--red)',
                  background: 'var(--bone)',
                  padding: '12px 14px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--red-dark)',
                }}
              >
                <Icon name="error" size={16} color="var(--red-dark)" />
                <span>{error}</span>
              </div>
            ) : null}

            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 18 }}>
          CSX4110 · Section 542 · v0.5
        </div>
      </div>
    </div>
  )
}
