import { ADJUSTABLE_CODES, AUTO_N_PLUS_ONE, PRP_CODE_PREFIX } from './shared';

export const CUSTOM_TEMPLATE_CODE = '__CUSTOM_CODE__';

export type ScoringCodeMapValue = number | { points: number; discardable?: boolean };

const RESERVED = new Set<string>([
  ...AUTO_N_PLUS_ONE,
  ...ADJUSTABLE_CODES,
  PRP_CODE_PREFIX,
]);

export function parseScoringCodesMap(raw: Record<string, unknown> | null | undefined): {
  points: Record<string, number>;
  discardable: Record<string, boolean>;
} {
  const points: Record<string, number> = {};
  const discardable: Record<string, boolean> = {};
  if (!raw || typeof raw !== 'object') return { points, discardable };

  for (const [k, v] of Object.entries(raw)) {
    const code = String(k).trim().toUpperCase();
    if (!code) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as { points?: unknown; value?: unknown; discardable?: unknown };
      const p = Number(obj.points ?? obj.value);
      if (!Number.isFinite(p)) continue;
      points[code] = p;
      discardable[code] = obj.discardable !== false;
      continue;
    }
    const p = Number(v);
    if (!Number.isFinite(p)) continue;
    points[code] = p;
    discardable[code] = true;
  }
  return { points, discardable };
}

export function buildScoringCodeMapEntry(points: number, discardable: boolean): ScoringCodeMapValue {
  if (discardable) return points;
  return { points, discardable: false };
}

export function normalizeCustomCodeName(name: string): string {
  const key = String(name || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (key.length < 2) throw new Error('Code name must be at least 2 characters.');
  if (key.length > 16) throw new Error('Code name must be at most 16 characters.');
  if (RESERVED.has(key)) throw new Error(`Code ${key} is reserved.`);
  if (key.startsWith(PRP_CODE_PREFIX)) throw new Error('Code cannot start with PRP.');
  return key;
}

export function isCustomMapCode(code: string | null | undefined): boolean {
  const c = String(code || '').trim().toUpperCase();
  if (!c || c.startsWith(PRP_CODE_PREFIX)) return false;
  if (AUTO_N_PLUS_ONE.has(c)) return false;
  if ((ADJUSTABLE_CODES as readonly string[]).includes(c)) return false;
  return true;
}
