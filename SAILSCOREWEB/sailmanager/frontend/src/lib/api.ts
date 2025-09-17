// src/lib/api.ts

// Base da API (sem trailing slash)
export const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

// ------------------------------
// Helpers de token / headers
// ------------------------------
type HeadersDict = Record<string, string>;

const normalizeBearer = (raw?: string): string | undefined => {
  const t = (raw ?? "").trim();
  if (!t) return undefined;
  return t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`;
};

// --- manter compatibilidade com código antigo ---
export const apiPostJson = <T,>(
  path: string,
  body: unknown,
  token?: string
) => apiSend<T>(path, "POST", body, token);

const getStoredToken = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  // aceita "access_token" (recomendado) ou "token" (legado)
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    undefined
  );
};

export const setStoredToken = (token: string | null) => {
  if (typeof window === "undefined") return;
  if (!token) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    return;
  }
  localStorage.setItem("access_token", token);
  // manter compatibilidade com código antigo
  localStorage.setItem("token", token);
};

export const clearStoredAuth = () => setStoredToken(null);

const authHeader = (token?: string): HeadersDict => {
  const clean = normalizeBearer(token ?? getStoredToken());
  return clean ? { Authorization: clean } : {};
};

const jsonHeaders = (token?: string): HeadersDict => ({
  "Content-Type": "application/json",
  ...authHeader(token),
});

// ------------------------------
// Tratamento de erros/401
// ------------------------------
function handleUnauthorized() {
  if (typeof window !== "undefined") {
    clearStoredAuth();
    localStorage.removeItem("user");
    const after = window.location.pathname + window.location.search;
    sessionStorage.setItem("postLoginRedirect", after);
    const isAdmin = window.location.pathname.startsWith("/admin");
    window.location.href = isAdmin
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

// GET simples sem headers especiais (útil para endpoints públicos)
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    throw await parseError(res);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    // algumas rotas podem devolver 204/empty
    return undefined as unknown as T;
  }
  return res.json() as Promise<T>;
}


async function ensureOk(res: Response) {
  if (res.ok) return;
  if (res.status === 401) handleUnauthorized();
  throw await parseError(res);
}

// ------------------------------
// Fetch helpers
// ------------------------------
export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: authHeader(token),
    cache: "no-store",
  });
  await ensureOk(res);
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
    headers: method === "DELETE" ? authHeader(token) : jsonHeaders(token),
    body: method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
  });
  await ensureOk(res);
  if (res.status === 204) return undefined as unknown as T;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json")
    ? ((await res.json()) as T)
    : (undefined as unknown as T);
}

// FormData (uploads)
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  token?: string
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: authHeader(token), // NÃO definir Content-Type aqui!
    body: formData,
  });
  await ensureOk(res);
  return (await res.json()) as T;
}

// Açúcar
export const apiPost = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "POST", body, token);
export const apiPatch = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "PATCH", body, token);
export const apiPut = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "PUT", body, token);
export const apiDelete = <T,>(path: string, token?: string) =>
  apiSend<T>(path, "DELETE", undefined, token);

// ------------------------------
// Auth endpoints p/ teu backend
// ------------------------------

// JSON login (recomendado): POST /auth/login
// body: { email, password, regatta_id? }
export async function apiLoginJson(args: {
  email: string;
  password: string;
  regatta_id?: number;
}) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(args),
  });
  await ensureOk(res);
  const data = await res.json();
  if (data?.access_token) setStoredToken(data.access_token);
  return data;
}

// Alternativa (se precisares): POST /auth/login-form
export async function apiLoginForm(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/login-form`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  await ensureOk(res);
  const data = await res.json();
  if (data?.access_token) setStoredToken(data.access_token);
  return data;
}

// /auth/me
export const apiMe = () => apiGet("/auth/me");

// /auth/switch-regatta → devolve novo token
export async function apiSwitchRegatta(regattaId: number) {
  const res = await fetch(`${BASE_URL}/auth/switch-regatta?regatta_id=${regattaId}`, {
    method: "POST",
    headers: authHeader(),
  });
  await ensureOk(res);
  const data = await res.json();
  if (data?.access_token) setStoredToken(data.access_token);
  return data;
}

// ------------------------------
// Tipos (mantive os teus)
// ------------------------------
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
