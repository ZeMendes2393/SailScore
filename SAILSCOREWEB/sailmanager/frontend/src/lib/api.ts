import { buildSessionExpiredLoginUrl } from '@/lib/sessionExpiryLogin';

/** Base URL fixa (env/build); prefere `getApiBaseUrl()` no browser em dev. */
export const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'
).replace(/\/$/, '');

/**
 * Resolve a URL da API em tempo de execução.
 * Em dev: se não houver env e a página estiver em localhost ou 127.0.0.1,
 * usa o mesmo hostname que o browser — evita misturar localhost com 127.0.0.1
 * (pedidos falham ou o Chrome mostra erro tipo CORS quando não há resposta HTTP).
 */
export function getApiBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    // Mesmo host que a página, API na porta 8000 — funciona em localhost e em IP da LAN.
    // Em produção com API noutro domínio, define NEXT_PUBLIC_API_URL.
    if (hostname && hostname !== '0.0.0.0') {
      return `${protocol}//${hostname}:8000`;
    }
  }
  return BASE_URL;
}

const buildUrl = (path: string) =>
  `${getApiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;

type HeadersDict = Record<string, string>;

/**
 * Token usado nos pedidos à API.
 * Preferir sessionStorage — é onde o AuthContext grava após login;
 * localStorage pode ter um JWT antigo/expirado de sessões anteriores e causava 401 em loop.
 */
const getStoredToken = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (
    sessionStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    undefined
  );
};

// ---- helpers expiração JWT ----
function decodeJwtPayload(token: string) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}
export function isTokenExpired(token: string): boolean {
  const p = decodeJwtPayload(token);
  if (!p?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= p.exp;
}

function isExpired(token: string) {
  return isTokenExpired(token);
}

export const setStoredToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  if (!token) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    return;
  }
  localStorage.setItem('access_token', token);
  localStorage.setItem('token', token);
};

export const clearStoredAuth = () => {
  setStoredToken(null);
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  }
};

const authHeader = (token?: string): HeadersDict => {
  const raw = (token ?? getStoredToken()) || '';
  const bare = raw.trim().replace(/^bearer\s+/i, '');
  if (!bare || isExpired(bare)) return {}; // ❗ não envia Authorization se não houver/expirado
  return { Authorization: `Bearer ${bare}` };
};

const jsonHeaders = (token?: string): HeadersDict => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...authHeader(token),
});

// ------------- 401 handling (sem loops) -------------
let handling401 = false;

function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  if (handling401) return;
  handling401 = true;

  const path = window.location.pathname;
  let roleHint: string | null = null;
  try {
    const rawUser = sessionStorage.getItem('user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as { role?: string };
      roleHint = parsed?.role || null;
    }
  } catch {
    roleHint = null;
  }
  const expiredLoginUrl = buildSessionExpiredLoginUrl(roleHint);
  // páginas públicas (não redirecionar)
  const isPublicPage =
    /^\/regattas\/\d+\/?/i.test(path) &&
    (path.includes('notice') || path.includes('public'));

  clearStoredAuth();
  localStorage.removeItem('user');

  if (isPublicPage) {
    handling401 = false;
    return;
  }

  // dashboard/admin: redireciona uma única vez (preserva ?org= / última org admin)
  const after = path + window.location.search;
  sessionStorage.setItem('postLoginRedirect', after);

  window.location.replace(expiredLoginUrl);
}

async function parseError(res: Response): Promise<Error> {
  const ct = res.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const j = await res.json();
      if (Array.isArray(j?.detail)) {
        const msg = j.detail
          .map((d: any) => d?.msg || d?.detail || JSON.stringify(d))
          .join('; ');
        const err = new Error(msg);
        (err as any).status = res.status;
        return err;
      }
      const msg = j?.detail || j?.message || JSON.stringify(j);
      const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
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
    // ❗não re-tentar aqui; só sinaliza e deixa o chamador decidir
    handleUnauthorized();
    const e: any = new Error('Unauthorized');
    e.status = 401;
    throw e;
  }
  const err = await parseError(res);
  throw err;
}

// ---------------- Fetch helpers ----------------
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(buildUrl(path), init);
  await ensureOk(res);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return undefined as unknown as T;
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeader(token) },
    cache: 'no-store',
  });
  await ensureOk(res);
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
  token?: string
): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method,
    headers: method === 'DELETE' ? { ...authHeader(token) } : jsonHeaders(token),
    body: method === 'DELETE' ? undefined : JSON.stringify(body ?? {}),
  });
  await ensureOk(res);
  if (res.status === 204) return undefined as unknown as T;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json')
    ? ((await res.json()) as T)
    : (undefined as unknown as T);
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  token?: string
): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: { ...authHeader(token) }, // não definir Content-Type manualmente
    body: formData,
  });
  await ensureOk(res);
  return (await res.json()) as T;
}

// Açúcar
export const apiPost = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, 'POST', body, token);
export const apiPatch = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, 'PATCH', body, token);
export const apiPut = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, 'PUT', body, token);
export const apiDelete = <T,>(path: string, token?: string) =>
  apiSend<T>(path, 'DELETE', undefined, token);

// -------- Auth helpers --------
export const apiPostJson = <T,>(path: string, body: unknown, token?: string) =>
  apiSend<T>(path, 'POST', body, token);

export async function apiLoginJson(args: {
  email: string;
  password: string;
  regatta_id?: number;
}) {
  const res = await fetch(buildUrl('/auth/login'), {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(args),
  });
  await ensureOk(res);
  const data = await res.json();
  if (data?.access_token) setStoredToken(data.access_token);
  return data;
}

export async function apiLoginForm(username: string, password: string) {
  const res = await fetch(buildUrl('/auth/login-form'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });
  await ensureOk(res);
  const data = await res.json();
  if (data?.access_token) setStoredToken(data.access_token);
  return data;
}

export const apiMe = () => apiGet('/auth/me');

export async function apiSwitchRegatta(regattaId: number) {
  const res = await fetch(buildUrl(`/auth/switch-regatta?regatta_id=${regattaId}`), {
    method: 'POST',
    headers: authHeader(),
  });
  await ensureOk(res);
  const data = await res.json();
  if (data?.access_token) setStoredToken(data.access_token);
  return data;
}

// ---- Tipos que já tinhas (sem alterações de lógica) ----
// (mantive todos os teus tipos/exportações aqui…)
export type ProtestType =
  | 'protest'
  | 'redress'
  | 'reopen'
  | 'support_person_report'
  | 'misconduct_rss69';

export type ProtestStatus =
  | 'submitted'
  | 'under_review'
  | 'scheduled'
  | 'closed'
  | 'invalid'
  | 'withdrawn';

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
  /** Org admin protest filed without an entry */
  party_text?: string | null;
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

export type ScoringStatus =
  | 'submitted'
  | 'under_review'
  | 'answered'
  | 'closed'
  | 'invalid';

export interface ScoringCreate {
  initiator_entry_id: number;
  race_id?: number | null;
  race_number?: string | null;
  class_name?: string | null;
  sail_number?: string | null;
  requested_change?: string | null;
  requested_score?: number | null;
  boat_ahead?: string | null;
  boat_behind?: string | null;
}

export interface ScoringRead extends ScoringCreate {
  id: number;
  regatta_id: number;
  boat_country_code?: string | null;
  status: ScoringStatus;
  admin_note?: string | null;
  decision_pdf_path?: string | null;
  created_at: string;
  updated_at: string;
  response?: string | null; // 👈 NOVO
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

export async function apiListQuestions(
  regattaId: number,
  params?: Record<string, string | number | boolean | undefined>
) {
  const s = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) s.set(k, String(v));
  });
  return apiGet(
    `/regattas/${regattaId}/questions${s.toString() ? `?${s.toString()}` : ''}`
  );
}

export async function apiCreateQuestion(
  regattaId: number,
  data: {
    class_name: string;
    sail_number: string;
    sailor_name: string;
    subject: string;
    body: string;
    visibility?: 'public' | 'private';
  }
) {
  return apiPost(`/regattas/${regattaId}/questions`, data);
}

export async function apiUpdateQuestion(
  regattaId: number,
  id: number,
  data: Partial<{
    subject: string;
    body: string;
    visibility: 'public' | 'private';
    status: 'open' | 'answered' | 'closed';
    answer_text: string | null;
  }>
) {
  return apiPatch(`/regattas/${regattaId}/questions/${id}`, data);
}

/** Pedido de demo na landing (público, sem token). */
export type DemoRequestPayload = {
  full_name: string;
  email: string;
  club_name: string;
  phone?: string;
  message?: string;
  /** Honeypot anti-bot: deve ficar vazio. */
  company?: string;
};

export async function submitDemoRequest(
  body: DemoRequestPayload
): Promise<{ ok: boolean; emailed: boolean; id?: number }> {
  return apiPost('/marketing/demo-request', body);
}

export type MarketingDemoRequestRow = {
  id: number;
  created_at: string;
  full_name: string;
  email: string;
  club_name: string;
  phone?: string | null;
  message?: string | null;
  notification_email_sent: boolean;
};

export async function apiListMarketingDemoRequests(
  token: string,
  params?: { limit?: number; offset?: number }
): Promise<MarketingDemoRequestRow[]> {
  const s = new URLSearchParams();
  if (params?.limit != null) s.set('limit', String(params.limit));
  if (params?.offset != null) s.set('offset', String(params.offset));
  const q = s.toString();
  return apiGet<MarketingDemoRequestRow[]>(
    `/marketing/demo-requests${q ? `?${q}` : ''}`,
    token
  );
}
