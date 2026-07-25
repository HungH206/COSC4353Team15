import { apiRequest } from './client.js';

export async function listNotifications() {
  return (await apiRequest('/notifications')).notifications;
}

export async function markNotificationRead(id) {
  return (await apiRequest(`/notifications/${id}/read`, {
    method: 'PATCH',
  })).notification;
}
