import QueueAssistant from '../components/QueueAssistant.jsx';

export default function AIAssistant() {
  return (
    <div className="page-grid">
      <div className="page-header">
        <div>
          <h2>AI Assistant</h2>
          <p className="subtitle">Ask natural-language questions about your current queue status.</p>
        </div>
      </div>

      <QueueAssistant fullHeight />
    </div>
  );
}
