import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, downloadFile } from '../api.js'
import { useApi } from '../lib/useApi.js'
import { useSession } from '../session.jsx'
import { useToast } from '../components/Toast.jsx'
import { Avatar, ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import { dateTime, relativeTime, rewardLabel, timeOnly } from '../lib/format.js'
import { subscribe, unsubscribe, useSocketEvent } from '../lib/socket.js'
import { AttachButton, AttachmentChips, UploadRow } from '../components/Attachments.jsx'
import { uploadFile, uploadRejection } from '../lib/uploads.js'

/** Google's template wants 20260905T133000Z, i.e. UTC with the punctuation gone. */
const utcStamp = (value) => new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

/**
 * Client-side Google Calendar "add event" link from the event's own fields. No
 * end time is stored anywhere, so the template assumes the classic one-hour
 * slot. Returns null when there is no start to build on.
 */
function googleCalendarUrl(task) {
  if (!task.startsAt) return null
  const start = new Date(task.startsAt)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const params = [
    ['action', 'TEMPLATE'],
    ['text', task.title],
    ['dates', `${utcStamp(start)}/${utcStamp(end)}`],
  ]
  if (task.location?.name) params.push(['location', task.location.name])
  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  return `https://calendar.google.com/calendar/render?${query}`
}

/** An event assignment was attended once its check-in landed. */
const isCheckedIn = (assignment) =>
  Boolean(assignment) && Boolean(assignment.checkedInAt || assignment.status === 'COMPLETED')

export function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { me, orgs } = useSession()
  const { flash, flashError } = useToast()
  const { data, error, loading, reload } = useApi(() => api.get(`/tasks/${id}`), [id])
  const [downloading, setDownloading] = useState(false)

  // Attachments and their in-flight uploads; local patches between fetches.
  const [atts, setAtts] = useState(null)
  const [uploads, setUploads] = useState([])
  useEffect(() => {
    setAtts(data?.task?.attachments ?? null)
  }, [data])

  // Live seat and check-in changes. The task room only says "something about
  // this task changed" (status/occupancy, no assignment detail), so the row
  // refetches, debounced: a door takes many codes in quick succession.
  const reloadTimer = useRef(null)
  const reloadSoon = () => {
    clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => reload(), 400)
  }
  useEffect(() => () => clearTimeout(reloadTimer.current), [])

  useEffect(() => {
    subscribe({ taskId: id })
    return () => unsubscribe({ taskId: id })
  }, [id])

  useSocketEvent('task:updated', (payload) => {
    if (payload?.taskId === id) reloadSoon()
  })

  if (loading) return <Loading label="Loading event" />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const task = data.task
  const reserved = task.takenCount
  const pct = Math.min(100, Math.round((reserved / task.maxTakers) * 100))
  const mine = task.myAssignment
  const going = mine && !['WITHDRAWN', 'REJECTED'].includes(mine.status)
  const myCheckedIn = isCheckedIn(mine)

  // Who may open the organizer view: the poster, the sponsoring org's members
  // and admins. Mirrors canManageCheckin on the server; a teacher who did not
  // post the event is deliberately absent, so they never see a 403 screen.
  const canShowCode =
    task.isMine ||
    me?.role === 'ADMIN' ||
    Boolean(task.org && orgs.some((o) => o.id === task.org.id))

  // File attachments follow the task rule, not the check-in rule: poster or
  // admin, which is exactly what the presign route enforces.
  const canManageFiles = task.isMine || me?.role === 'ADMIN'
  const attachments = atts ?? task.attachments ?? []

  const runUpload = (row) => {
    setUploads((u) => u.map((x) => (x.key === row.key ? { ...x, error: null, progress: 0 } : x)))
    uploadFile({
      file: row.file,
      taskId: task.id,
      onProgress: (p) =>
        setUploads((u) => u.map((x) => (x.key === row.key ? { ...x, progress: p } : x))),
    })
      .then((attachment) => {
        setUploads((u) => u.filter((x) => x.key !== row.key))
        setAtts((a) => [...(a ?? []), attachment])
        flash(`${attachment.fileName} attached.`)
      })
      .catch((err) => {
        setUploads((u) =>
          u.map((x) => (x.key === row.key ? { ...x, error: err?.message || 'Upload failed.' } : x)),
        )
        flashError(err)
      })
  }

  const attachFiles = (files) => {
    for (const file of files) {
      const rejection = uploadRejection(file)
      if (rejection) {
        flash(rejection, 'error')
        continue
      }
      const row = { key: crypto.randomUUID(), file, progress: 0, error: null }
      setUploads((u) => [...u, row])
      runUpload(row)
    }
  }

  const deleteAttachment = async (attachment) => {
    await api.del(`/files/${attachment.id}`)
    setAtts((a) => (a ?? []).filter((x) => x.id !== attachment.id))
  }

  const attendees = task.assignments ?? []
  const checkedInCount = attendees.filter((a) => isCheckedIn(a)).length

  const rsvp = async () => {
    try {
      await api.post(`/tasks/${task.id}/apply`)
      flash('Seat reserved. Check in with the rotating code at the door.')
      reload()
    } catch (err) {
      flashError(err)
    }
  }

  const cancelSeat = async () => {
    try {
      await api.post(`/assignments/${mine.id}/withdraw`)
      flash('Seat released.')
      reload()
    } catch (err) {
      flashError(err)
    }
  }

  // Fetched, not anchored: the api client attaches the dev-picker header (and
  // the cookie session rides along same-origin), so the file always arrives.
  const downloadIcs = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadFile(`/tasks/${task.id}/calendar.ics`, `aubounty-${task.id}.ics`)
    } catch (err) {
      flashError(err)
    } finally {
      setDownloading(false)
    }
  }

  const calendarUrl = googleCalendarUrl(task)

  return (
    <div style={{ maxWidth: 1180, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <button className="btn btn-link" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/')}>
        <Icon name="arrow_back" size={17} />
        Back to board
      </button>

      <div
        className="panel-dark"
        style={{ padding: '40px 44px', display: 'flex', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}
      >
        <div style={{ maxWidth: 620 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span
              className="chip"
              style={{ background: 'var(--gold-light)', color: 'var(--ink)', fontWeight: 800, letterSpacing: '0.1em' }}
            >
              {rewardLabel(task.reward).toUpperCase()}
            </span>
            {task.org ? <span className="chip chip-dark">{task.org.name}</span> : null}
            {!task.org ? <span className="chip chip-dark">{task.poster.name}</span> : null}
          </div>

          <h1 className="display" style={{ fontSize: 42, lineHeight: 1.06, margin: '18px 0 0' }}>
            {task.title}
          </h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.65, color: 'var(--muted-3)', margin: '16px 0 0' }}>
            {task.content}
          </p>

          <div style={{ display: 'flex', gap: 26, marginTop: 22, fontSize: 13.5, color: '#e7dfd4', flexWrap: 'wrap' }}>
            <span className="meta-item">
              <Icon name="event" size={18} color="var(--gold)" />
              {task.startsAt ? dateTime(task.startsAt) : 'Date to be announced'}
            </span>
            <span className="meta-item">
              <Icon name="location_on" size={18} color="var(--gold)" />
              {task.location.name}
            </span>
            <span className="meta-item">
              <Icon name="qr_code_2" size={18} color="var(--gold)" />
              QR-verified attendance
            </span>
          </div>

          <div style={{ marginTop: 20, fontSize: 12.5, color: 'var(--muted-2)' }}>
            Posted by <Link to={`/u/${task.poster.id}`}>{task.poster.name}</Link> · {task.poster.role}
          </div>
        </div>

        <div style={{ width: 300, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--ink-2)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted-3)' }}>
              <span>Seats reserved</span>
              <span>
                <strong style={{ color: '#fff' }}>{reserved}</strong> / {task.maxTakers}
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--ink-4)', marginTop: 12, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold)' }} />
            </div>
          </div>

          {canShowCode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {task.isMine ? (
                <div
                  style={{
                    border: '1px solid var(--gold)',
                    padding: 15,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--gold-light)',
                  }}
                >
                  You are the organizer
                </div>
              ) : null}
              <Link className="btn btn-bone btn-block" to={`/check-in?event=${task.id}&mode=organizer`}>
                <Icon name="qr_code_2" size={19} color="var(--red)" />
                Show check-in code
              </Link>
            </div>
          ) : going ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {myCheckedIn ? (
                <div
                  style={{
                    border: '1px solid var(--gold)',
                    padding: 15,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--gold-light)',
                  }}
                >
                  <Icon name="check_circle" size={17} color="var(--green)" /> Checked in
                  {mine.checkedInAt ? ` ${timeOnly(mine.checkedInAt)}` : ''}
                </div>
              ) : (
                <Link className="btn btn-bone btn-block" to={`/check-in?event=${task.id}&mode=attendee`}>
                  <Icon name="qr_code_2" size={19} color="var(--red)" />
                  Check in at the venue
                </Link>
              )}
              <button className="btn btn-outline-dark btn-block" onClick={cancelSeat}>
                Release my seat
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-block" disabled={task.status !== 'OPEN'} onClick={rsvp}>
              {task.status === 'OPEN' ? 'Reserve a seat' : `Closed · ${task.status}`}
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="label" style={{ marginBottom: 0 }}>
              ADD TO CALENDAR
            </div>
            <button
              type="button"
              className="btn btn-outline-dark btn-block"
              onClick={downloadIcs}
              disabled={downloading}
            >
              <Icon name="download" size={17} color="var(--gold)" />
              {downloading ? 'Downloading…' : 'Download .ics'}
            </button>
            {calendarUrl ? (
              <a className="btn btn-outline-dark btn-block" href={calendarUrl} target="_blank" rel="noreferrer">
                <Icon name="event" size={17} color="var(--gold)" />
                Google Calendar
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {canManageFiles || attachments.length ? (
          <div
            className="card"
            style={{
              flex: '1 1 380px',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Kicker>ATTACHMENTS</Kicker>
              {canManageFiles ? (
                <AttachButton
                  onPicked={attachFiles}
                  disabled={uploads.some((u) => !u.error)}
                  label={uploads.some((u) => !u.error) ? 'Uploading…' : 'Attach a file'}
                />
              ) : null}
            </div>
            {attachments.length ? (
              <AttachmentChips
                attachments={attachments}
                onDelete={canManageFiles ? deleteAttachment : undefined}
              />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>
                No poster or handout attached yet. PDF, image, text or DOCX files up to 10 MB each.
              </div>
            )}
            {uploads.map((row) => (
              <UploadRow
                key={row.key}
                name={row.file.name}
                size={row.file.size}
                progress={row.progress}
                error={row.error}
                onRetry={() => runUpload(row)}
                onRemove={() => setUploads((u) => u.filter((x) => x.key !== row.key))}
              />
            ))}
          </div>
        ) : null}
        <div className="note" style={{ flex: '1 1 380px', padding: 24, fontSize: 14 }}>
          Events skip reviews. Attendance verification is the only check. Rating 200 keynote
          attendees one by one would be meaningless.
        </div>
      </div>

      {/* Only the poster (and admins) get attendee identities from the API, so
          the list appears exactly when the payload carries it. */}
      {attendees.length ? (
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Kicker>ATTENDEES</Kicker>
            <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>
              {checkedInCount} of {attendees.length} checked in
            </span>
          </div>
          {attendees.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 0',
                borderBottom: '1px solid var(--line-3)',
                flexWrap: 'wrap',
              }}
            >
              <Avatar name={a.taker.name} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                  <Link to={`/u/${a.taker.id}`}>{a.taker.name}</Link>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 2 }}>
                  {a.taker.role} · reserved {relativeTime(a.appliedAt)}
                </div>
              </div>
              {isCheckedIn(a) ? (
                <span
                  title={a.checkedInAt ? dateTime(a.checkedInAt) : undefined}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--green)',
                    background: 'var(--bone-2)',
                    padding: '5px 9px',
                  }}
                >
                  <Icon name="check_circle" size={15} color="var(--green)" />
                  Checked in{a.checkedInAt ? ` ${timeOnly(a.checkedInAt)}` : ''}
                </span>
              ) : (
                <span className="chip">Not checked in</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
