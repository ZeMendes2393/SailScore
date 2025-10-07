// src/lib/api.ts

// Base da API (sem trailing slash)
export const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

// --------- utils URL ---------
const buildUrl = (path: string) =>
  `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

// ------------------------------
// Helpers de token / headers
// ------------------------------
type HeadersDict = Record<string, string>;

const normalizeBearer = (raw?: string): string | undefined => {
  const t = (raw ?? "").trim();
  if (!t) return undefined;
  return t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`;
};

const getStoredToken = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
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
  localStorage.setItem("token", token); // compat legado
};

export const clearStoredAuth = () => setStoredToken(null);

const authHeader = (token?: string): HeadersDict => {
  const clean = normalizeBearer(token ?? getStoredToken());
  return clean ? { Authorization: clean } : {};
};

const jsonHeaders = (token?: string): HeadersDict => ({
  "Content-Type": "application/json",
  Accept: "application/json",
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

async function ensureOk(res: Response) {
  if (res.ok) return;
  if (res.status === 401) handleUnauthorized();
  throw await parseError(res);
}

// ------------------------------
// Fetch helpers
// ------------------------------
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(buildUrl(path), init);
  if (!res.ok) throw await parseError(res);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return undefined as unknown as T;
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "GET",
    headers: { Accept: "application/json", ...authHeader(token) },
    cache: "no-store",
    credentials: "include",
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
  const res = await fetch(buildUrl(path), {
    method,
    headers: method === "DELETE" ? { ...authHeader(token) } : jsonHeaders(token),
    body: method === "DELETE" ? undefined : JSON.stringify(body ?? {}),
    credentials: "include",
  });
  await ensureOk(res);
  if (res.status === 204) return undefined as unknown as T;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json")
    ? ((await res.json()) as T)
    : (undefined as unknown as T);
}

// Upload
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  token?: string
): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: { ...authHeader(token) }, // NÃO definir Content-Type manualmente
    body: formData,
    credentials: "include",
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

// -------- Auth helpers --------
export const apiPostJson = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, "POST", body, token);

export async function apiLoginJson(args: {
  email: string;
  password: string;
  regatta_id?: number;
}) {
  const res = await fetch(buildUrl("/auth/login"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(args),
  });
  await ensureOk(res);
  const data = await res.json();
  if (data?.access_token) setStoredToken(data.access_token);
  return data;
}

export async function apiLoginForm(username: string, password: string) {
  const res = await fetch(buildUrl("/auth/login-form"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }),
  });
  await ensureOk(res);
  const data = await res.json();
  if (data?.access_token) setStoredToken(data.access_token);
  return data;
}

export const apiMe = () => apiGet("/auth/me");

export async function apiSwitchRegatta(regattaId: number) {
  const res = await fetch(buildUrl(`/auth/switch-regatta?regatta_id=${regattaId}`), {
    method: "POST",
    headers: authHeader(),
  });
  await ensureOk(res);
  const data = await res.json();
  if (data?.access_token) setStoredToken(data.access_token);
  return data;
}

// -------- Tipos (iguais aos teus) --------
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
  updated_at: string;
}
export interface ProtestsListResponse {
  items: ProtestListItem[];
  page_info: { has_more: boolean; next_cursor?: number | null };
}

// em @/lib/api (onde tens os tipos)
export type Rule42EntrySummary = {
  entry_id?: number | null;
  sail_number?: string | null;
  boat_name?: string | null;
  skipper_name?: string | null;
  class_name?: string | null;
  user_id?: number | null;
  club?: string | null;
};

export type Rule42ListItem = {
  id: number;
  regatta_id: number;
  class_name: string;
  sail_num: string;
  race: string;
  penalty_number: string;
  group?: string | null;
  rule: string;
  comp_action?: string | null;
  date: string; // ISO
  entry?: Rule42EntrySummary | null;
};

export type Rule42ListResponse = {
  items: Rule42ListItem[];
  page_info: { has_more: boolean; next_cursor: number | null };
};
