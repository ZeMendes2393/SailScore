// src/lib/api.ts
export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';

export const jsonHeaders = (token?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: jsonHeaders(resolveToken(token)),
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw new Error(await res.text());
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
    throw new Error(await res.text());
  }
  return res.json() as Promise<T>;
}

// 🔹 NOVO: POST x-www-form-urlencoded
export async function apiPostForm<T>(
  path: string,
  form: Record<string, string>,
  token?: string
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(resolveToken(token) ? { Authorization: `Bearer ${resolveToken(token)!}` } : {}),
    },
    body: new URLSearchParams(form).toString(),
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw new Error(await res.text());
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string, token?: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: jsonHeaders(resolveToken(token)),
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw new Error(await res.text());
  }
}

// (o que já tinhas)
export async function fetchProtests(
  regattaId: number,
  params: { scope?: 'all' | 'made' | 'against'; search?: string; limit?: number; cursor?: number }
) {
  const qs = new URLSearchParams();
  if (params.scope) qs.set('scope', params.scope);
  if (params.search) qs.set('search', params.search);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.cursor) qs.set('cursor', String(params.cursor));
  return apiGet(`/regattas/${regattaId}/protests?${qs.toString()}`);
}
