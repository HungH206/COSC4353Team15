// USER DASHBOARD PAGE
// Created by: Hung Hoang, 7/9/2026, with logics from user.html by Sean Dang

import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import { ArrowRight } from 'lucide-react';

export default function UserDashboard({ user, services, queues, notifs, activeQueue, onNavigate }) {
  const openServices = services.filter((svc) => svc.isOpen);
  const totalWaiting = Object.values(queues).reduce((sum, queue) => sum + queue.length, 0);
  const unread = notifs.filter((item) => !item.read).length;
  const latestNotifs = notifs.slice(0, 3);

  return (
    <div className="page-grid">
      <div className="page-header">
        <div>
          <h2>Welcome back, {user.name.split(' ')[0]}!</h2>
          <p className="subtitle">Here is an overview of your current status.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <p className="card-label">Current Queue Status</p>
          {activeQueue ? (
            <>
              <p className="card-note">You are currently waiting for <strong>{activeQueue.serviceName}</strong>.</p>
              <Button variant="primary" onClick={() => onNavigate('user-status')}>
                View Live Status <ArrowRight size={14} />
              </Button>
            </>
          ) : (
            <>
              <p className="card-note">You are not currently in a queue.</p>
              <Button variant="primary" onClick={() => onNavigate('user-join')}>
                Join a queue
              </Button>
            </>
          )}
        </div>

        <div className="card">
          <p className="card-label">Recent Notifications</p>
          {latestNotifs.length > 0 ? (
            latestNotifs.map((item) => (
              <div key={item.id} className="notification-item" style={{ marginBottom: '0.85rem' }}>
                <p style={{ margin: 0 }}>{item.message}</p>
                <p className="text-muted" style={{ margin: '0.45rem 0 0', fontSize: '0.85rem' }}>{item.time}</p>
              </div>
            ))
          ) : (
            <p className="card-note">No new notifications.</p>
          )}
          <Button variant="ghost" onClick={() => onNavigate('user-history')}>
            View history
          </Button>
        </div>
      </div>

      <section className="block-card">
        <div className="block-card-header">
          <p className="subtitle uppercase">Active Services</p>
          <Button variant="ghost" onClick={() => onNavigate('user-join')}>Join a queue</Button>
        </div>
        <div className="service-list">
          {openServices.map((svc) => {
            const wait = (queues[svc.id]?.length ?? 0) * svc.expectedDuration;
            return (
              <div key={svc.id} className="service-card">
                <div>
                  <h4>{svc.name}</h4>
                  <p className="text-muted">{queues[svc.id]?.length ?? 0} waiting · ~{wait} min</p>
                </div>
                <Badge text={svc.priority} className={svc.priority === 'high' ? 'badge-danger' : svc.priority === 'medium' ? 'badge-warning' : 'badge-success'} />
                <Button variant="ghost" onClick={() => onNavigate('user-join')}>Join</Button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
