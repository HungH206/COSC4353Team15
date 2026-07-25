// USER HISTORY PAGE
// Created by: Hung Hoang, 7/9/2026, with logics from user.html by Sean Dang

import Badge from '../components/Badge.jsx';

export default function UserHistory({ history }) {
  const formatDate = (value) => {
    if (!value) return 'Unknown';
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="page-grid max-w-3xl">
      <div className="page-header">
        <div>
          <h2>Queue History</h2>
          <p className="subtitle">Review your past queue sessions and outcomes.</p>
        </div>
      </div>
      <div className="history-table">
        <div className="history-row history-row-head">
          <span>Service</span>
          <span>Date</span>
          <span>Wait</span>
          <span>Outcome</span>
        </div>
        {history.length === 0 ? (
          <div className="empty-state-card">
            <p>No queue history yet.</p>
          </div>
        ) : (
          history.map((item) => (
            <div key={item.id} className="history-row">
              <span>{item.serviceName}</span>
              <span>{formatDate(item.createdAt)}</span>
              <span>{item.waitMinutes} min</span>
              <span>
                <Badge text={item.outcome === 'served' ? 'Served' : 'Left'} className={item.outcome === 'served' ? 'badge-success' : 'badge-muted'} />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
