import { apiRequest } from './client.js';

export async function listUserStatsReport() {
  return (await apiRequest('/reports/user-stats')).userStats;
}