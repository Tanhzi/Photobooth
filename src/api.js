const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function getAuthHeaders() {
  const auth = localStorage.getItem('auth');
  let token = null;
  if (auth) {
    try {
      token = JSON.parse(auth).token;
    } catch { /* bo qua */ }
  }
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiRequest(endpoint, options = {}) {
  const { method = 'GET', body, headers: extraHeaders = {}, ...rest } = options;
  const isFormData = body instanceof FormData;
  const headers = { ...extraHeaders };
  if (!isFormData) {
    Object.assign(headers, getAuthHeaders());
  } else {
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  // Cookie httpOnly (JWT) — backend set cookie, FE gửi kèm mọi request
  const config = { method, headers, credentials: 'include', ...rest };
  if (body) {
    config.body = typeof body === 'string' || isFormData ? body : JSON.stringify(body);
  }
  let response = await fetch(`${BASE_URL}${endpoint}`, config);
  if (response.status === 401 && !options._retried) {
    // Token hết hạn → thử gia hạn (cookie sliding refresh) rồi gọi lại 1 lần
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await fetch(`${BASE_URL}${endpoint}`, config);
    }
    if (response.status === 401) {
      localStorage.removeItem('auth');
      window.location.href = '/';
      throw new Error('Token expired');
    }
  }
  return response;
}

// POST /api/refresh — backend gia hạn cookie JWT (còn hạn hoặc trong grace 7 ngày)
async function tryRefreshToken() {
  try {
    const res = await fetch(`${BASE_URL}/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

function getAuthToken() {
  const auth = localStorage.getItem('auth');
  if (!auth) return null;
  try { return JSON.parse(auth).token; } catch { return null; }
}

export function getAuth() {
  const auth = localStorage.getItem('auth');
  if (!auth) return null;
  try { return JSON.parse(auth); } catch { return null; }
}

// ============================
// Client-side in-memory cache
// ============================
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000

class CachedResponse {
  constructor(data, status = 200) {
    this.ok = status >= 200 && status < 300
    this.status = status
    this.statusText = 'OK'
    this._data = data
  }
  async json() { return this._data }
  async text() { return JSON.stringify(this._data) }
  clone() { return new CachedResponse(this._data, this.status) }
  get headers() { return new Headers({ 'Content-Type': 'application/json', 'X-Cache': 'HIT' }) }
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key, data, ttl = CACHE_TTL) {
  cache.set(key, { data, timestamp: Date.now(), ttl })
}

export function invalidateCache(pattern) {
  if (!pattern) { cache.clear(); return }
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) cache.delete(key)
  }
}

export async function apiGet(endpoint, options = {}) {
  const { skipCache = false, ttl = CACHE_TTL, ...rest } = options

  if (!skipCache) {
    const cached = getCached(endpoint)
    if (cached) return new CachedResponse(cached)
  }

  const response = await apiRequest(endpoint, { ...rest, method: 'GET' })

  if (response.ok && !skipCache) {
    try {
      const cloned = response.clone()
      const data = await cloned.json()
      setCache(endpoint, data, ttl)
    } catch { /* bo qua */ }
  }

  return response
}

export async function apiPost(endpoint, body, options = {}) {
  return apiRequest(endpoint, { ...options, method: 'POST', body })
}

export async function apiPut(endpoint, body, options = {}) {
  return apiRequest(endpoint, { ...options, method: 'PUT', body })
}

export async function apiDelete(endpoint, options = {}) {
  return apiRequest(endpoint, { ...options, method: 'DELETE' })
}
