import { apiRequest } from './client.js';

export async function getAllQueues() {
  return (await apiRequest('/queue')).queues;
}

export async function getMyQueues() {
  return (await apiRequest('/queue/mine')).queues;
}

export async function getQueueCounts() {
  return (await apiRequest('/queue/summary')).counts;
}

export function joinQueue(serviceId) {
  return apiRequest('/queue/join', {
    method: 'POST',
    body: JSON.stringify({ serviceId }),
  });
}

export function leaveQueue(serviceId) {
  return apiRequest('/queue/leave', {
    method: 'POST',
    body: JSON.stringify({ serviceId }),
  });
}

export function serveNext(serviceId) {
  return apiRequest(`/queue/${serviceId}/serve`, { method: 'POST' });
}
