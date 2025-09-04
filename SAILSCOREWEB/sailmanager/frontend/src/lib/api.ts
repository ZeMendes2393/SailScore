// src/lib/api.ts
export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';

const authHeaders = (token?: string): HeadersInit =>
  token ? { Authorization: `Bearer ${token}` } : {};

export const jsonHeaders = (token?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  ...authHeaders(token),
});

function handleUnauthorized() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    sessionStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
    window.location.href = '/login?reason=expired';
  }
}

function resolveToken(passed?: string) {
  if (passed) return passed;
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem('token') || undefined;
}

async function parseError(res: Response): Promise<Error> {
  const ct = res.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const j = await res.json();
      // FastAPI validation: detail é array -> junta msgs
      if (Array.isArray(j?.detail)) {
        const msg = j.detail.map((d: any) => d?.msg || d?.detail || JSON.stringify(d)).join('; ');
        return new Error(msg);
      }
      const msg = j?.detail || j?.message || JSON.stringify(j);
      return new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    const t = await res.text();
    return new Error(t || `HTTP ${res.status}`);
  } catch {
    return new Error(`HTTP ${res.status}`);
  }
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: authHeaders(resolveToken(token)),
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw await parseError(res);
  }
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body: unknown,
  token?: string
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: jsonHeaders(resolveToken(token)),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw await parseError(res);
  }
  return res.json() as Promise<T>;
}

// NOVO: POST form-url-encoded (para /auth/login com OAuth2PasswordRequestForm)


// src/lib/api.ts
export async function apiPostJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: jsonHeaders(resolveToken(token)),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw new Error(await res.text());
  }
  return res.json() as Promise<T>;
}

