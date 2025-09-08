// src/lib/api.ts

export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

/** Fetch simples (quando não precisas de headers especiais) */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).detail; } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Headers com auth */
const authHeaders = (token?: string): HeadersInit =>
  token ? { Authorization: `Bearer ${token}` } : {};

export const jsonHeaders = (token?: string): HeadersInit => ({
  "Content-Type": "application/json",
  ...authHeaders(token),
});

function handleUnauthorized() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    const after = window.location.pathname + window.location.search;
    sessionStorage.setItem("postLoginRedirect", after);
    const isAdminArea = window.location.pathname.startsWith("/admin");
    window.location.href = isAdminArea
      ? "/admin/login?reason=expired"
      : "/login?reason=expired";
  }
}

function resolveToken(passed?: string) {
  if (passed) return passed;
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("token") || undefined;
}

async function parseError(res: Response): Promise<Error> {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await res.json();
      if (Array.isArray(j?.detail)) {
        const msg = j.detail
          .map((d: any) => d?.msg || d?.detail || JSON.stringify(d))
          .join("; ");
        return new Error(msg);
      }
      const msg = j?.detail || j?.message || JSON.stringify(j);
      return new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
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
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw await parseError(res);
  }
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  token?: string
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: jsonHeaders(resolveToken(token)),
    body: method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as unknown as T;

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// Açucar
export const apiPostJson = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "POST", body, token);
export const apiDelete =  <T,>(path: string, token?: string) =>
  apiSend<T>(path, "DELETE", undefined, token);
export const apiPost =    <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "POST", body, token);
export const apiPatch =   <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "PATCH", body, token);
export const apiPut =     <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "PUT", body, token);
