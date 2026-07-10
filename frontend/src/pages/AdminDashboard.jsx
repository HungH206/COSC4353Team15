//ADMIN DASHBOARD PAGE
// Created by: Hung Hoang, 7/9/2026
import Badge from '../components/Badge.jsx';

export default function AdminDashboard({ services, queues }) {
  const openCount = services.filter((svc) => svc.isOpen).length;
  const totalPeople = Object.values(queues).reduce((sum, q) => sum + q.length, 0);
  const avgWait = openCount === 0 ? 0 : Math.round(
    services.filter((svc) => svc.isOpen).reduce((sum, svc) => sum + (queues[svc.id]?.length ?? 0) * svc.expectedDuration, 0) / openCount,
  );

  return (
    <div className="page-grid max-w-5xl">
      <div className="page-header">
        <div>
          <h2>Admin Dashboard</h2>
          <p className="subtitle">Live overview of services and queue health.</p>
        </div>
      </div>
      <div className="summary-cards">
        <div className="card"><p className="card-label">Total Services</p><h3>{services.length}</h3></div>
        <div className="card"><p className="card-label">Open Services</p><h3>{openCount}</h3></div>
        <div className="card"><p className="card-label">People Queued</p><h3>{totalPeople}</h3></div>
        <div className="card"><p className="card-label">Avg Wait</p><h3>{avgWait} min</h3></div>
      </div>
      <section className="block-card">
        <div className="block-card-header"><p className="subtitle uppercase">Services Overview</p></div>
        <div className="service-table">
          <div className="service-table-header">
            <span>Service</span>
            <span>Queued</span>
            <span>Wait</span>
            <span>Status</span>
          </div>
          {services.map((svc) => {
            const count = queues[svc.id]?.length ?? 0;
            return (
              <div key={svc.id} className="service-table-row">
                <div>
                  <strong>{svc.name}</strong>
                  <p className="text-muted">{svc.expectedDuration} min/person</p>
                </div>
                <div>{count} in queue</div>
                <div>{count * svc.expectedDuration} min</div>
                <Badge text={svc.isOpen ? 'Open' : 'Closed'} className={svc.isOpen ? 'badge-success' : 'badge-muted'} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
