// JOIN QUEUE PAGE
// Created by: Hung Hoang, 7/9/2026, with logics from user.html by Sean Dang

import { useState } from 'react';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';
import { AlertCircle } from 'lucide-react';

export default function JoinQueue({ services, waitEstimates, activeQueue, onJoin, onLeave }) {
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const openServices = services.filter((svc) => svc.isOpen);
  const closedServices = services.filter((svc) => !svc.isOpen);
  const selectedService = services.find((svc) => svc.id === selectedId);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedService) return;
    setSubmitting(true);
    setError('');
    try {
      await onJoin(selectedService);
      setSelectedId('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onLeave();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-grid">
      <div className="page-header">
        <div>
          <h2>Join a Queue</h2>
          <p className="subtitle">Pick an open service and see estimated wait time before joining.</p>
        </div>
      </div>

      {activeQueue && (
        <div className="alert-card alert-warning">
          <AlertCircle size={18} />
          <div>
            <p>Already in queue: <strong>{activeQueue.serviceName}</strong></p>
            <p>Position #{activeQueue.position}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleLeave} disabled={submitting}>Leave</Button>
        </div>
      )}

      <div className="block-card">
        <div className="block-card-header">
          <p className="subtitle uppercase">Select a Service</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field-group">
            <label htmlFor="serviceSelect" className="field-label">Service</label>
            <select
              id="serviceSelect"
              className="field-input"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={!!activeQueue}
            >
              <option value="">Choose a service...</option>
              {openServices.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} (Estimated wait: {waitEstimates[svc.id]?.estimatedWait ?? 0} mins)
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="primary" className="w-full" disabled={!selectedId || !!activeQueue || submitting}>
            {submitting ? 'Joining...' : 'Join Queue'}
          </Button>
        </form>
      </div>

      {closedServices.length > 0 && (
        <section className="closed-services">
          <p className="subtitle uppercase">Unavailable</p>
          <div className="closed-list">
            {closedServices.map((svc) => (
              <div key={svc.id} className="closed-item">
                <span>{svc.name}</span>
                <Badge text="Closed" className="badge-muted" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
