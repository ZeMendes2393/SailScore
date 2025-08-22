// src/lib/api.ts
// Utilitário simples para chamadas à API
export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';

export const jsonHeaders = (token?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

// Redireciona quando a sessão expira
function handleUnauthorized() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    // guarda a rota actual para voltar depois do login
    sessionStorage.setItem(
      'postLoginRedirect',
      window.location.pathname + window.location.search
    );
    // passa um motivo para o /login mostrar aviso
    window.location.href = '/login?reason=expired';
  }
}

// tenta obter o token do localStorage se não for passado
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
  // Atenção: endpoints 204 (sem conteúdo) irão falhar aqui.
  // Usa apiDelete() para DELETEs 204.
  return res.json() as Promise<T>;
}

// DELETE que lida com 204 No Content
export async function apiDelete(path: string, token?: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: jsonHeaders(resolveToken(token)),
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw new Error(await res.text());
  }
  // 204 -> sem body; não retornamos nada
}
