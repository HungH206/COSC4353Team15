// Admin report module, Darelle Herrera 08/13/2026
import { useState } from 'react';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AdminReports({ services = [], queues = {}, userStatsReport = [] }) {
  const [activeTab, setActiveTab] = useState('user-history');

  //listUserStatsReport() { id, name, email, serviceName, joinedAt, outcome: 'served'|'left', outcomeAt }
  const userStats = userStatsReport;

  // TODO: map `services` into report rows
  // shape: { id, name, description, priority, status, duration }
  const serviceDetails = [];

  // TODO: combine `services` + `queues` + `history` into per-service stats
  // shape: { id, name, served, avgWait, accuracy, left, waiting }
  const queueStats = [];

  const EXPORT_CONFIG = {
    'user-history': {
      headers: ['Name', 'Email', 'Service Requested', 'Join Time', 'Status'],
      filename: 'user_history_report.csv',
      rows: userStats.map((u) => [
        u.name,
        u.email ?? '',
        u.serviceName,
        formatDateTime(u.joinedAt),
        `${u.outcome === 'served' ? 'Served' : 'Left'} (${formatDateTime(u.outcomeAt)})`,
      ]),
    },
    'service-details': {
      headers: ['Service', 'Description', 'Priority', 'Status', 'Duration'],
      filename: 'service_details_report.csv',
      rows: serviceDetails.map((s) => [s.name, s.description, s.priority, s.status, s.duration]),
    },
    'queue-stats': {
      headers: ['Service', 'Served', 'Avg Wait', 'Est Accuracy', 'Left', 'Waiting'],
      filename: 'queue_stats_report.csv',
      rows: queueStats.map((r) => [r.name, r.served, r.avgWait, r.accuracy, r.left, r.waiting]),
    },
  };

  const handleExportCSV = () => {
    const config = EXPORT_CONFIG[activeTab];
    if (!config) return;

    const lines = [config.headers, ...config.rows].map((row) =>
      row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','),
    );

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = config.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-grid max-w-5xl">
      <div className="page-header space-between">
        <div>
          <h2>Reports</h2>
          <p className="subtitle">Service and queue activity history.</p>
        </div>
        <div>
          <Button variant="primary" onClick={handleExportCSV}>Export CSV</Button>
        </div>
      </div>

      <div className="block-card">
        <div className="block-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="tab-controls">
            <button type="button" className={`report-tab ${activeTab === 'user-history' ? 'active' : ''}`} onClick={() => setActiveTab('user-history')}>User History</button>
            <button type="button" className={`report-tab ${activeTab === 'service-details' ? 'active' : ''}`} onClick={() => setActiveTab('service-details')}>Service Details</button>
            <button type="button" className={`report-tab ${activeTab === 'queue-stats' ? 'active' : ''}`} onClick={() => setActiveTab('queue-stats')}>Queue Statistics</button>
          </div>
        </div>
        <div className="block-card-body">
          <div className="table-responsive">
            {activeTab === 'user-history' && (
              <table className="service-list-table" style={{ width: '100%' }}>
                <thead>
                  <tr className="service-list-header">
                    <th style={{ textAlign: 'left' }}>Name</th>
                    <th>Email</th>
                    <th>Service Requested</th>
                    <th>Join Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {userStats.length === 0 && (
                    <tr>
                      <td colSpan={5}>No history available.</td>
                    </tr>
                  )}
                  {userStats.map((u) => (
                    <tr key={u.id} className="service-list-row">
                      <td>
                        <strong>{u.name}</strong>
                      </td>
                      <td style={{ textAlign: 'left' }}>{u.email ?? '—'}</td>
                      <td style={{ textAlign: 'left' }}>{u.serviceName}</td>
                      <td style={{ textAlign: 'center' }}>{formatDateTime(u.joinedAt)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge
                          text={u.outcome === 'served' ? 'Served' : 'Left'}
                          className={u.outcome === 'served' ? 'badge-success' : 'badge-muted'}
                        />
                        <div className="text-muted">{formatDateTime(u.outcomeAt)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'service-details' && (
              <table className="service-list-table" style={{ width: '100%' }}>
                <thead>
                  <tr className="service-list-header">
                    <th style={{ textAlign: 'left' }}>Service</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceDetails.length === 0 && (
                    <tr>
                      <td colSpan={5}>No services configured.</td>
                    </tr>
                  )}
                  {serviceDetails.map((s) => (
                    <tr key={s.id} className="service-list-row">
                      <td>
                        <strong>{s.name}</strong>
                      </td>
                      <td>{s.description}</td>
                      <td style={{ textAlign: 'center' }}>{s.priority}</td>
                      <td style={{ textAlign: 'center' }}>{s.status}</td>
                      <td style={{ textAlign: 'center' }}>{s.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'queue-stats' && (
              <table className="service-list-table" style={{ width: '100%' }}>
                <thead>
                  <tr className="service-list-header">
                    <th style={{ textAlign: 'left' }}>Service</th>
                    <th>Served</th>
                    <th>Avg Wait</th>
                    <th>Est Accuracy</th>
                    <th>Left</th>
                    <th>Waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {queueStats.length === 0 && (
                    <tr>
                      <td colSpan={6}>No services configured.</td>
                    </tr>
                  )}
                  {queueStats.map((r) => (
                    <tr key={r.id} className="service-list-row">
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td style={{ textAlign: 'center' }}>{r.served}</td>
                      <td style={{ textAlign: 'center' }}>{r.avgWait}</td>
                      <td style={{ textAlign: 'center' }}>{r.accuracy}</td>
                      <td style={{ textAlign: 'center' }}>{r.left}</td>
                      <td style={{ textAlign: 'center' }}>{r.waiting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}