// Admin report module, Darelle Herrera 08/13/2026
import { useState } from 'react';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';

const PAGE_SIZE = 10;

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

function formatMinutes(value) {
  if (value == null) return '—';
  return `${Math.round(value)} min`;
}

function formatPercent(value) {
  if (value == null) return '—';
  return `${value}%`;
}

function formatSignedMinutes(value) {
  if (value == null) return '—';
  const rounded = Math.round(value);
  if (rounded === 0) return 'On target';
  return `${rounded > 0 ? '+' : ''}${rounded} min`;
}

function formatStatus(isOpen) {
  return isOpen ? 'Open' : 'Closed';
}

const SERVICE_ACTIVITY_GRID = {
  gridTemplateColumns: 'minmax(160px, 1.4fr) minmax(180px, 1.6fr) minmax(80px, 0.7fr) minmax(80px, 0.7fr) minmax(130px, 1fr) minmax(105px, 0.8fr) minmax(105px, 0.8fr) minmax(110px, 0.8fr) minmax(95px, 0.7fr) minmax(80px, 0.65fr) minmax(105px, 0.8fr) minmax(110px, 0.85fr) minmax(150px, 1fr)',
};

export default function AdminReports({ services = [], queues = {}, userStatsReport = [], queueStatsReport = [] }) {
  const [activeTab, setActiveTab] = useState('user-history');
  const [userHistoryPage, setUserHistoryPage] = useState(1);

  //listUserStatsReport() { id, name, email, serviceName, activityAt, outcome: 'served'|'left' }
  const userStats = userStatsReport;
  const totalUserHistoryPages = Math.max(1, Math.ceil(userStats.length / PAGE_SIZE));
  const safeUserHistoryPage = Math.min(userHistoryPage, totalUserHistoryPages);
  const userHistoryStart = (safeUserHistoryPage - 1) * PAGE_SIZE;
  const visibleUserStats = userStats.slice(userHistoryStart, userHistoryStart + PAGE_SIZE);

  const queueStatsById = new Map(queueStatsReport.map((item) => [item.id, item]));
  const serviceActivity = services.map((service) => {
    const report = queueStatsById.get(service.id) ?? {};
    const currentWaiting = report.currentWaiting ?? queues[service.id]?.length ?? 0;
    const expectedDuration = report.expectedDuration ?? service.expectedDuration ?? 0;
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      priority: service.priority,
      status: formatStatus(report.isOpen ?? service.isOpen),
      createdAt: formatDateTime(report.createdAt ?? service.createdAt),
      expectedDuration: formatMinutes(expectedDuration),
      currentQueueLength: currentWaiting,
      currentEstimatedWait: formatMinutes(report.currentWaitLoadMinutes ?? currentWaiting * expectedDuration),
      usersWaiting: currentWaiting,
      served: report.served ?? 0,
      left: report.left ?? 0,
      totalInteractions: report.totalInteractions ?? report.joined ?? currentWaiting,
      lastQueueActivity: formatDateTime(report.lastActivityAt),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // store.queueStats() { id, name, joined, served, leavePercent, avgWaitMinutes, errorMinutes }
  const queueStats = queueStatsReport.map((q) => ({
    id: q.id,
    name: q.name,
    joined: q.joined,
    served: q.served,
    left: formatPercent(q.leavePercent),
    avgWait: formatMinutes(q.avgWaitMinutes),
    error: formatSignedMinutes(q.errorMinutes),
  }));

  const EXPORT_CONFIG = {
    'user-history': {
      headers: ['Name', 'Email', 'Service Requested', 'Activity Time', 'Outcome'],
      filename: 'user_history_report.csv',
      rows: userStats.map((u) => [
        u.name,
        u.email ?? '',
        u.serviceName,
        formatDateTime(u.activityAt ?? u.joinedAt),
        u.outcome === 'served' ? 'Served' : 'Left',
      ]),
    },
    'service-activity': {
      headers: ['Service', 'Description', 'Priority', 'Status', 'Created At', 'Expected Duration', 'Current Queue Length', 'Smart Estimated Wait', 'Users Waiting', 'Served', 'Left / Cancelled', 'Total Interactions', 'Last Queue Activity'],
      filename: 'service_activity_report.csv',
      rows: serviceActivity.map((s) => [
        s.name,
        s.description,
        s.priority,
        s.status,
        s.createdAt,
        s.expectedDuration,
        s.currentQueueLength,
        s.currentEstimatedWait,
        s.usersWaiting,
        s.served,
        s.left,
        s.totalInteractions,
        s.lastQueueActivity,
      ]),
    },
    'queue-stats': {
      headers: ['Service', 'Joined', 'Serviced', '% Left', 'Average Wait', 'Est Error'],
      filename: 'queue_stats_report.csv',
      rows: queueStats.map((r) => [r.name, r.joined, r.served, r.left, r.avgWait, r.error]),
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
    <div className="page-grid reports-page">
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
            <button type="button" className={`report-tab ${activeTab === 'service-activity' ? 'active' : ''}`} onClick={() => setActiveTab('service-activity')}>Service Activity</button>
            <button type="button" className={`report-tab ${activeTab === 'queue-stats' ? 'active' : ''}`} onClick={() => setActiveTab('queue-stats')}>Queue Statistics</button>
          </div>
        </div>
        <div className="block-card-body">
          <div className="table-responsive">
            {activeTab === 'user-history' && (
              <table className="service-list-table report-table">
                <thead>
                  <tr className="service-list-header">
                    <th style={{ textAlign: 'left' }}>Name</th>
                    <th>Email</th>
                    <th>Service Requested</th>
                    <th>Activity Time</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {userStats.length === 0 && (
                    <tr>
                      <td colSpan={5}>No history available.</td>
                    </tr>
                  )}
                  {visibleUserStats.map((u) => (
                    <tr key={u.id} className="service-list-row">
                      <td>
                        <strong>{u.name}</strong>
                      </td>
                      <td style={{ textAlign: 'left' }}>{u.email ?? '—'}</td>
                      <td style={{ textAlign: 'left' }}>{u.serviceName}</td>
                      <td style={{ textAlign: 'center' }}>{formatDateTime(u.activityAt ?? u.joinedAt)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge
                          text={u.outcome === 'served' ? 'Served' : 'Left'}
                          className={u.outcome === 'served' ? 'badge-success' : 'badge-muted'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'service-activity' && (
              <table className="service-list-table report-table report-table-wide">
                <thead>
                  <tr className="service-list-header" style={SERVICE_ACTIVITY_GRID}>
                    <th style={{ textAlign: 'left' }}>Service</th>
                    <th>Description</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Expected Duration</th>
                    <th>Current Queue Length</th>
                    <th>Smart Estimated Wait</th>
                    <th>Users Waiting</th>
                    <th>Served</th>
                    <th>Left / Cancelled</th>
                    <th>Total Interactions</th>
                    <th>Last Queue Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceActivity.length === 0 && (
                    <tr>
                      <td colSpan={13}>No services configured.</td>
                    </tr>
                  )}
                  {serviceActivity.map((s) => (
                    <tr key={s.id} className="service-list-row" style={SERVICE_ACTIVITY_GRID}>
                      <td>
                        <strong>{s.name}</strong>
                      </td>
                      <td>{s.description}</td>
                      <td style={{ textAlign: 'center' }}>{s.priority}</td>
                      <td style={{ textAlign: 'center' }}>{s.status}</td>
                      <td style={{ textAlign: 'center' }}>{s.createdAt}</td>
                      <td style={{ textAlign: 'center' }}>{s.expectedDuration}</td>
                      <td style={{ textAlign: 'center' }}>{s.currentQueueLength}</td>
                      <td style={{ textAlign: 'center' }}>{s.currentEstimatedWait}</td>
                      <td style={{ textAlign: 'center' }}>{s.usersWaiting}</td>
                      <td style={{ textAlign: 'center' }}>{s.served}</td>
                      <td style={{ textAlign: 'center' }}>{s.left}</td>
                      <td style={{ textAlign: 'center' }}>{s.totalInteractions}</td>
                      <td style={{ textAlign: 'center' }}>{s.lastQueueActivity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'queue-stats' && (
              <table className="service-list-table report-table">
                <thead>
                  <tr className="service-list-header">
                    <th style={{ textAlign: 'left' }}>Service</th>
                    <th>Joined</th>
                    <th>Serviced</th>
                    <th>% Left</th>
                    <th>Average Wait</th>
                    <th>Estimation Error</th>
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
                      <td style={{ textAlign: 'center' }}>{r.joined}</td>
                      <td style={{ textAlign: 'center' }}>{r.served}</td>
                      <td style={{ textAlign: 'center' }}>{r.left}</td>
                      <td style={{ textAlign: 'center' }}>{r.avgWait}</td>
                      <td style={{ textAlign: 'center' }}>{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {activeTab === 'user-history' && userStats.length > PAGE_SIZE && (
            <div className="pagination-row pagination-row-card">
              <span>
                Showing {userHistoryStart + 1}-{Math.min(userHistoryStart + PAGE_SIZE, userStats.length)} of {userStats.length}
              </span>
              <div className="pagination-actions">
                <Button variant="secondary" size="sm" onClick={() => setUserHistoryPage((current) => Math.max(1, current - 1))} disabled={safeUserHistoryPage === 1}>
                  Previous
                </Button>
                <span>Page {safeUserHistoryPage} of {totalUserHistoryPages}</span>
                <Button variant="secondary" size="sm" onClick={() => setUserHistoryPage((current) => Math.min(totalUserHistoryPages, current + 1))} disabled={safeUserHistoryPage === totalUserHistoryPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
