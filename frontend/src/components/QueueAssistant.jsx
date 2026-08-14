import { useState } from 'react';
import Button from './Button.jsx';
import { askQueueAssistant } from '../api/chatbot.js';

const STARTER_QUESTIONS = [
  'How long is my wait?',
  'Am I next?',
  'Should I stay in this queue?',
];

const ADMIN_STARTER_QUESTIONS = [
  'Which queue needs attention?',
  'Where should staff focus next?',
  'Which service has the highest wait load?',
];

export default function QueueAssistant({ className = '', fullHeight = false, role = 'user' }) {
  const isAdmin = role === 'admin';
  const starterQuestions = isAdmin ? ADMIN_STARTER_QUESTIONS : STARTER_QUESTIONS;
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: isAdmin
        ? 'Ask me which queues need attention, where staff should focus, or what service activity looks unusual.'
        : 'Ask me about your queue position, wait time, or whether another service may be faster.',
      source: 'local',
    },
  ]);

  const askAssistant = async (question = chatInput) => {
    const message = question.trim();
    if (!message || chatLoading) return;

    setChatInput('');
    setChatError('');
    setChatLoading(true);
    setMessages((previous) => [...previous, { role: 'user', text: message }]);

    try {
      const result = await askQueueAssistant(message);
      setMessages((previous) => [...previous, {
        role: 'assistant',
        text: result.answer,
        source: result.source,
        fallbackReason: result.fallbackReason,
      }]);
    } catch (requestError) {
      setChatError(requestError.message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <section className={`assistant-card ${fullHeight ? 'assistant-card-large' : ''} ${className}`.trim()}>
      <div className="assistant-header">
        <div>
          <p className="subtitle uppercase">{isAdmin ? 'AI Admin Assistant' : 'AI Queue Assistant'}</p>
          <h3>{isAdmin ? 'Ask about queue operations' : 'Ask about your queue'}</h3>
        </div>
        <span className="assistant-status">Read-only</span>
      </div>

      <div className="assistant-messages" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`assistant-message assistant-message-${message.role}`}>
            <span>{message.text}</span>
            {message.role === 'assistant' && message.source && message.source !== 'local' && (
              <span className="assistant-source">
                {message.source === 'ai-api' ? 'AI API' : `Fallback${message.fallbackReason ? `: ${message.fallbackReason}` : ''}`}
              </span>
            )}
          </div>
        ))}
        {chatLoading && <div className="assistant-message assistant-message-assistant">Checking your live queue status...</div>}
      </div>

      {chatError && <div className="alert alert-error">{chatError}</div>}

      <div className="assistant-starters">
        {starterQuestions.map((question) => (
          <button key={question} type="button" onClick={() => askAssistant(question)} disabled={chatLoading}>
            {question}
          </button>
        ))}
      </div>

      <form className="assistant-form" onSubmit={(event) => {
        event.preventDefault();
        askAssistant();
      }}>
        <input
          type="text"
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
          placeholder={isAdmin ? 'Ask an admin queue operations question' : 'Ask a queue status question'}
          maxLength={500}
        />
        <Button type="submit" disabled={chatLoading || !chatInput.trim()}>
          Ask
        </Button>
      </form>
    </section>
  );
}
