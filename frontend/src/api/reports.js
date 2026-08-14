import { apiRequest } from './client.js';

export async function listUserStatsReport() {
  return (await apiRequest('/reports/user-stats')).userStats;
}

export async function listQueueStatsReport() {
  return (await apiRequest('/reports/queue-stats')).queueStats;
}