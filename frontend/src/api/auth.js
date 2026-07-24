const TOKEN_KEY = 'queuesmart_token';

async function apiRequest(path, options = {}) {
  const response = await fetch(`/api/auth${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Unable to complete the request.');
    error.fields = data.fields || {};
    throw error;
  }
  return data;
}

export async function login(email, password) {
  return apiRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(name, email, password) {
  await apiRequest('/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });

  // Registration creates the account; logging in immediately provides its token.
  return login(email, password);
}

export async function getCurrentUser(token) {
  return apiRequest('/me', {
    headers: { authorization: `Bearer ${token}` },
  });
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function loadToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
