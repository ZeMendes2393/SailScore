// utils/parseRegattaId.ts
export function parseRegattaId(qs: URLSearchParams): number | null {
  const raw = qs.get('regattaId');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
