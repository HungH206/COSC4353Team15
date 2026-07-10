// USER HISTORY PAGE
// Created by: Hung Hoang, 7/9/2026, with logics from user.html by Sean Dang

import Badge from '../components/Badge.jsx';

export default function UserHistory({ history }) {
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
        {history.map((item) => (
          <div key={item.id} className="history-row">
            <span>{item.serviceName}</span>
            <span>{item.date}</span>
            <span>{item.waitMinutes} min</span>
            <span>
              <Badge text={item.outcome === 'served' ? 'Served' : 'Left'} className={item.outcome === 'served' ? 'badge-success' : 'badge-muted'} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
