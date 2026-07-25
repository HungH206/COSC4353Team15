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
import { HISTORY } from './data/mockData.js';
import { clearToken, getCurrentUser, loadToken, saveToken } from './api/auth.js';
import { createService, deleteService, listServices, updateService } from './api/services.js';
import { getAllQueues, getMyQueues, getQueueCounts, joinQueue, leaveQueue, serveNext } from './api/queue.js';
import { getWaitTimeEstimate, listWaitTimeEstimates } from './api/timeEstimation.js';
import { listNotifications, markNotificationRead } from './api/notifications.js';

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
  const [services, setServices] = useState([]);
  const [queues, setQueues] = useState({});
  const [notifs, setNotifs] = useState([]);
  const [activeQueue, setActiveQueue] = useState(null);
  const [waitEstimates, setWaitEstimates] = useState({});
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
        setPage(savedUser.role === 'admin' ? 'admin-dashboard' : 'user-dashboard');
      })
      .catch(clearToken)
      .finally(() => setCheckingSession(false));
  }, []);

  const handleLogin = ({ user: authUser, token }) => {
    saveToken(token);
    setUser(authUser);
    setNotifs([]);
    setPage(authUser.role === 'admin' ? 'admin-dashboard' : 'user-dashboard');
    setShowNotifs(false);
  };

  const handleRegister = handleLogin;

  const handleLogout = () => {
    clearToken();
    setUser(null);
    setPage('login');
    setActiveQueue(null);
    setServices([]);
    setQueues({});
    setWaitEstimates({});
    setNotifs([]);
  };

  useEffect(() => {
    if (!user) return;

    const loadApplicationData = async () => {
      try {
        const [loadedServices, loadedNotifications] = await Promise.all([
          listServices(),
          listNotifications(),
        ]);
        setServices(loadedServices);
        setNotifs(loadedNotifications);

        if (user.role === 'admin') {
          setQueues(await getAllQueues());
          return;
        }

        const [memberships, counts, estimates] = await Promise.all([
          getMyQueues(),
          getQueueCounts(),
          listWaitTimeEstimates(),
        ]);
        const queueCounts = Object.fromEntries(
          Object.entries(counts).map(([serviceId, count]) => [serviceId, Array(count).fill(null)]),
        );
        const current = memberships[0] ?? null;
        if (current) queueCounts[current.serviceId] = current.queue;
        setQueues(queueCounts);
        setWaitEstimates(estimates);
        setActiveQueue(current ? {
          serviceId: current.serviceId,
          serviceName: current.serviceName,
          position: current.position,
          estWait: current.estWait,
          entryId: current.entry.id,
        } : null);
      } catch (error) {
        pushNotification(error.message, 'warning');
      }
    };

    loadApplicationData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const refreshNotifications = async () => {
      try {
        setNotifs(await listNotifications());
      } catch {
        // Session and connection errors are handled by normal application requests.
      }
    };
    const interval = setInterval(refreshNotifications, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const markRead = async (id) => {
    if (!id.startsWith('local_')) {
      try {
        await markNotificationRead(id);
      } catch {
        return;
      }
    }
    setNotifs((previous) => previous.map((item) => item.id === id ? { ...item, read: true } : item));
  };

  const pushNotification = (message, type = 'info') => {
    setNotifs((prev) => [
      { id: `local_${Date.now()}`, message, type, time: 'Just now', read: false },
      ...prev,
    ]);
  };

  const handleJoinQueue = async (service) => {
    const result = await joinQueue(service.id);
    const [estimate, notifications] = await Promise.all([
      getWaitTimeEstimate(service.id),
      listNotifications(),
    ]);
    setQueues((previous) => ({
      ...previous,
      [service.id]: [...(previous[service.id] || []).filter(Boolean), result.entry],
    }));
    setActiveQueue({
      serviceId: service.id,
      position: result.position,
      serviceName: service.name,
      estWait: result.estWait,
      entryId: result.entry.id,
    });
    setWaitEstimates((previous) => ({ ...previous, [service.id]: estimate }));
    setNotifs(notifications);
    setPage('user-status');
  };

  const handleLeaveQueue = async () => {
    if (!activeQueue) return;
    await leaveQueue(activeQueue.serviceId);
    const estimates = await listWaitTimeEstimates();
    setQueues((prev) => ({
      ...prev,
      [activeQueue.serviceId]: (prev[activeQueue.serviceId] || []).filter((entry) => entry?.id !== activeQueue.entryId),
    }));
    pushNotification(`You left the ${activeQueue.serviceName} queue.`, 'warning');
    setActiveQueue(null);
    setWaitEstimates(estimates);
  };

  const handleSaveService = async (service, id) => {
    const saved = id ? await updateService(id, service) : await createService(service);
    setServices((previous) => id
      ? previous.map((item) => item.id === id ? saved : item)
      : [...previous, saved]);
    return saved;
  };

  const handleDeleteService = async (id) => {
    await deleteService(id);
    setServices((previous) => previous.filter((service) => service.id !== id));
    setQueues((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  };

  const handleServeNext = async (serviceId) => {
    const result = await serveNext(serviceId);
    setQueues(await getAllQueues());
    pushNotification(`${result.served.name} was served.`, 'success');
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
        return <JoinQueue services={services} waitEstimates={waitEstimates} activeQueue={activeQueue} onJoin={handleJoinQueue} onLeave={handleLeaveQueue} />;
      case 'user-status':
        return <QueueStatus activeQueue={activeQueue} services={services} queues={queues} estimate={waitEstimates[activeQueue?.serviceId]} onLeave={handleLeaveQueue} />;
      case 'user-history':
        return <UserHistory history={HISTORY} />;
      case 'admin-dashboard':
        return <AdminDashboard services={services} queues={queues} />;
      case 'admin-services':
        return <AdminServices services={services} onSaveService={handleSaveService} onDeleteService={handleDeleteService} />;
      case 'admin-queue':
        return <AdminQueue services={services} queues={queues} onServeNext={handleServeNext} />;
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
