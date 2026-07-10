// ADMIN QUEUE MANAGER PAGE
// Created by: Hung Hoang, 7/9/2026

import { useState } from 'react';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';
import { ChevronUp, ChevronDown, UserCheck, Users } from 'lucide-react';

export default function AdminQueue({ services, queues, onUpdateQueues }) {
  const openServices = services.filter((svc) => svc.isOpen);
  const [activeServiceId, setActiveServiceId] = useState(openServices[0]?.id ?? '');
  const queue = queues[activeServiceId] || [];
  const service = services.find((svc) => svc.id === activeServiceId);

  const serveNext = () => {
    if (!queue.length) return;
    onUpdateQueues({ ...queues, [activeServiceId]: queue.slice(1) });
  };

  const moveEntry = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= queue.length) return;
    const updated = [...queue];
    [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
    onUpdateQueues({ ...queues, [activeServiceId]: updated });
  };

  const removeEntry = (id) => {
    onUpdateQueues({ ...queues, [activeServiceId]: queue.filter((item) => item.id !== id) });
  };

  return (
    <div className="page-grid max-w-4xl">
      <div className="page-header space-between">
        <div>
          <h2>Queue Manager</h2>
          <p className="subtitle">Reorder, remove, and serve people in each queue.</p>
        </div>
        <Button variant="primary" onClick={serveNext} disabled={!queue.length}><UserCheck size={14} /> Serve Next</Button>
      </div>

      <div className="service-tabs">
        {openServices.map((svc) => (
          <button
            key={svc.id}
            type="button"
            className={`tab-button ${svc.id === activeServiceId ? 'tab-active' : ''}`}
            onClick={() => setActiveServiceId(svc.id)}
          >
            {svc.name} <span className="tab-count">{queues[svc.id]?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {service ? (
        <div className="block-card">
          <div className="block-card-header">
            <div>
              <strong>{service.name}</strong>
              <p className="text-muted">{queue.length} {queue.length === 1 ? 'person' : 'people'} · ~{queue.length * service.expectedDuration} min total wait</p>
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
                  <Badge text={entry.status === 'almost_ready' ? 'Almost Ready' : 'Waiting'} className={entry.status === 'almost_ready' ? 'badge-warning' : 'badge-muted'} />
                  <div className="queue-actions">
                    <button type="button" className="icon-btn" onClick={() => moveEntry(index, -1)} disabled={index === 0}><ChevronUp size={14} /></button>
                  <button type="button" className="icon-btn" onClick={() => moveEntry(index, 1)} disabled={index === queue.length - 1}><ChevronDown size={14} /></button>
                  <button type="button" className="icon-btn" onClick={() => removeEntry(entry.id)}>×</button>
                  </div>
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
