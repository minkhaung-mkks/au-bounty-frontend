import { initials } from '../lib/format.js'
import brandLockup from '../assets/logo.png'
import brandMark from '../assets/logo-mark.png'

export const Icon = ({ name, size = 20, color, style, className, ...rest }) => (
  // `ms` carries the icon font, so a caller's class has to merge with it, not
  // replace it — otherwise the glyph renders as the literal ligature name.
  <span
    className={className ? `ms ${className}` : 'ms'}
    style={{ fontSize: size, color, ...style }}
    aria-hidden="true"
    {...rest}
  >
    {name}
  </span>
)

/**
 * The real brand, from the proposal cover. The source art is one square
 * lockup on an opaque white ground — red AU, Bounty wordmark, chest mascot,
 * tagline — so it is shown whole where there is room and cropped to the chest
 * alone where a brand row is small. The white ground is never hidden: on ink
 * and red surfaces it is framed as a deliberate badge, and the soft corner
 * radius is the one courtesy the flat-square system makes to a picture that
 * is not drawn in CSS.
 */

/** The full square lockup. Carries the wordmark, so it stands alone. */
export const BrandLockup = ({ size = 92 }) => (
  <img
    src={brandLockup}
    alt="AU Bounty"
    width={size}
    height={size}
    style={{
      display: 'block',
      flex: '0 0 auto',
      background: '#fff',
      borderRadius: Math.max(4, Math.round(size * 0.09)),
      border: '1px solid rgba(255,255,255,.4)',
    }}
  />
)

/**
 * The chest mascot on its white ground, for small brand rows. It always
 * travels beside the "AU Bounty" wordmark text, so the image itself stays
 * decorative (empty alt) rather than making screen readers say the name
 * twice. `onDark` swaps the badge edge: hairline white against ink or red,
 * the control-grey edge against paper.
 */
export const BrandMark = ({ size = 36, onDark = true }) => (
  <img
    src={brandMark}
    alt=""
    width={size}
    height={size}
    style={{
      display: 'block',
      flex: '0 0 auto',
      background: '#fff',
      borderRadius: Math.max(3, Math.round(size * 0.11)),
      padding: Math.max(2, Math.round(size * 0.055)),
      border: onDark ? '1px solid rgba(255,255,255,.28)' : '1px solid var(--line-control)',
    }}
  />
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
