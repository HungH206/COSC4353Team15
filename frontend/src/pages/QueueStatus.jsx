// QUEUE STATUS PAGE
// Created by: Hung Hoang, 7/9/2026, with logics from user.html by Sean Dang
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';

export default function QueueStatus({ activeQueue, services, queues, onLeave }) {
  if (!activeQueue) {
    return (
      <div className="empty-state-card">
        <h2>Queue Status</h2>
        <p className="subtitle">You are not currently in a queue. Join a queue to see status updates.</p>
      </div>
    );
  }

  const service = services.find((svc) => svc.id === activeQueue.serviceId);
  const queue = queues[activeQueue.serviceId] ?? [];
  const aheadCount = activeQueue.position - 1;
  const estWait = aheadCount * (service?.expectedDuration ?? 10);

  return (
    <div className="page-grid">
      <div className="page-header">
        <div>
          <h2>Queue Status</h2>
          <p className="subtitle">Track your position and queue progress.</p>
        </div>
      </div>
{/* Modified by Osy (7/10/26): left-aligned status card (styles in App.css) */}
      <div className="status-card">
        <div>
          <p className="badge badge-primary uppercase">Your Position</p>
          <h1>#{activeQueue.position}</h1>
          <p>{service?.name}</p>
        </div>
        <div className="status-grid">
          <div>
            <h3>{aheadCount}</h3>
            <p>ahead of you</p>
          </div>
          <div>
            <h3>~{estWait}</h3>
            <p>min est. wait</p>
          </div>
          <div>
            <h3>{queue.length}</h3>
            <p>total in queue</p>
          </div>
        </div>
      </div>

      <section className="block-card">
        <div className="block-card-header"><p className="subtitle uppercase">Queue Order</p></div>
        <div className="queue-list">
          {queue.map((entry, index) => (
            <div key={entry.id} className={`queue-item ${index + 1 === activeQueue.position ? 'queue-item-active' : ''}`}>
              <span className="queue-index">{index + 1}</span>
              <div className="queue-info">
                <p>{index + 1 === activeQueue.position ? 'You' : entry.name}</p>
                <p className="text-muted">Joined {entry.joinedAt}</p>
              </div>
              <Badge text={entry.status === 'almost_ready' ? 'Almost Ready' : 'Waiting'} className={entry.status === 'almost_ready' ? 'badge-warning' : 'badge-muted'} />
            </div>
          ))}
        </div>
      </section>

      <Button variant="danger" onClick={onLeave}>Leave Queue</Button>
    </div>
  );
}
