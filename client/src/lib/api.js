const rawBase = import.meta.env.VITE_API_URL || '/api';
const BASE_URL = rawBase.replace(/\/+$/, '');
const TOKEN_KEY = 'ror_token';

function buildUrl(path) {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode); the cookie still works.
  }
}

export function clearStoredToken() {
  setStoredToken(null);
}

export function hasSessionHint() {
  if (getStoredToken()) return true;
  try {
    return String(document.cookie || '')
      .split(';')
      .some((part) => part.trim().startsWith('ror_session='));
  } catch {
    return false;
  }
}

async function request(method, path, { body, signal, headers } = {}) {
  const requestHeaders = new Headers(headers || {});
  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json');
  }

  const hasBody = body !== undefined && body !== null;
  if (hasBody && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const token = getStoredToken();
  if (token && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      credentials: 'include',
      headers: requestHeaders,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (cause) {
    if (cause && cause.name === 'AbortError') {
      throw cause;
    }
    const error = new Error(
      'Could not reach the server. Check your connection and try again.'
    );
    error.status = 0;
    error.cause = cause;
    throw error;
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const payload = data && typeof data === 'object' ? data : null;
    const apiError = payload && typeof payload.error === 'object' ? payload.error : null;
    const message =
      (apiError && apiError.message) ||
      (payload && typeof payload.message === 'string' && payload.message) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`;

    const error = new Error(message);
    error.status = response.status;
    error.details = (apiError && apiError.details) || (payload && payload.details) || undefined;
    error.code = (apiError && apiError.code) || (payload && payload.code) || undefined;
    error.payload = payload;
    throw error;
  }

  if (response.status === 204 || !text) {
    return null;
  }

  return data;
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
};

export const authApi = {
  register: ({ email, password, displayName }) =>
    api.post('/auth/register', { email, password, displayName }),
  verifyEmail: (token, options) =>
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`, options),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  login: ({ email, password }) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: (options) => api.get('/auth/me', options),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: ({ token, password }) =>
    api.post('/auth/reset-password', { token, password }),
};

export const officesApi = {
  list: (options) => api.get('/offices', options),
};

export const racesApi = {
  list: ({ year, state, signal } = {}) => {
    const params = new URLSearchParams();
    if (year !== undefined && year !== null) params.set('year', String(year));
    if (state) params.set('state', String(state));
    const query = params.toString();
    return api.get(`/races${query ? `?${query}` : ''}`, { signal });
  },
  get: (idOrSlug, options) =>
    api.get(`/races/${encodeURIComponent(idOrSlug)}`, options),
};

export const candidatesApi = {
  list: ({ office, search, limit, signal } = {}) => {
    const params = new URLSearchParams();
    if (office) params.set('office', office);
    if (search) params.set('search', search);
    if (limit !== undefined && limit !== null) params.set('limit', String(limit));
    const query = params.toString();
    return api.get(`/candidates${query ? `?${query}` : ''}`, { signal });
  },
  get: (id, options) => api.get(`/candidates/${encodeURIComponent(id)}`, options),
  votes: (id, options) =>
    api.get(`/candidates/${encodeURIComponent(id)}/votes`, options),
};

export const comparisonsApi = {
  create: ({ candidateAId, candidateBId, raceId }) => {
    const body = { candidateAId, candidateBId };
    if (raceId) body.raceId = raceId;
    return api.post('/comparisons', body);
  },
  list: ({ page = 1, limit = 10, signal } = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    return api.get(`/comparisons?${params.toString()}`, { signal });
  },
  get: (id, options) =>
    api.get(`/comparisons/${encodeURIComponent(id)}`, options),
};

export { BASE_URL };
