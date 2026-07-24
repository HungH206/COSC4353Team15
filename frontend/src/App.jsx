// App.tsx, designed to hold the logic states and render the main components of the application

import { useEffect, useState } from 'react';
import './App.css';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import JoinQueue from './pages/JoinQueue.jsx';
import QueueStatus from './pages/QueueStatus.jsx';
import UserHistory from './pages/UserHistory.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminServices from './pages/AdminServices.jsx';
import AdminQueue from './pages/AdminQueue.jsx';
import NotificationPanel from './components/NotificationPanel.jsx';
import { INIT_SERVICES, INIT_QUEUES, HISTORY, getInitialNotifications } from './data/mockData.js';
import { clearToken, getCurrentUser, loadToken, saveToken } from './api/auth.js';

const USER_NAV = [
  { id: 'user-dashboard', label: 'Dashboard' },
  { id: 'user-join', label: 'Join Queue' },
  { id: 'user-status', label: 'Queue Status' },
  { id: 'user-history', label: 'History' },
];

const ADMIN_NAV = [
  { id: 'admin-dashboard', label: 'Dashboard' },
  { id: 'admin-services', label: 'Services' },
  { id: 'admin-queue', label: 'Queue Manager' },
];

export default function App() {
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [services, setServices] = useState(INIT_SERVICES);
  const [queues, setQueues] = useState(INIT_QUEUES);
  const [notifs, setNotifs] = useState(() => getInitialNotifications('user'));
  const [activeQueue, setActiveQueue] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = loadToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }

    getCurrentUser(token)
      .then(({ user: savedUser }) => {
        setUser(savedUser);
        setNotifs(getInitialNotifications(savedUser.role));
        setPage(savedUser.role === 'admin' ? 'admin-dashboard' : 'user-dashboard');
      })
      .catch(clearToken)
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = ({ user: authUser, token }) => {
    saveToken(token);
    setUser(authUser);
    setNotifs(getInitialNotifications(authUser.role));
    setPage(authUser.role === 'admin' ? 'admin-dashboard' : 'user-dashboard');
    setShowNotifs(false);
  };

  const handleRegister = handleLogin;

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setPage('login');
    setActiveQueue(null);
  };

  const markRead = (id) => {
    setNotifs((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const pushNotification = (message, type = 'info') => {
    setNotifs((prev) => [
      { id: `n_${Date.now()}`, message, type, time: 'Just now', read: false },
      ...prev,
    ]);
  };

  const handleJoinQueue = (service) => {
    const userEntry = {
      id: `q_${Date.now()}`,
      name: user.name,
      joinedAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      status: 'waiting',
    };
    const nextQueue = [...(queues[service.id] || []), userEntry];
    setQueues((prev) => ({ ...prev, [service.id]: nextQueue }));
    setActiveQueue({ serviceId: service.id, position: nextQueue.length, serviceName: service.name });
    pushNotification(`You joined the ${service.name} queue at position #${nextQueue.length}.`, 'success');
    setPage('user-status');
  };

  const handleLeaveQueue = () => {
    if (!activeQueue) return;
    setQueues((prev) => ({
      ...prev,
      [activeQueue.serviceId]: (prev[activeQueue.serviceId] || []).filter((entry) => entry.name !== user.name),
    }));
    pushNotification(`You left the ${activeQueue.serviceName} queue.`, 'warning');
    setActiveQueue(null);
  };

  const currentNav = user?.role === 'admin' ? ADMIN_NAV : USER_NAV;
  const currentPageLabel = currentNav.find((item) => item.id === page)?.label || '';
  const unreadCount = notifs.filter((item) => !item.read).length;

  if (checkingSession) return null;

  const renderPage = () => {
    if (!user) return null;
    switch (page) {
      case 'user-dashboard':
        return <UserDashboard user={user} services={services} queues={queues} notifs={notifs} activeQueue={activeQueue} onNavigate={setPage} />;
      case 'user-join':
        return <JoinQueue services={services} queues={queues} activeQueue={activeQueue} onJoin={handleJoinQueue} onLeave={handleLeaveQueue} />;
      case 'user-status':
        return <QueueStatus activeQueue={activeQueue} services={services} queues={queues} onLeave={handleLeaveQueue} />;
      case 'user-history':
        return <UserHistory history={HISTORY} />;
      case 'admin-dashboard':
        return <AdminDashboard services={services} queues={queues} />;
      case 'admin-services':
        return <AdminServices services={services} onUpdateServices={setServices} />;
      case 'admin-queue':
        return <AdminQueue services={services} queues={queues} onUpdateQueues={setQueues} />;
      default:
        return null;
    }
  };

  if (!user) {
    return page === 'register' ? (
      <Register onRegister={handleRegister} onGoLogin={() => setPage('login')} />
    ) : (
      <Login onLogin={handleLogin} onGoRegister={() => setPage('register')} />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand-top">
          <div className="brand-logo">QueueSmart</div>
          <span className={`role-pill role-pill-${user.role}`}>{user.role.toUpperCase()}</span>
        </div>

        <div className="sidebar-nav">
          {currentNav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <div className="sidebar-status">
            <span>Signed in as</span>
            <strong>{user.role === 'admin' ? 'Administrator' : 'User'}</strong>
          </div>
          <button type="button" className="btn btn-ghost btn-sm w-full" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div>
            <p className="topbar-label">{currentPageLabel}</p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="icon-btn" onClick={() => setShowNotifs((visible) => !visible)}>
              Notifications
              {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
            </button>
          </div>
          {showNotifs && <NotificationPanel notifs={notifs} onClose={() => setShowNotifs(false)} onRead={markRead} />}
        </header>
        <main className="main-content">{renderPage()}</main>
      </div>
    </div>
  );
}
