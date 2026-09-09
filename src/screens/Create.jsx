import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { useToast } from '../components/Toast.jsx'
import { canOfferExtraCredit, canPostEvent, useSession } from '../session.jsx'
import { ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import { LocationMap } from '../components/LocationMap.jsx'
import { MapPicker } from '../components/MapPicker.jsx'
import { PlaceSearch } from '../components/PlaceSearch.jsx'
import { hasMapsBrowserKey } from '../lib/googleMaps.js'
import {
  CAMPUS_DEFAULT,
  hasLocation,
  REWARD_TYPE_LABEL,
  TYPE_CLASS,
  TYPE_LABEL,
  validateCoords,
} from '../lib/format.js'

const TYPES = ['REQUEST', 'EVENT', 'EMERGENCY']
const LOCATION_MODES = [
  { id: 'PLACE', label: 'Location' },
  { id: 'REMOTE', label: 'Remote / online' },
]
const REWARDS = ['NONE', 'CASH', 'EXTRA_CREDIT', 'OTHER']

const TYPE_NOTE = {
  REQUEST: 'Takers apply, you approve, then both sides review each other afterwards.',
  EVENT: 'Seats and check-in at the door. Events skip reviews.',
  EMERGENCY: 'Goes to the top of the board and gets its own page.',
}

const REWARD_NOTE = {
  NONE: 'No reward.',
  CASH: 'We record the amount. You two settle it in person, no payments run through us.',
  EXTRA_CREDIT: 'Verified on AU Bounty. Entering it in the grade book is still the teacher’s job.',
  OTHER: 'Described in words and recorded with the task.',
}

export function Create() {
  const navigate = useNavigate()
  const { flash, flashError } = useToast()
  const { me, orgs, capabilities } = useSession()
  const tagsReq = useApi(() => api.get('/tags'), [])

  const [form, setForm] = useState({
    type: 'REQUEST',
    title: '',
    content: '',
    rewardType: 'NONE',
    rewardDescription: '',
    maxTakers: 1,
    acceptanceMode: 'APPROVAL',
    locationName: '',
    locationLat: '',
    locationLng: '',
    orgId: '',
    startsAt: '',
    deadline: '',
  })
  const [tagIds, setTagIds] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // D9 manual coordinates. Without server-side geocoding they are the only way
  // a located post survives the API, so the section starts expanded; with the
  // Maps key they stay tucked away until a create attempt comes back
  // LOCATION_UNRESOLVED (see submit), which expands them with an explanation.
  // Capabilities are settled before this screen mounts (RequireUser waits for
  // the session load), so the initial state cannot go stale.
  const [coordsOpen, setCoordsOpen] = useState(() => !capabilities.maps && !hasMapsBrowserKey)

  // Where the post happens is a choice, not an empty field: PLACE opens the
  // picker, REMOTE says out loud that there is nowhere to go. Leaving the name
  // blank used to be the only way to say "remote", which read as forgetfulness.
  const [locationMode, setLocationMode] = useState('PLACE')
  const [locationError, setLocationError] = useState(null)
  const [takersError, setTakersError] = useState(null)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const mayEvent = canPostEvent(me, orgs)
  const mayCredit = canOfferExtraCredit(me)

  /**
   * The map's answer to a click, a drag, or "use my location". Coordinates are
   * the record; the reverse-geocoded address only fills a name the poster has
   * not written themselves, so their own wording always survives.
   */
  const pickOnMap = ({ lat, lng, name }) => {
    setLocationError(null)
    const round = (n) => String(Number(n.toFixed(6)))
    setForm((f) => ({
      ...f,
      locationLat: lat == null ? '' : round(lat),
      locationLng: lng == null ? '' : round(lng),
      locationName: name && !f.locationName.trim() ? name : f.locationName,
    }))
  }

  /**
   * A place chosen from the search list. Google's own coordinates for it are
   * the pin, so a landmark needs no map clicking; a place with no point (rare)
   * leaves the pin alone and the server geocodes the name at create.
   */
  const pickFromSearch = ({ name, lat, lng }) => {
    setLocationError(null)
    const round = (n) => String(Number(n.toFixed(6)))
    setForm((f) => ({
      ...f,
      locationName: name || f.locationName,
      locationLat: lat == null ? f.locationLat : round(lat),
      locationLng: lng == null ? f.locationLng : round(lng),
    }))
  }

  const toggleTag = (id) => {
    setTagIds((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id)
      if (current.length >= 3) {
        flash('Three tags maximum.', 'error')
        return current
      }
      return [...current, id]
    })
  }

  /**
   * The API takes 1..1000 seats. Coercing junk to 1 at submit posted a number
   * the student never chose, so a bad count is refused with the reason.
   */
  const takersProblem = () => {
    const n = Number(form.maxTakers)
    if (Number.isInteger(n) && n >= 1 && n <= 1000) return null
    return `${form.type === 'EVENT' ? 'Seats' : 'Spots'} must be a whole number between 1 and 1000.`
  }

  const submit = async (e) => {
    e.preventDefault()
    setLocationError(null)
    setTakersError(null)

    const takersMessage = takersProblem()
    if (takersMessage) {
      setTakersError(takersMessage)
      return
    }

    const remote = locationMode === 'REMOTE'

    // Both coordinates or neither, each inside its range: the same check the
    // emergency screen runs, so both say the same thing about the same value.
    const lat = remote ? '' : form.locationLat.trim()
    const lng = remote ? '' : form.locationLng.trim()
    const coordMessage = validateCoords(lat, lng)
    if (coordMessage) {
      setLocationError(coordMessage)
      setCoordsOpen(true)
      return
    }

    // "Somewhere" with nothing filled in is the one ambiguous state: the
    // poster either meant a place and forgot it, or meant remote and should
    // say so on the record.
    if (!remote && !form.locationName.trim() && !(lat && lng)) {
      setLocationError('Drop a pin, name the place, or choose "Remote / online" instead.')
      return
    }

    setSubmitting(true)
    try {
      const body = {
        title: form.title,
        content: form.content,
        type: form.type,
        rewardType: form.rewardType,
        rewardDescription: form.rewardDescription,
        maxTakers: Number(form.maxTakers),
        acceptanceMode: form.type === 'EVENT' ? 'AUTO' : form.acceptanceMode,
        // Blank stays blank: a remote post sends no name and the server skips
        // geocoding entirely.
        locationName: remote ? '' : form.locationName.trim(),
        tagIds,
      }
      // Coordinates ride along only when both are filled, and the server keeps
      // them exactly as sent: a pin dropped on the map outranks the name.
      if (lat && lng) {
        body.locationLat = Number(lat)
        body.locationLng = Number(lng)
      }
      if (form.orgId) body.orgId = form.orgId
      if (form.startsAt) body.startsAt = new Date(form.startsAt).toISOString()
      if (form.deadline) body.deadline = new Date(form.deadline).toISOString()

      const { task } = await api.post('/tasks', body)
      flash('Posted. Attach files from its page if the task needs them.')
      navigate(task.type === 'EVENT' ? `/events/${task.id}` : `/tasks/${task.id}`)
    } catch (err) {
      if (err.code === 'LOCATION_UNRESOLVED') {
        // The name survived neither geocoding nor manual coordinates: reopen
        // the coordinate section with the reason right next to the fix.
        setCoordsOpen(true)
        setLocationError(
          capabilities.maps
            ? 'That location name could not be pinned on a map. Enter exact coordinates below, or rephrase the name.'
            : 'Automatic geocoding is not available, so this post needs coordinates. Enter them below.',
        )
      } else {
        flashError(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (tagsReq.loading) return <Loading label="Loading tags" />
  if (tagsReq.error) return <ErrorState error={tagsReq.error} onRetry={tagsReq.reload} />

  const allTags = tagsReq.data.tags
  const picked = allTags.filter((t) => tagIds.includes(t.id))

  // Anything the student typed or picked. Leaving with the form filled throws
  // the whole post away, so it asks first.
  const dirty =
    Boolean(form.title.trim() || form.content.trim() || form.locationName.trim()) ||
    Boolean(form.rewardDescription.trim() || form.locationLat.trim() || form.locationLng.trim()) ||
    Boolean(form.startsAt || form.deadline || form.orgId) ||
    tagIds.length > 0

  const cancel = () => {
    if (dirty && !window.confirm('Discard this post? What you typed is not saved.')) return
    navigate('/')
  }

  // The preview card mirrors what the detail screen will show: the placeholder
  // grid until a Maps key exists, and a Directions deep link as soon as the
  // typed coordinates parse.
  const previewLat = form.locationLat.trim() !== '' ? Number(form.locationLat) : null
  const previewLng = form.locationLng.trim() !== '' ? Number(form.locationLng) : null
  const remotePreview = locationMode === 'REMOTE'
  const previewLocation = {
    name: remotePreview ? '' : form.locationName,
    lat: remotePreview || !Number.isFinite(previewLat) ? null : previewLat,
    lng: remotePreview || !Number.isFinite(previewLng) ? null : previewLng,
    mapUrl: null,
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <h1 className="display">New post</h1>
        <p className="page-sub">
          Your role decides what you can post.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div
          className="card card-pad"
          style={{ flex: '1 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          <div role="group" aria-labelledby="type-label">
            <div className="label" id="type-label">
              TYPE
            </div>
            {/* Three labels do not fit one phone-width row, and a segment that
                wraps is better than one that runs off the card. */}
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {TYPES.map((t) => {
                const locked = t === 'EVENT' && !mayEvent
                return (
                  <button
                    key={t}
                    type="button"
                    className="seg"
                    style={{ flex: '1 1 130px', padding: 14 }}
                    aria-pressed={form.type === t}
                    aria-disabled={locked || undefined}
                    onClick={() => {
                      // The reason lives under the group, where it is readable
                      // before the press instead of only after it.
                      if (!locked) set({ type: t })
                    }}
                  >
                    {TYPE_LABEL[t]}
                    {locked ? (
                      <span style={{ display: 'block', fontWeight: 400, fontSize: 11, marginTop: 3 }}>
                        Locked
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            {!mayEvent ? (
              <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 8, lineHeight: 1.5 }}>
                Events are locked: only org members, teachers and admins can post one.
              </div>
            ) : null}
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
              {TYPE_NOTE[form.type]}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="task-title">
              TITLE
            </label>
            <input
              id="task-title"
              className="field"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="What do you need?"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="task-content">
              DETAILS
            </label>
            <textarea
              id="task-content"
              className="field"
              rows={4}
              value={form.content}
              onChange={(e) => set({ content: e.target.value })}
              placeholder="What exactly is needed, when, and for how long?"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }} role="group" aria-labelledby="reward-label">
              <div className="label" id="reward-label">
                REWARD
              </div>
              <div className="seg-row">
                {REWARDS.map((r) => {
                  const locked = r === 'EXTRA_CREDIT' && !mayCredit
                  return (
                    <button
                      key={r}
                      type="button"
                      className="seg"
                      aria-pressed={form.rewardType === r}
                      onClick={() =>
                        locked
                          ? flash('Extra-credit rewards are teacher-only.', 'error')
                          : set({ rewardType: r })
                      }
                    >
                      {REWARD_TYPE_LABEL[r]}
                      {locked ? (
                        <span style={{ display: 'block', fontWeight: 400, fontSize: 11, marginTop: 3 }}>
                          Locked
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 9, lineHeight: 1.5 }}>
                {REWARD_NOTE[form.rewardType]}
              </div>
            </div>
            <div style={{ flex: '1 1 190px' }}>
              <label className="label" htmlFor="reward-detail">
                REWARD DETAIL
              </label>
              <input
                id="reward-detail"
                className="field"
                value={form.rewardDescription}
                onChange={(e) => set({ rewardDescription: e.target.value })}
                placeholder={form.rewardType === 'CASH' ? '200 THB' : 'Describe it'}
                disabled={form.rewardType === 'NONE'}
                required={form.rewardType !== 'NONE'}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="label" htmlFor="max-takers">
                {form.type === 'EVENT' ? 'SEATS' : 'SPOTS'}
              </label>
              <input
                id="max-takers"
                className="field"
                type="number"
                min="1"
                max="1000"
                value={form.maxTakers}
                onChange={(e) => {
                  setTakersError(null)
                  set({ maxTakers: e.target.value })
                }}
                aria-invalid={takersError ? true : undefined}
                aria-describedby={takersError ? 'max-takers-error' : undefined}
              />
              {takersError ? (
                <div
                  id="max-takers-error"
                  role="alert"
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--red-dark)', marginTop: 7 }}
                >
                  {takersError}
                </div>
              ) : null}
            </div>
            {form.type !== 'EVENT' ? (
              <div style={{ flex: '1 1 260px' }} role="group" aria-labelledby="acceptance-label">
                <div className="label" id="acceptance-label">
                  WHO GETS IN
                </div>
                <div className="seg-row">
                  {['APPROVAL', 'AUTO'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="seg"
                      aria-pressed={form.acceptanceMode === m}
                      onClick={() => set({ acceptanceMode: m })}
                    >
                      {m === 'AUTO' ? 'First come' : 'Apply & approve'}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px' }}>
              <label className="label" htmlFor="task-when">
                {form.type === 'EVENT' ? 'STARTS AT' : 'DEADLINE'}
              </label>
              <input
                id="task-when"
                className="field"
                type="datetime-local"
                value={form.type === 'EVENT' ? form.startsAt : form.deadline}
                onChange={(e) =>
                  set(form.type === 'EVENT' ? { startsAt: e.target.value } : { deadline: e.target.value })
                }
              />
            </div>
            {form.type === 'EVENT' && orgs.length > 1 ? (
              <div style={{ flex: '1 1 260px' }}>
                <label className="label" htmlFor="task-org">
                  ON BEHALF OF
                </label>
                <select
                  id="task-org"
                  className="field"
                  value={form.orgId}
                  onChange={(e) => set({ orgId: e.target.value })}
                >
                  <option value="">Pick an organization</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div role="group" aria-labelledby="tags-label">
            <div className="label" id="tags-label">
              TAGS · {tagIds.length} OF 3
            </div>
            {allTags.length ? (
              <div className="seg-row">
                {allTags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="seg"
                    aria-pressed={tagIds.includes(t.id)}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>No tags configured yet.</div>
            )}
            {/* The cap used to be discoverable only by hitting it. */}
            <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 8, lineHeight: 1.5 }}>
              Three tags maximum.
            </div>
          </div>

          <div>
            <span className="label" id="location-mode">
              LOCATION
            </span>
            <div
              role="group"
              aria-labelledby="location-mode"
              style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, marginBottom: 12 }}
            >
              {LOCATION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className="seg"
                  style={{ flex: '1 1 200px' }}
                  aria-pressed={locationMode === mode.id}
                  onClick={() => {
                    setLocationError(null)
                    setLocationMode(mode.id)
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {locationMode === 'REMOTE' ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted-2)', lineHeight: 1.5 }}>
                Nothing is pinned. The board shows this post as having no location, and anything
                typed above is left off it.
              </div>
            ) : null}

            {locationMode === 'PLACE' && hasMapsBrowserKey ? (
              <div style={{ marginBottom: 12 }}>
                <MapPicker
                  lat={Number.isFinite(previewLat) ? previewLat : null}
                  lng={Number.isFinite(previewLng) ? previewLng : null}
                  onPick={pickOnMap}
                />
              </div>
            ) : null}

            <div hidden={locationMode !== 'PLACE'}>
            <label className="label" htmlFor="location-name">
              PLACE NAME <span style={{ color: 'var(--muted-2)' }}>(optional with a pin)</span>
            </label>
            <PlaceSearch
              id="location-name"
              value={form.locationName}
              placeholder="Search a place, or type a building or room"
              onChange={(text) => {
                setLocationError(null)
                set({ locationName: text })
              }}
              onSelect={pickFromSearch}
            />

            <button
              type="button"
              className="btn btn-link"
              style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}
              aria-expanded={coordsOpen}
              aria-controls="exact-location"
              onClick={() => setCoordsOpen((open) => !open)}
            >
              <Icon name={coordsOpen ? 'expand_less' : 'expand_more'} size={16} />
              Exact location (optional)
            </button>

            {coordsOpen ? (
              <div id="exact-location" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 150px' }}>
                    <label className="label" htmlFor="location-lat">
                      LATITUDE
                    </label>
                    <input
                      id="location-lat"
                      className="field"
                      type="number"
                      step="any"
                      min="-90"
                      max="90"
                      value={form.locationLat}
                      onChange={(e) => {
                        setLocationError(null)
                        set({ locationLat: e.target.value })
                      }}
                      placeholder={String(CAMPUS_DEFAULT.lat)}
                    />
                  </div>
                  <div style={{ flex: '1 1 150px' }}>
                    <label className="label" htmlFor="location-lng">
                      LONGITUDE
                    </label>
                    <input
                      id="location-lng"
                      className="field"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={form.locationLng}
                      onChange={(e) => {
                        setLocationError(null)
                        set({ locationLng: e.target.value })
                      }}
                      placeholder={String(CAMPUS_DEFAULT.lng)}
                    />
                  </div>
                </div>
                {locationError ? (
                  <div role="alert" style={{ fontSize: 12, fontWeight: 700, color: 'var(--red-dark)' }}>
                    {locationError}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--muted-2)', lineHeight: 1.5 }}>
                    {hasMapsBrowserKey
                      ? 'The map fills these in. Type over them only when the pin lands wrong.'
                      : capabilities.maps
                        ? 'Leave empty and the place name is pinned for you. Fill these in only when the pin lands wrong.'
                        : 'This post needs exact coordinates. Copy them from Google Maps.'}
                  </div>
                )}
              </div>
            ) : null}
            </div>
          </div>

          <div className="divider" style={{ display: 'flex', gap: 11, paddingTop: 22 }}>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Posting…' : 'Post to board'}
            </button>
            <button className="btn btn-outline" type="button" onClick={cancel} disabled={submitting}>
              Cancel
            </button>
          </div>
        </div>

        <div
          className="rail"
          style={{ flex: '1 1 320px', maxWidth: 352, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Kicker>LIVE PREVIEW</Kicker>
          {/* A mirror of the fields above: every keystroke would be announced
              twice if this were part of the accessibility tree. `inert` goes
              with it, so the Directions link the preview grows once coordinates
              parse is not a tab stop in the middle of the form. */}
          <div className="task-card" style={{ cursor: 'default' }} aria-hidden="true" inert>
            <span style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <span className={`chip chip-type ${TYPE_CLASS[form.type]}`}>{TYPE_LABEL[form.type]}</span>
              <span className="chip chip-reward">
                {form.rewardType === 'NONE'
                  ? REWARD_TYPE_LABEL.NONE
                  : form.rewardDescription || REWARD_TYPE_LABEL[form.rewardType]}
              </span>
            </span>
            <h3>{form.title || 'Your title appears here'}</h3>
            <p>{form.content || 'And the details go here.'}</p>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {picked.map((t) => (
                <span key={t.id} className="chip">
                  {t.name}
                </span>
              ))}
            </span>
            {hasLocation(previewLocation) ? (
              <div style={{ marginTop: 12, border: '1px solid var(--line)' }}>
                <LocationMap location={previewLocation} height={110} caption={false} />
              </div>
            ) : null}
            <span className="task-meta">
              <span className="meta-item">
                <Icon name="location_on" />
                {remotePreview ? 'Remote / online' : form.locationName || 'No location'}
              </span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--red)' }}>
                {form.maxTakers}{' '}
                {form.type === 'EVENT'
                  ? Number(form.maxTakers) === 1
                    ? 'seat'
                    : 'seats'
                  : Number(form.maxTakers) === 1
                    ? 'spot'
                    : 'spots'}
              </span>
            </span>
          </div>
          <div className="note-quiet">Attach files after posting, from the post&rsquo;s own page.</div>
        </div>
      </div>
    </form>
  )
}
