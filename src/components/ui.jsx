import { initials } from '../lib/format.js'

export const Icon = ({ name, size = 20, color, style, ...rest }) => (
  <span className="ms" style={{ fontSize: size, color, ...style }} aria-hidden="true" {...rest}>
    {name}
  </span>
)

/**
 * The AU seal: a red disc ringed in ink and gold. It appears in the sidebar,
 * on the login hero and above a public profile at three different sizes, so
 * the ring maths lives here rather than in three inline copies.
 */
export const Mark = ({ size = 42, onRed = false }) => (
  <div
    aria-hidden="true"
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      // On an ink surface the inner ring is ink; on the red hero it has to be
      // bone, or the seal disappears into its own background.
      background: onRed ? 'var(--red-dark)' : 'var(--red)',
      boxShadow: onRed
        ? `inset 0 0 0 ${Math.round(size * 0.08)}px var(--bone), inset 0 0 0 ${Math.round(size * 0.14)}px var(--gold)`
        : `inset 0 0 0 ${Math.round(size * 0.072)}px var(--ink), inset 0 0 0 ${Math.round(size * 0.12)}px var(--gold)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      fontFamily: 'var(--display)',
      fontWeight: 800,
      fontSize: Math.round(size * 0.36),
      color: '#fff',
    }}
  >
    AU
  </div>
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
  <div className="state" role="status">
    <Icon name="progress_activity" size={26} color="var(--muted-2)" />
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

export const Kicker = ({ children, gold = false }) => (
  <div className={gold ? 'kicker kicker-gold' : 'kicker'}>{children}</div>
)

/**
 * A rating as five drawn stars rather than ★/☆ text, so it matches the icon
 * set the rest of the app uses and reads as one value to a screen reader.
 */
export const Rating = ({ value, size = 15 }) => (
  <span
    style={{ display: 'inline-flex', gap: 1, flex: '0 0 auto' }}
    aria-label={`${value} out of 5`}
  >
    {[1, 2, 3, 4, 5].map((n) => (
      <Icon
        key={n}
        name={n <= value ? 'star' : 'star_border'}
        size={size}
        color={n <= value ? 'var(--gold)' : 'var(--line-control)'}
      />
    ))}
  </span>
)

export const Stat = ({ value, caption, color }) => (
  <div>
    <div className="stat-num" style={color ? { color } : undefined}>
      {value}
    </div>
    <div className="stat-cap">{caption}</div>
  </div>
)
