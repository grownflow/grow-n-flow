const API_BASE = '/api/auth';

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

export async function register({ email, username, password, signupCode }) {
  return jsonFetch(`${API_BASE}/register`, {
    method: 'POST',
    body: JSON.stringify({ email, username, password, signupCode }),
  });
}

export async function login({ identifier, password }) {
  return jsonFetch(`${API_BASE}/login`, {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export async function me() {
  return jsonFetch(`${API_BASE}/me`, { method: 'GET' });
}

export async function logout() {
  return jsonFetch(`${API_BASE}/logout`, { method: 'POST' });
}
