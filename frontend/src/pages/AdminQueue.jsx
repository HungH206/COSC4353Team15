// ADMIN QUEUE MANAGER PAGE
// Created by: Hung Hoang, 7/9/2026

import { useEffect, useState } from 'react';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';
import { UserCheck, Users } from 'lucide-react';

export default function AdminQueue({ services, queues, onServeNext }) {
  const openServices = services.filter((service) => service.isOpen);
  const [activeServiceId, setActiveServiceId] = useState(openServices[0]?.id ?? '');
  const [error, setError] = useState('');
  const [serving, setServing] = useState(false);

  useEffect(() => {
    if (!openServices.some((service) => service.id === activeServiceId)) {
      setActiveServiceId(openServices[0]?.id ?? '');
    }
  }, [activeServiceId, openServices]);

  const queue = queues[activeServiceId] || [];
  const service = services.find((item) => item.id === activeServiceId);

  const serveNext = async () => {
    if (!queue.length) return;
    setServing(true);
    setError('');
    try {
      await onServeNext(activeServiceId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setServing(false);
    }
  };

  return (
    <div className="page-grid max-w-4xl">
      <div className="page-header space-between">
        <div>
          <h2>Queue Manager</h2>
          <p className="subtitle">View each queue and serve users in arrival order.</p>
        </div>
        <Button variant="primary" onClick={serveNext} disabled={!queue.length || serving}>
          <UserCheck size={14} /> {serving ? 'Serving...' : 'Serve Next'}
        </Button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="service-tabs">
        {openServices.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab-button ${item.id === activeServiceId ? 'tab-active' : ''}`}
            onClick={() => setActiveServiceId(item.id)}
          >
            {item.name} <span className="tab-count">{queues[item.id]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {service ? (
        <div className="block-card">
          <div className="block-card-header">
            <div>
              <strong>{service.name}</strong>
              <p className="text-muted">
                {queue.length} {queue.length === 1 ? 'person' : 'people'} · ~{queue.length * service.expectedDuration} min total wait
              </p>
            </div>
          </div>
          {queue.length === 0 ? (
            <div className="empty-state-card">
              <Users size={24} />
              <p>No one is currently waiting.</p>
            </div>
          ) : (
            <div className="queue-list">
              {queue.map((entry, index) => (
                <div key={entry.id} className={`queue-item ${index === 0 ? 'queue-item-first' : ''}`}>
                  <span className="queue-index">{index + 1}</span>
                  <div>
                    <p>{entry.name}</p>
                    <p className="text-muted">Joined {entry.joinedAt}</p>
                  </div>
                  <Badge
                    text={entry.status === 'almost_ready' ? 'Almost Ready' : 'Waiting'}
                    className={entry.status === 'almost_ready' ? 'badge-warning' : 'badge-muted'}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state-card">
          <p className="text-muted">No open services available.</p>
        </div>
      )}
    </div>
  );
}
