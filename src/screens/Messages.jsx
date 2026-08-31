import { Avatar, Icon, Kicker, StubBanner } from '../components/ui.jsx'

// Hardcoded. The MESSAGE table exists in the schema; the endpoints and the
// realtime transport land in a later version.
const THREADS = [
  { key: 'a', name: 'Student Five', task: 'Request task B', last: 'Sounds good, see you then.', time: '13:06' },
  { key: 'b', name: 'Student Six', task: 'Request task C', last: 'Thanks again for yesterday.', time: '11:40' },
  { key: 'c', name: 'Org Member Two', task: 'Event task A', last: 'Doors open at one.', time: 'Sun' },
]

const MESSAGES = [
  { text: 'Hi, I saw your post and I have done this before.', mine: false, time: '13:02' },
  { text: 'That would help a lot. Are you free Thursday evening?', mine: true, time: '13:04' },
  { text: 'Yes, six at the library works. I will bring my notes.', mine: false, time: '13:06' },
]

export function Messages() {
  return (
    <div style={{ maxWidth: 1300, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="display">Messages</h1>
        <p className="page-sub">
          One thread per assignment. You can only message someone you share an active task with.
        </p>
      </div>

      <StubBanner>
        Designed, not wired. Threads and messages below are hardcoded in the frontend.
      </StubBanner>

      <div className="card" style={{ display: 'flex', height: 620 }}>
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
          {THREADS.map((t, i) => (
            <div
              key={t.key}
              style={{
                borderBottom: '1px solid var(--line-3)',
                borderLeft: `3px solid ${i === 0 ? 'var(--red)' : 'transparent'}`,
                background: i === 0 ? 'var(--bone)' : '#fff',
                padding: 18,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14.5 }}>{t.name}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-3)' }}>{t.time}</span>
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--red)', fontWeight: 700, marginTop: 3 }}>
                {t.task}
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
                {t.last}
              </span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              gap: 13,
            }}
          >
            <Avatar name="Student Five" />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16 }}>Student Five</div>
              <div style={{ fontSize: 12, color: 'var(--muted-2)' }}>Request task B · assignment thread</div>
            </div>
            <span className="chip">IN PROGRESS</span>
          </div>

          <div
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
            {MESSAGES.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.mine ? 'flex-end' : 'flex-start',
                  maxWidth: '64%',
                  background: m.mine ? 'var(--red)' : '#fff',
                  border: m.mine ? 0 : '1px solid var(--line)',
                  color: m.mine ? '#fff' : 'inherit',
                  padding: '13px 16px',
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {m.text}
                <div
                  style={{
                    fontSize: 11,
                    color: m.mine ? 'var(--red-soft-2)' : 'var(--muted-3)',
                    marginTop: 5,
                    textAlign: m.mine ? 'right' : 'left',
                  }}
                >
                  {m.time}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
            }}
          >
            <Icon name="attach_file" size={22} color="var(--muted-2)" />
            <input className="field" placeholder="Sending is not wired yet" disabled style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" disabled>
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="note-quiet" style={{ flex: '1 1 380px' }}>
          <Kicker>WHAT LANDS NEXT</Kicker>
          <div style={{ marginTop: 8 }}>
            Messages hang off the assignment id, not the task, so a task with three takers has three
            separate private threads and no taker sees another's conversation.
          </div>
        </div>
        <div className="note" style={{ flex: '1 1 380px' }}>
          There are no open DMs. A thread only exists between two people who share an accepted
          assignment, which keeps the moderation surface near zero.
        </div>
      </div>
    </div>
  )
}
