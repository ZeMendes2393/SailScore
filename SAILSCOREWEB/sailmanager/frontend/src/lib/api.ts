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

// ---- helpers expiração JWT (curto-circuito do header) ----
function decodeJwtPayload(token: string) {
  try {
    const [, payload] = token.split(".");
    // atob exige base64 “url-safe” tratado
    return JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
  } catch {
    return null;
  }
}
function isExpired(token: string) {
  const p = decodeJwtPayload(token);
  if (!p?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= p.exp;
}

const authHeader = (token?: string): HeadersDict => {
  // aceita token explícito OU o que estiver no storage
  const raw = (token ?? getStoredToken()) || "";
  const bare = raw.trim().replace(/^bearer\s+/i, "");
  if (!bare || isExpired(bare)) return {}; // não enviar Authorization se expirado
  return { Authorization: `Bearer ${bare}` };
};

const jsonHeaders = (token?: string): HeadersDict => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  ...authHeader(token),
});

// ------------------------------
// Tratamento de erros/401
// ------------------------------

// 👇 evita múltiplos redirects em cascata
let handling401 = false;

function handleUnauthorized() {
  if (typeof window === "undefined") return;
  if (handling401) return;
  handling401 = true;

  // 👇 não redirecionar se estamos numa página pública
  const path = window.location.pathname;
  const isPublicPage =
    /^\/regattas\/\d+\/?/i.test(path) &&
    (path.includes("notice") || path.includes("public"));

  clearStoredAuth();
  localStorage.removeItem("user");

  if (isPublicPage) {
    handling401 = false; // desbloqueia para futuros 401
    return;              // não redireciona em páginas públicas
  }

  // redireciono só para páginas privadas (dashboard/admin)
  const after = path + window.location.search;
  sessionStorage.setItem("postLoginRedirect", after);

  const isAdmin = path.startsWith("/admin");
  const url = isAdmin ? "/admin/login?reason=expired" : "/login?reason=expired";
  window.location.replace(url);
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
        const err = new Error(msg);
        (err as any).status = res.status;
        return err;
      }
      const msg = j?.detail || j?.message || JSON.stringify(j);
      const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      (err as any).status = res.status;
      return err;
    }
    const t = await res.text();
    const err = new Error(t || `HTTP ${res.status}`);
    (err as any).status = res.status;
    return err;
  } catch {
    const err = new Error(`HTTP ${res.status}`);
    (err as any).status = res.status;
    return err;
  }
}

async function ensureOk(res: Response) {
  if (res.ok) return;
  if (res.status === 401) {
    handleUnauthorized();
    const e: any = new Error("Unauthorized");
    e.status = 401;
    throw e;
  }
  const err = await parseError(res);
  throw err;
}

// ------------------------------
// Fetch helpers
// ------------------------------
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(buildUrl(path), init);
  await ensureOk(res);
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
    // credentials: "include", // ❌ só usar se precisares MESMO de cookies de sessão
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
    // credentials: "include", // ❌ evita por defeito
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
    // credentials: "include", // ❌ só se for preciso cookies
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
  items: ProtestListItem[],
  page_info: { has_more: boolean; next_cursor?: number | null }
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

// ---------- Scoring Enquiries ----------
export type ScoringStatus =
  | "submitted"
  | "under_review"
  | "answered"
  | "closed"
  | "invalid";

export interface ScoringCreate {
  initiator_entry_id: number;
  race_id?: number | null;
  race_number?: string | null;
  class_name?: string | null;      // auto-filled, read-only in UI
  sail_number?: string | null;     // auto-filled, read-only in UI
  requested_change?: string | null;
  requested_score?: number | null;
  boat_ahead?: string | null;
  boat_behind?: string | null;
}

export interface ScoringRead extends ScoringCreate {
  id: number;
  regatta_id: number;
  status: ScoringStatus;
  admin_note?: string | null;
  decision_pdf_path?: string | null;
  created_at: string;
  updated_at: string;
  response?: string | null;   // 👈 NOVO
}

export type RequestRead = {
  id: number;
  regatta_id: number;
  request_no: number;
  initiator_entry_id: number | null;
  class_name?: string | null;
  sail_number?: string | null;
  sailor_name?: string | null;
  request_text: string;
  status: 'submitted' | 'under_review' | 'closed';
  admin_response?: string | null;
  created_at: string;
  updated_at: string;
};

// --------- Questions API ---------
export async function apiListQuestions(
  regattaId: number,
  params?: Record<string, string | number | boolean | undefined>
) {
  const s = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) s.set(k, String(v));
  });
  return apiGet(`/regattas/${regattaId}/questions${s.toString() ? `?${s.toString()}` : ""}`);
}

export async function apiCreateQuestion(
  regattaId: number,
  data: {
    class_name: string;
    sail_number: string;
    sailor_name: string;
    subject: string;
    body: string;
    visibility?: "public" | "private";
  }
) {
  // deixa passar visibility (o BE já força public por segurança)
  return apiPost(`/regattas/${regattaId}/questions`, data);
}

export async function apiUpdateQuestion(
  regattaId: number,
  id: number,
  data: Partial<{
    subject: string;
    body: string;
    visibility: "public" | "private";
    status: "open" | "answered" | "closed";
    answer_text: string | null;
  }>
) {
  return apiPatch(`/regattas/${regattaId}/questions/${id}`, data);
}
