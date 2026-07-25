import { apiRequest } from './client.js';

export async function listWaitTimeEstimates() {
  return (await apiRequest('/time-estimation')).estimates;
}

export async function getWaitTimeEstimate(serviceId) {
  return (await apiRequest(`/time-estimation/${serviceId}`)).estimate;
}
