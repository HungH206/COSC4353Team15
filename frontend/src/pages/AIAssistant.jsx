import QueueAssistant from '../components/QueueAssistant.jsx';

export default function AIAssistant({ role = 'user' }) {
  const isAdmin = role === 'admin';

  return (
    <div className="page-grid">
      <div className="page-header">
        <div>
          <h2>AI Assistant</h2>
          <p className="subtitle">
            {isAdmin
              ? 'Ask natural-language questions about queue load, bottlenecks, and service activity.'
              : 'Ask natural-language questions about your current queue status.'}
          </p>
        </div>
      </div>

      <QueueAssistant role={role} fullHeight />
    </div>
  );
}
