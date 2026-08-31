import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './layout/AppShell.jsx'
import { useSession } from './session.jsx'
import { Icon, Loading } from './components/ui.jsx'

import { Login } from './screens/Login.jsx'
import { Board } from './screens/Board.jsx'
import { TaskDetail } from './screens/TaskDetail.jsx'
import { EventDetail } from './screens/EventDetail.jsx'
import { Create } from './screens/Create.jsx'
import { MyTasks } from './screens/MyTasks.jsx'
import { Messages } from './screens/Messages.jsx'
import { Checkin } from './screens/Checkin.jsx'
import { Review } from './screens/Review.jsx'
import { Profile } from './screens/Profile.jsx'
import { Emergency } from './screens/Emergency.jsx'
import { Admin } from './screens/Admin.jsx'

const FullPageLoading = () => (
  <div style={{ padding: 60, maxWidth: 520, margin: '0 auto' }}>
    <Loading label="Starting up" />
  </div>
)

function RequireUser() {
  const { me, loading } = useSession()
  const location = useLocation()
  if (loading) return <FullPageLoading />
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/** Shown around a public profile when nobody is signed in. */
function PublicChrome({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bone)' }}>
      <div
        style={{
          background: 'var(--ink)',
          color: '#fff',
          padding: '18px 34px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--red)',
            boxShadow: 'inset 0 0 0 3px var(--ink), inset 0 0 0 5px var(--gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--display)',
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          AU
        </div>
        <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 17 }}>AU Bounty</span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted-3)' }}>
          Public profile · no sign-in needed
        </span>
        <Link className="btn btn-outline-dark btn-sm" to="/login">
          <Icon name="login" size={17} color="var(--gold)" />
          Sign in
        </Link>
      </div>
      <div style={{ padding: '30px 34px 60px' }}>{children}</div>
    </div>
  )
}

/**
 * A profile link has to work for a recruiter who has never signed in, so this
 * route renders inside the app shell for a signed-in user and inside a slim
 * public header for everyone else.
 */
function ProfileRoute() {
  const { me, loading } = useSession()
  if (loading) return <FullPageLoading />
  return me ? (
    <AppShell>
      <Profile />
    </AppShell>
  ) : (
    <PublicChrome>
      <Profile />
    </PublicChrome>
  )
}

function LoginRoute() {
  const { me, loading } = useSession()
  if (loading) return <FullPageLoading />
  return me ? <Navigate to="/" replace /> : <Login />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/u/:id" element={<ProfileRoute />} />

      <Route element={<RequireUser />}>
        <Route element={<AppShell />}>
          <Route index element={<Board />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="create" element={<Create />} />
          <Route path="my-tasks" element={<MyTasks />} />
          <Route path="messages" element={<Messages />} />
          <Route path="check-in" element={<Checkin />} />
          <Route path="review/:taskId/:userId" element={<Review />} />
          <Route path="profile" element={<Profile />} />
          <Route path="emergency" element={<Emergency />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
