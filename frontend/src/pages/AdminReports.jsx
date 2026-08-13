//Admin report module, Darelle Herrera 08/13/2026
import React, { useMemo, useState } from 'react';
import Button from '../components/Button.jsx';


function parseTime(value) {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

function fmtMinutes(ms) {
	if (ms == null) return '—';
	const mins = Math.round(ms / 60000);
	return `${mins}m`;
}

export default function AdminReports({ services = [], queues = {}, history = [] }) {
	const serviceList = services || [];
	const [activeTab, setActiveTab] = useState('user-history');

	const stats = useMemo(() => {
		const byService = {};
		serviceList.forEach((s) => {
			byService[s.id] = {
				serviceName: s.name,
				servedCount: 0,
				avgWaitMs: null,
				estAccuracyPct: null,
				leftCount: 0,
				waitingNow: (queues[s.id] || []).length,
			};
		});

		if (!Array.isArray(history) || history.length === 0) return byService;

		const grouped = {};
		history.forEach((h) => {
			const sid = h.serviceId || h.service?.id;
			if (!sid) return;
			grouped[sid] = grouped[sid] || [];
			grouped[sid].push(h);
		});

		Object.entries(grouped).forEach(([sid, items]) => {
			const target = byService[sid] || { serviceName: sid };
			const served = items.filter((it) => it.served || it.status === 'served' || it.status === 'completed' || (it.servedAt && !it.leftAt));
			const left = items.filter((it) => it.leftAt || it.status === 'left' || it.status === 'cancelled' || it.left === true);

			const waitMs = [];
			const estDiffs = [];
			served.forEach((it) => {
				const entered = parseTime(it.enteredAt || it.createdAt || it.entered);
				const servedAt = parseTime(it.servedAt || it.completedAt || it.served);
				if (entered && servedAt) waitMs.push(servedAt - entered);
				const est = Number(it.estWait ?? it.estimatedWait ?? it.est);
				if (!Number.isNaN(est) && entered && servedAt) {
					const actualMin = (servedAt - entered) / 60000;
					if (actualMin > 0) estDiffs.push(Math.abs(est - actualMin) / actualMin);
				}
			});

			const avgWaitMs = waitMs.length ? Math.round(waitMs.reduce((a, b) => a + b, 0) / waitMs.length) : null;
			const estAccuracyPct = estDiffs.length ? Math.round((1 - (estDiffs.reduce((a, b) => a + b, 0) / estDiffs.length)) * 100) : null;

			target.servedCount = served.length;
			target.avgWaitMs = avgWaitMs;
			target.estAccuracyPct = estAccuracyPct;
			target.leftCount = left.length;
			target.waitingNow = (queues[sid] || []).length;
			byService[sid] = target;
		});

		return byService;
	}, [serviceList, queues, history]);

	const rows = serviceList.map((s) => ({
		id: s.id,
		name: s.name,
		served: stats[s.id]?.servedCount ?? '—',
		avgWait: fmtMinutes(stats[s.id]?.avgWaitMs),
		accuracy: stats[s.id]?.estAccuracyPct == null ? '—' : `${stats[s.id].estAccuracyPct}%`,
		left: stats[s.id]?.leftCount ?? '—',
		waiting: stats[s.id]?.waitingNow ?? (queues[s.id] || []).length,
	}));

	// user history aggregates
	const userStats = useMemo(() => {
		const map = {};
		(history || []).forEach((h) => {
			const uid = h.userId || h.user?.id || h.userId;
			if (!uid) return;
			map[uid] = map[uid] || { name: h.userName || h.user?.name || uid, queuesJoined: 0, served: 0, left: 0, services: new Set() };
			map[uid].queuesJoined += 1;
			if ((h.outcome || h.status || '').toLowerCase().includes('serv')) map[uid].served += 1;
			if ((h.outcome || h.status || '').toLowerCase().includes('left') || (h.outcome || '').toLowerCase() === 'left') map[uid].left += 1;
			if (h.serviceName) map[uid].services.add(h.serviceName);
		});
		return Object.entries(map).map(([id, v]) => ({ id, name: v.name, queuesJoined: v.queuesJoined, served: v.served, left: v.left, services: Array.from(v.services).join(', ') }));
	}, [history]);

	// service details (status + activity)
	const serviceDetails = useMemo(() => serviceList.map((s) => ({
		id: s.id,
		name: s.name,
		description: s.description || '—',
		priority: s.priority || 'medium',
		status: s.deletedAt ? `Deleted ${new Date(s.deletedAt).toLocaleString()}` : (s.isOpen ? `Open` : `Closed`),
		statusDate: s.updatedAt || s.createdAt || '—',
		duration: s.expectedDuration ? `${s.expectedDuration}m` : '—',
	})), [serviceList]);

	const handleExportCSV = () => {
		const header = ['Service','Served Count','Avg Wait','Est Accuracy','Left Without Service','Waiting Now'];
		const lines = [header.join(',')];
		rows.forEach((r) => {
			const line = [r.name, r.served, r.avgWait, r.accuracy, r.left, r.waiting].map((v) => `"${String(v).replace(/"/g,'""')}"`).join(',');
			lines.push(line);
		});
		const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'queue_reports.csv';
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
										<th>Queues Joined</th>
										<th># Times Serviced</th>
										<th># Times Left</th>
										<th>Services Queued For</th>
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
											<td style={{ textAlign: 'center' }}>{u.queuesJoined}</td>
											<td style={{ textAlign: 'center' }}>{u.served}</td>
											<td style={{ textAlign: 'center' }}>{u.left}</td>
											<td style={{ textAlign: 'left' }}>{u.services}</td>
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
									{rows.length === 0 && (
										<tr>
											<td colSpan={6}>No services configured.</td>
										</tr>
									)}
									{rows.map((r) => (
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

