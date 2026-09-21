import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useSession } from '../session.jsx'
import { useToast } from '../components/Toast.jsx'
import { Avatar, Empty, ErrorState, Icon, Loading } from '../components/ui.jsx'
import { subscribe, unsubscribe, useSocketEvent } from '../lib/socket.js'
import { threadsStore, useThreads } from '../lib/threads.js'
import { TYPE_CLASS, relativeTime, timeOnly } from '../lib/format.js'
import { AttachButton, AttachmentChips, UploadRow } from '../components/Attachments.jsx'
import { attachmentIcon, effectiveMime, formatBytes, uploadFile, uploadRejection } from '../lib/uploads.js'

const MAX_LEN = 4000
// Six rows of the composer at .field's 14px/1.55 plus its padding; past that
// the textarea scrolls instead of eating the conversation.
const COMPOSER_MAX_H = 160

/**
 * Below 900px the list and the conversation cannot sit side by side without
 * squeezing one of them to nothing, so the screen shows one pane at a time.
 */
function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const onChange = (e) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

/** One row in the thread list. */
function ThreadRow({ thread, me, active, onSelect }) {
  const last = thread.lastMessage
  const mine = last?.senderId === me.id
  const name = thread.counterpart?.name ?? 'Unknown'
  const snippet = last ? `${mine ? 'You: ' : ''}${last.content}` : 'No messages yet'
  return (
    <button type="button" className={`thread-row${active ? ' active' : ''}`} onClick={onSelect}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span title={name} style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        {thread.unreadCount > 0 ? (
          <span className="unread-badge" aria-label={`${thread.unreadCount} unread`}>
            {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--muted-2)', flex: '0 0 auto' }}>
            {relativeTime(thread.lastActivityAt)}
          </span>
        )}
      </span>
      <span
        title={thread.taskTitle}
        style={{ display: 'block', fontSize: 11.5, color: 'var(--muted-2)', fontWeight: 700, marginTop: 3 }}
      >
        {thread.taskTitle}
      </span>
      <span
        title={snippet}
        style={{
          display: 'block',
          fontSize: 12.5,
          color: 'var(--muted-2)',
          marginTop: 5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {snippet}
      </span>
    </button>
  )
}

/** Concatenates message arrays, dropping repeats by id, oldest first. */
function mergeById(...groups) {
  const seen = new Set()
  const out = []
  for (const group of groups) {
    for (const m of group) {
      if (m?.id && !seen.has(m.id)) {
        seen.add(m.id)
        out.push(m)
      }
    }
  }
  return out
}

const byTime = (a, b) =>
  String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.id).localeCompare(String(b.id))

/**
 * The open conversation: history with upward pagination, live delivery over the
 * assignment room, read receipts, and a REST composer that works even with the
 * socket down.
 */
function ThreadPane({ thread, me, headingRef, onBack }) {
  const { flash, flashError } = useToast()
  const assignmentId = thread.assignmentId

  const [messages, setMessages] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  // Files staged on the composer; they ride along with the next sent message.
  const [pending, setPending] = useState([])

  const scrollRef = useRef(null)
  const composerRef = useRef(null)
  const composerFormRef = useRef(null)
  const pinnedRef = useRef(true)
  const anchorRef = useRef(null)
  const pendingRef = useRef([])
  const unreadIncomingRef = useRef(false)
  // Per message: how many of the files it was sent with have landed/failed,
  // so a partial failure can be reported without reading state mid-update.
  const fileLedger = useRef({})

  // Membership in the thread room for as long as this pane is mounted.
  useEffect(() => {
    subscribe({ assignmentId })
    return () => unsubscribe({ assignmentId })
  }, [assignmentId])

  // History, newest window first.
  useEffect(() => {
    let cancelled = false
    setError(null)
    setHasMore(false)
    api
      .get(`/assignments/${assignmentId}/messages?limit=50`)
      .then((d) => {
        if (cancelled) return
        const loaded = d?.messages ?? []
        setMessages(mergeById(pendingRef.current, loaded).sort(byTime))
        pendingRef.current = []
        setHasMore(Boolean(d?.hasMore))
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
    return () => {
      cancelled = true
    }
  }, [assignmentId, reloadKey])

  // Keep the view pinned to the newest message unless the user scrolled up.
  // After prepending history, hold the old viewport instead.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !messages) return
    if (anchorRef.current) {
      const { prevHeight, prevTop } = anchorRef.current
      anchorRef.current = null
      el.scrollTop = el.scrollHeight - prevHeight + prevTop
    } else if (pinnedRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // The composer and the conversation share a column, so every pixel the
  // composer grows (chips staged or unstaged, a taller draft) is a pixel the
  // message list loses. A pinned view has to ride that resize, or the newest
  // bubble ends up half clipped behind the composer. The log only exists once
  // history has loaded, so the observer attaches (and re-attaches) with it.
  useEffect(() => {
    const form = composerFormRef.current
    const scroller = scrollRef.current
    if (!form || !scroller || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const el = scrollRef.current
      if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(form)
    return () => ro.disconnect()
  }, [messages !== null])

  const loadOlder = async () => {
    const oldest = messages?.[0]
    if (!oldest || loadingOlder) return
    const el = scrollRef.current
    const snapshot = { prevHeight: el.scrollHeight, prevTop: el.scrollTop }
    setLoadingOlder(true)
    try {
      const d = await api.get(`/assignments/${assignmentId}/messages?before=${oldest.id}&limit=50`)
      anchorRef.current = snapshot
      setHasMore(Boolean(d?.hasMore))
      setMessages((prev) => mergeById(d?.messages ?? [], prev).sort(byTime))
    } catch (err) {
      flashError(err)
    } finally {
      setLoadingOlder(false)
    }
  }

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    // The hint row sits above the oldest bubble, so the trigger band has to
    // clear it; 120px keeps a nudge from needing a pixel-perfect scroll.
    if (el.scrollTop < 120 && hasMore && !loadingOlder) loadOlder()
  }

  const appendMessage = (msg) => {
    if (!msg?.id) return
    setMessages((prev) => {
      const next = mergeById(prev ?? pendingRef.current, [msg]).sort(byTime)
      if (!prev) {
        // History request still in flight; keep it for the response to absorb.
        pendingRef.current = next
        return prev
      }
      return next
    })
  }

  // The 201 response is applied directly; the socket echo of the same message
  // just merges over it, and the REST path keeps the screen usable offline-ish.
  // Attachments come after: the message must exist before a file can presign
  // against its id, so files leave with the bubble already on screen.
  const send = async (e) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const res = await api.post(`/assignments/${assignmentId}/messages`, { content })
      const msg = res?.message ?? res
      pinnedRef.current = true
      appendMessage(msg)
      setDraft('')
      threadsStore.touch(assignmentId, {
        content,
        createdAt: msg?.createdAt ?? new Date().toISOString(),
        senderId: me.id,
      })
      const files = pending
      setPending([])
      if (files.length) startUploads(msg.id, files)
    } catch (err) {
      flashError(err)
    } finally {
      setSending(false)
    }
  }

  /** Patches one message row in place, whatever else is merging around it. */
  const patchMessage = (id, fn) =>
    setMessages((prev) => (prev ? prev.map((m) => (m.id === id ? fn(m) : m)) : prev))

  // One report per batch. Two failed files used to fire two toasts carrying
  // two different counts, so the tally is announced once the last file lands.
  const settleFile = (messageId, ok) => {
    const ledger = fileLedger.current[messageId]
    if (!ledger) return
    if (ok) ledger.done += 1
    else ledger.failed += 1
    if (ledger.done + ledger.failed < ledger.total || !ledger.failed) return
    // Partial-failure honesty: the message itself is already delivered,
    // so the toast counts what made it rather than crying "not sent".
    flash(
      `Message sent; ${ledger.done} of ${ledger.total} files uploaded. Retry from the bubble.`,
      'error',
    )
  }

  const runMessageUpload = (messageId, item) => {
    // A retry arrives after its batch settled, or after this pane remounted
    // with no ledger at all; either way it is a fresh batch of one.
    const open = fileLedger.current[messageId]
    if (!open || open.done + open.failed >= open.total) {
      fileLedger.current[messageId] = { done: 0, failed: 0, total: 1 }
    }
    patchMessage(messageId, (m) => ({
      ...m,
      failedUploads: (m.failedUploads ?? []).filter((f) => f.key !== item.key),
      uploading: [...(m.uploading ?? []), { key: item.key, file: item.file, progress: 0 }],
    }))
    uploadFile({
      file: item.file,
      messageId,
      onProgress: (p) =>
        patchMessage(messageId, (m) => ({
          ...m,
          uploading: (m.uploading ?? []).map((x) =>
            x.key === item.key ? { ...x, progress: p } : x,
          ),
        })),
    })
      .then((attachment) => {
        patchMessage(messageId, (m) => ({
          ...m,
          uploading: (m.uploading ?? []).filter((x) => x.key !== item.key),
          attachments: [...(m.attachments ?? []), attachment],
        }))
        settleFile(messageId, true)
      })
      .catch((err) => {
        patchMessage(messageId, (m) => ({
          ...m,
          uploading: (m.uploading ?? []).filter((x) => x.key !== item.key),
          failedUploads: [
            ...(m.failedUploads ?? []),
            { key: item.key, file: item.file, error: err?.message || 'Upload failed.' },
          ],
        }))
        settleFile(messageId, false)
      })
  }

  const startUploads = (messageId, files) => {
    fileLedger.current[messageId] = { done: 0, failed: 0, total: files.length }
    for (const item of files) runMessageUpload(messageId, item)
  }

  const dismissFailed = (messageId, key) =>
    patchMessage(messageId, (m) => ({
      ...m,
      failedUploads: (m.failedUploads ?? []).filter((f) => f.key !== key),
    }))

  // Files land on the composer as chips; anything the API would refuse is
  // turned away immediately with the reason, before it is attached to a send.
  const pickFiles = (files) => {
    const accepted = []
    for (const file of files) {
      const rejection = uploadRejection(file)
      if (rejection) {
        flash(rejection, 'error')
        continue
      }
      accepted.push({ key: crypto.randomUUID(), file })
    }
    if (accepted.length) setPending((p) => [...p, ...accepted])
  }

  // Live delivery: the room gets the full message for both sides.
  useSocketEvent('message:new', (payload) => {
    const msg = payload?.message
    if (!msg || (msg.assignmentId ?? payload.assignmentId) !== assignmentId) return
    const mine = msg.senderId === me.id
    const focused = document.hasFocus()
    pinnedRef.current = pinnedRef.current || mine
    appendMessage(msg)
    threadsStore.touch(
      assignmentId,
      { content: msg.content, createdAt: msg.createdAt, senderId: msg.senderId },
      { bump: !mine && !focused },
    )
    if (!mine && focused) threadsStore.markRead(assignmentId)
    if (!mine && !focused) unreadIncomingRef.current = true
  })

  // Read receipts: the reader's side marks the counterpart's rows read, the
  // other side turns its own rows into "Read" ticks.
  useSocketEvent('message:read', (payload) => {
    if (!payload || payload.assignmentId !== assignmentId || !payload.untilMessageId) return
    const markMine = payload.readerId !== me.id
    const stamp = new Date().toISOString()
    setMessages((prev) => {
      if (!prev) return prev
      const idx = prev.findIndex((m) => m.id === payload.untilMessageId)
      if (idx < 0) return prev
      return prev.map((m, i) =>
        i <= idx && !m.readAt && (m.senderId === me.id) === markMine ? { ...m, readAt: stamp } : m,
      )
    })
  })

  // Catch-up read receipt for messages that arrived while the window was away.
  useEffect(() => {
    const onFocus = () => {
      if (!unreadIncomingRef.current) return
      unreadIncomingRef.current = false
      threadsStore.markRead(assignmentId)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [assignmentId])

  const counterpart = thread.counterpart?.name ?? 'Unknown'
  // A thread whose other side is gone has no first name to address, and
  // "Message Unknown" is worse than no name at all.
  const firstName = thread.counterpart?.name ? counterpart.split(' ')[0] : ''

  // The composer opens at one row and grows with the draft, so a long message
  // is readable before it is sent instead of scrolling past in a single line.
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_H)}px`
  }, [draft])

  // Enter sends and Shift+Enter breaks the line, but an IME composition owns
  // its own Enter and must not send half a word.
  const onComposerKey = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    send(e)
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="thread-head">
        {onBack ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <Icon name="arrow_back" size={15} />
          </button>
        ) : null}
        <Avatar name={counterpart} />
        <div className="thread-head-id">
          <div
            ref={headingRef}
            tabIndex={-1}
            style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            <Link to={`/u/${thread.counterpart?.id}`}>{counterpart}</Link>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {thread.taskType ? <span className={`chip chip-type ${TYPE_CLASS[thread.taskType] ?? ''}`}>{thread.taskType}</span> : null}
            <span
              title={`${thread.taskTitle} · assignment thread`}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
            >
              {thread.taskTitle} · assignment thread
            </span>
          </div>
        </div>
        <Link className="btn btn-outline btn-sm" to={`/tasks/${thread.taskId}`} style={{ flex: '0 0 auto' }}>
          <Icon name="open_in_new" size={15} />
          View task
        </Link>
      </div>

      {error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bone)' }}>
          <div style={{ maxWidth: 420 }}>
            <ErrorState error={error} onRetry={() => setReloadKey((k) => k + 1)} />
          </div>
        </div>
      ) : !messages ? (
        <div style={{ flex: 1, background: 'var(--bone)' }}>
          <Loading label="Loading conversation" />
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            background: 'var(--bone)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {hasMore ? (
            <button
              type="button"
              className="btn btn-link"
              onClick={loadOlder}
              disabled={loadingOlder}
              style={{ alignSelf: 'center' }}
            >
              {loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}
            </button>
          ) : null}
          {messages.map((m) => {
            const mine = m.senderId === me.id
            const flight = [
              ...(m.uploading ?? []),
              ...(m.failedUploads ?? []),
            ]
            return (
              <div key={m.id} className={`msg-bubble ${mine ? 'msg-own' : 'msg-other'}`}>
                {m.content}
                {m.attachments?.length ? (
                  <div style={{ marginTop: 8 }}>
                    <AttachmentChips attachments={m.attachments} onRed={mine} />
                  </div>
                ) : null}
                {flight.length ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 7,
                      alignItems: mine ? 'flex-end' : 'flex-start',
                      marginTop: 8,
                    }}
                  >
                    {flight.map((x) => (
                      <UploadRow
                        key={x.key}
                        name={x.file.name}
                        size={x.file.size}
                        progress={x.progress}
                        error={x.error}
                        onRetry={x.error ? () => runMessageUpload(m.id, x) : undefined}
                        onRemove={x.error ? () => dismissFailed(m.id, x.key) : undefined}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="msg-time">
                  {timeOnly(m.createdAt)}
                  {mine && m.readAt ? (
                    <span className="msg-read">
                      <Icon name="done_all" size={13} />
                      Read
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <form
        ref={composerFormRef}
        onSubmit={send}
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {pending.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {pending.map((p) => (
              <span key={p.key} className="attach-chip">
                <Icon
                  name={attachmentIcon(effectiveMime(p.file))}
                  size={16}
                  color="var(--red)"
                />
                <span className="attach-name" title={p.file.name}>
                  {p.file.name}
                </span>
                <span className="attach-size">{formatBytes(p.file.size)}</span>
                <button
                  type="button"
                  className="attach-act"
                  onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}
                  title="Remove"
                  aria-label={`Remove ${p.file.name}`}
                >
                  <Icon name="close" size={16} />
                </button>
              </span>
            ))}
            <span style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>
              Sends with your next message
            </span>
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 11, flexWrap: 'wrap' }}>
          <textarea
            ref={composerRef}
            className="field"
            rows={1}
            placeholder={firstName ? `Message ${firstName}` : 'Write a message'}
            style={{
              // A basis, not a floor: without it the textarea's intrinsic width
              // squeezes the send controls off a phone-wide pane, and the field
              // itself renders a couple of characters per line.
              flex: '1 1 220px',
              minWidth: 0,
              resize: 'none',
              maxHeight: COMPOSER_MAX_H,
              overflowY: 'auto',
            }}
            value={draft}
            maxLength={MAX_LEN}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onComposerKey}
            disabled={Boolean(error)}
            aria-label="Message"
          />
          {draft.length > MAX_LEN - 200 ? (
            <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>
              {draft.length}/{MAX_LEN}
            </span>
          ) : null}
          <AttachButton
            onPicked={pickFiles}
            label="Attach"
            disabled={Boolean(error)}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={!draft.trim() || sending || Boolean(error)}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function Messages() {
  const { me } = useSession()
  const { threads, loading, error } = useThreads()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('thread')
  const selected = threads.find((t) => t.assignmentId === selectedId) ?? null
  const narrow = useNarrow()
  const headingRef = useRef(null)
  const firstSelection = useRef(true)

  // Fresh list on entry; the shell badge shares this state.
  useEffect(() => {
    threadsStore.reload()
  }, [me.id])

  // Opening a thread reads it, and tells the shell not to badge nudges for it.
  useEffect(() => {
    threadsStore.openThread(selectedId)
    if (selected?.unreadCount > 0) threadsStore.markRead(selectedId)
    return () => threadsStore.closeThread()
  }, [selectedId, selected?.unreadCount])

  // Picking a thread swaps the whole right pane, and on a phone the whole
  // screen, so the reader is put at the top of what just replaced their view.
  useEffect(() => {
    if (firstSelection.current) {
      firstSelection.current = false
      return
    }
    if (selectedId) headingRef.current?.focus()
  }, [selectedId])

  const select = (id) => setSearchParams(id ? { thread: id } : {})

  // One pane at a time below 900px: the list until a thread is picked, then
  // the conversation with a way back.
  const showList = !narrow || !selected

  return (
    <div style={{ maxWidth: 1300, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="display">Messages</h1>
        <p className="page-sub">You can only message someone you share an active task with.</p>
      </div>

      {/* A reload that fails with threads already on screen used to say nothing
          at all, so the list quietly went stale. */}
      {error && threads.length ? (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            padding: '11px 15px',
            background: 'var(--bone)',
            border: '1px solid var(--line)',
            fontSize: 12.5,
            color: 'var(--muted)',
          }}
        >
          <span>{error?.message || 'Could not refresh conversations.'}</span>
          <button type="button" className="btn btn-link" onClick={() => threadsStore.reload()}>
            Try again
          </button>
        </div>
      ) : null}

      {error && !threads.length ? (
        <ErrorState error={error} onRetry={() => threadsStore.reload()} />
      ) : !loading && !threads.length ? (
        <Empty>
          <Icon name="forum" size={30} color="var(--muted-2)" />
          <div style={{ marginTop: 12, fontWeight: 700, color: 'var(--muted)' }}>No conversations yet</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            A private thread opens automatically when you accept someone onto a task, or are accepted
            onto theirs. Find work on the <Link to="/">board</Link>.
          </div>
        </Empty>
      ) : (
        <div
          className="card"
          style={{
            display: 'flex',
            height: 'min(72vh, 700px)',
            // A short phone has no 480px to spare once the shell is on screen.
            minHeight: narrow ? undefined : 480,
          }}
        >
          {showList ? (
            <div
              style={{
                width: narrow ? 'auto' : 300,
                flex: narrow ? '1 1 auto' : '0 0 auto',
                minWidth: 0,
                borderRight: narrow ? 0 : '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
              }}
            >
              {loading && !threads.length ? (
                <div style={{ padding: 24 }}>
                  <Loading label="Loading threads" />
                </div>
              ) : (
                threads.map((t) => (
                  <ThreadRow
                    key={t.assignmentId}
                    thread={t}
                    me={me}
                    active={t.assignmentId === selectedId}
                    onSelect={() => select(t.assignmentId)}
                  />
                ))
              )}
            </div>
          ) : null}

          {selected ? (
            <ThreadPane
              key={selected.assignmentId}
              thread={selected}
              me={me}
              headingRef={headingRef}
              onBack={narrow ? () => select(null) : undefined}
            />
          ) : narrow ? null : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: 'var(--bone)',
                color: 'var(--muted-2)',
                fontSize: 13.5,
                padding: 30,
                textAlign: 'center',
              }}
            >
              <Icon name="mark_email_unread" size={30} color="var(--muted-2)" />
              Select a thread to read and reply.
            </div>
          )}
        </div>
      )}

    </div>
  )
}
