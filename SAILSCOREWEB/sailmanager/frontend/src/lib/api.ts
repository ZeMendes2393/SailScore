// src/lib/api.ts

export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

/** Normaliza "Authorization" para SEMPRE ficar "Bearer <token>" (sem duplicar) */
const normalizeBearer = (raw?: string): string | undefined => {
  const t = (raw ?? "").trim();
  if (!t) return undefined;
  return `Bearer ${t.replace(/^Bearer\s+/i, "")}`;
};

/** Resolve token: usa o passado ou (no browser) o do localStorage */
function resolveToken(passed?: string) {
  if (passed) return passed;
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("token") || undefined;
}

/** Headers com auth (robustos ao prefixo) */
const authHeaders = (token?: string): HeadersInit => {
  const header = normalizeBearer(resolveToken(token));
  return header ? { Authorization: header } : {};
};

export const jsonHeaders = (token?: string): HeadersInit => ({
  "Content-Type": "application/json",
  ...authHeaders(token),
});

/** Fetch simples (quando não precisas de headers especiais) */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.detail || j?.message || JSON.stringify(j);
    } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

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
    headers: authHeaders(token),
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
    headers: jsonHeaders(token),
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

// Açúcar
export const apiPostJson = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "POST", body, token);
export const apiDelete = <T,>(path: string, token?: string) =>
  apiSend<T>(path, "DELETE", undefined, token);
export const apiPost = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "POST", body, token);
export const apiPatch = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "PATCH", body, token);
export const apiPut = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "PUT", body, token);

/** Login (forma-URL-encoded, devolve { access_token, token_type, role, ... }) */
export async function apiLogin(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  if (!res.ok) throw await parseError(res);
  const data = await res.json();
  // guarda para chamadas futuras do FE (opcional)
  if (typeof window !== "undefined" && data?.access_token) {
    localStorage.setItem("token", data.access_token);
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
  }
  return data;
}

/* ------------------------------------------------------------------ */
/*  (Podes mover estes tipos para /src/types/protest.ts se preferires) */
/* ------------------------------------------------------------------ */
export type ProtestType =
  | "protest"
  | "redress"
  | "reopen"
  | "support_person_report"
  | "misconduct_rss69";

export type ProtestStatus =
  | "submitted"
  | "under_review"
  | "scheduled"
  | "closed"
  | "invalid"
  | "withdrawn";

export interface ProtestPartySummary {
  sail_no?: string | null;
  boat_name?: string | null;
  class_name?: string | null;
  free_text?: string | null;
}

export interface ProtestInitiatorSummary {
  sail_no?: string | null;
  boat_name?: string | null;
  class_name?: string | null;
}

export interface ProtestListItem {
  id: number;
  short_code: string;
  type: ProtestType;
  status: ProtestStatus;
  race_date?: string | null;
  race_number?: string | null;
  group_name?: string | null;
  initiator: ProtestInitiatorSummary;
  respondents: ProtestPartySummary[];
  updated_at: string; // ISO
}

export interface ProtestsListResponse {
  items: ProtestListItem[];
  page_info: { has_more: boolean; next_cursor?: number | null };
}
