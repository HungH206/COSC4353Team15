import { clearToken, loadToken } from './auth.js';

export async function apiRequest(path, options = {}) {
  const token = loadToken();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) clearToken();
    const error = new Error(data?.error || 'Unable to complete the request.');
    error.fields = data?.fields || {};
    throw error;
  }
  return data;
}
