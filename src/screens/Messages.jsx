import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useSession } from '../session.jsx'
import { useToast } from '../components/Toast.jsx'
import { Avatar, Empty, ErrorState, Icon, Kicker, Loading } from '../components/ui.jsx'
import { subscribe, unsubscribe, useSocketEvent } from '../lib/socket.js'
import { threadsStore, useThreads } from '../lib/threads.js'
import { TYPE_CLASS, relativeTime, timeOnly } from '../lib/format.js'

const MAX_LEN = 4000

/** One row in the thread list. */
function ThreadRow({ thread, me, active, onSelect }) {
  const last = thread.lastMessage
  const mine = last?.senderId === me.id
  return (
    <button type="button" className={`thread-row${active ? ' active' : ''}`} onClick={onSelect}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {thread.counterpart?.name ?? 'Unknown'}
        </span>
        {thread.unreadCount > 0 ? (
          <span className="unread-badge">{thread.unreadCount > 99 ? '99+' : thread.unreadCount}</span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--muted-3)', flex: '0 0 auto' }}>
            {relativeTime(thread.lastActivityAt)}
          </span>
        )}
      </span>
      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--red)', fontWeight: 700, marginTop: 3 }}>
        {thread.taskTitle}
      </span>
      <span
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
        {last ? `${mine ? 'You: ' : ''}${last.content}` : 'No messages yet'}
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
function ThreadPane({ thread, me }) {
  const { flashError } = useToast()
  const assignmentId = thread.assignmentId

  const [messages, setMessages] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef(null)
  const pinnedRef = useRef(true)
  const anchorRef = useRef(null)
  const pendingRef = useRef([])
  const unreadIncomingRef = useRef(false)

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
    } catch (err) {
      flashError(err)
    } finally {
      setSending(false)
    }
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

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 13,
        }}
      >
        <Avatar name={counterpart} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16 }}>
            <Link to={`/u/${thread.counterpart?.id}`}>{counterpart}</Link>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 7 }}>
            {thread.taskType ? <span className={`chip chip-type ${TYPE_CLASS[thread.taskType] ?? ''}`}>{thread.taskType}</span> : null}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {thread.taskTitle} · assignment thread
            </span>
          </div>
        </div>
        <Link className="btn btn-outline btn-sm" to={`/tasks/${thread.taskId}`}>
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
              onClick={loadOlder}
              disabled={loadingOlder}
              style={{
                background: 'none',
                border: 0,
                padding: 0,
                cursor: loadingOlder ? 'default' : 'pointer',
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--muted-3)',
              }}
            >
              {loadingOlder ? 'Loading earlier messages…' : 'Scroll up for earlier messages'}
            </button>
          ) : null}
          {messages.map((m) => {
            const mine = m.senderId === me.id
            return (
              <div
                key={m.id}
                className={`msg-bubble ${mine ? 'msg-own' : 'msg-other'}`}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '64%',
                  background: mine ? 'var(--red)' : '#fff',
                  border: mine ? 0 : '1px solid var(--line)',
                  color: mine ? '#fff' : 'inherit',
                  padding: '13px 16px',
                  fontSize: 14,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                }}
              >
                {m.content}
                <div
                  style={{
                    fontSize: 11,
                    color: mine ? 'var(--red-soft-2)' : 'var(--muted-3)',
                    marginTop: 5,
                    textAlign: mine ? 'right' : 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                    gap: 4,
                  }}
                >
                  {timeOnly(m.createdAt)}
                  {mine && m.readAt ? (
                    <span className="msg-read" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
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
        onSubmit={send}
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: 11,
        }}
      >
        <input
          className="field"
          placeholder={`Message ${counterpart.split(' ')[0]}`}
          style={{ flex: 1 }}
          value={draft}
          maxLength={MAX_LEN}
          onChange={(e) => setDraft(e.target.value)}
          disabled={Boolean(error)}
          aria-label="Message"
        />
        {draft.length > MAX_LEN - 200 ? (
          <span style={{ fontSize: 11, color: 'var(--muted-3)' }}>
            {draft.length}/{MAX_LEN}
          </span>
        ) : null}
        <button className="btn btn-primary btn-sm" disabled={!draft.trim() || sending || Boolean(error)}>
          {sending ? 'Sending…' : 'Send'}
        </button>
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

  const select = (id) => setSearchParams(id ? { thread: id } : {})

  return (
    <div style={{ maxWidth: 1300, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="display">Messages</h1>
        <p className="page-sub">
          One thread per assignment. You can only message someone you share an active task with.
        </p>
      </div>

      {error && !threads.length ? (
        <ErrorState error={error} onRetry={() => threadsStore.reload()} />
      ) : !loading && !threads.length ? (
        <Empty>
          <Icon name="forum" size={30} color="var(--muted-3)" />
          <div style={{ marginTop: 12, fontWeight: 700, color: 'var(--muted)' }}>No conversations yet</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            A private thread opens automatically when you accept someone onto a task, or are accepted
            onto theirs. Find work on the <Link to="/">board</Link>.
          </div>
        </Empty>
      ) : (
        <div className="card" style={{ display: 'flex', height: 'min(72vh, 700px)', minHeight: 480 }}>
          <div
            style={{
              width: 300,
              flex: '0 0 auto',
              borderRight: '1px solid var(--line)',
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

          {selected ? (
            <ThreadPane key={selected.assignmentId} thread={selected} me={me} />
          ) : (
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
              <Icon name="mark_email_unread" size={30} color="var(--muted-3)" />
              Select a thread to read and reply.
            </div>
          )}
        </div>
      )}

      <div className="row">
        <div className="note-quiet" style={{ flex: '1 1 380px' }}>
          <Kicker>HOW THREADS WORK</Kicker>
          <div style={{ marginTop: 8 }}>
            Messages hang off the assignment id, not the task, so a task with three takers has three
            separate private threads and no taker sees another's conversation.
          </div>
        </div>
        <div className="note" style={{ flex: '1 1 380px' }}>
          There are no open DMs. A thread only exists between two people who share an active
          assignment, which keeps the moderation surface near zero.
        </div>
      </div>
    </div>
  )
}
