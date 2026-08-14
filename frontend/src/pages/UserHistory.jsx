// USER HISTORY PAGE
// Created by: Hung Hoang, 7/9/2026, with logics from user.html by Sean Dang

import { useState } from 'react';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';

const PAGE_SIZE = 10;

export default function UserHistory({ history }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleHistory = history.slice(pageStart, pageStart + PAGE_SIZE);

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
          visibleHistory.map((item) => (
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
      {history.length > PAGE_SIZE && (
        <div className="pagination-row">
          <span>
            Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, history.length)} of {history.length}
          </span>
          <div className="pagination-actions">
            <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>
              Previous
            </Button>
            <span>Page {safePage} of {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
