import { apiRequest } from './client.js';

export async function listHistory() {
  return (await apiRequest('/history')).history;
}
