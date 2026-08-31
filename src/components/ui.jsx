import { initials } from '../lib/format.js'

export const Icon = ({ name, size = 20, color, style, ...rest }) => (
  <span className="ms" style={{ fontSize: size, color, ...style }} aria-hidden="true" {...rest}>
    {name}
  </span>
)

export const Avatar = ({ name, size = 40, dark = false }) => (
  <div
    className="avatar"
    style={{
      width: size,
      height: size,
      fontSize: Math.round(size * 0.34),
      ...(dark ? { background: 'var(--red)', color: '#fff' } : null),
    }}
  >
    {initials(name)}
  </div>
)

export const Loading = ({ label = 'Loading' }) => (
  <div className="state">
    <Icon name="progress_activity" size={26} color="var(--muted-3)" />
    <div style={{ marginTop: 10 }}>{label}…</div>
  </div>
)

export const ErrorState = ({ error, onRetry }) => (
  <div className="state state-error" role="alert">
    <Icon name="error" size={26} />
    <div style={{ marginTop: 10, fontWeight: 700 }}>{error?.message || 'Something went wrong.'}</div>
    {error?.details?.length ? (
      <ul style={{ textAlign: 'left', maxWidth: 460, margin: '12px auto 0', fontSize: 13 }}>
        {error.details.map((d, i) => (
          <li key={i}>
            <strong>{d.path}</strong>: {d.message}
          </li>
        ))}
      </ul>
    ) : null}
    {onRetry ? (
      <button className="btn btn-outline btn-sm" style={{ marginTop: 16 }} onClick={onRetry}>
        Try again
      </button>
    ) : null}
  </div>
)

export const Empty = ({ children }) => <div className="state">{children}</div>

/**
 * Marks a screen that is designed but has no backend yet in v0.5, so nobody
 * mistakes hardcoded content for working features.
 */
export const StubBanner = ({ children }) => (
  <div className="stub-banner">
    <Icon name="construction" size={19} />
    <span>NOT WIRED YET</span>
    <span className="body">{children}</span>
  </div>
)

export const Kicker = ({ children, gold = false }) => (
  <div className={gold ? 'kicker kicker-gold' : 'kicker'}>{children}</div>
)

export const Stat = ({ value, caption, color }) => (
  <div>
    <div className="stat-num" style={color ? { color } : undefined}>
      {value}
    </div>
    <div className="stat-cap">{caption}</div>
  </div>
)
