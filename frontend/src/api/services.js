import { apiRequest } from './client.js';

export async function listServices() {
  return (await apiRequest('/services')).services;
}

export async function createService(service) {
  return (await apiRequest('/services', {
    method: 'POST',
    body: JSON.stringify(service),
  })).service;
}

export async function updateService(id, service) {
  return (await apiRequest(`/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(service),
  })).service;
}

export async function deleteService(id) {
  await apiRequest(`/services/${id}`, { method: 'DELETE' });
}
