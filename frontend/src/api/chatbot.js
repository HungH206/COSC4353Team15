import { apiRequest } from './client.js';

export function askQueueAssistant(message) {
  return apiRequest('/chatbot', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
