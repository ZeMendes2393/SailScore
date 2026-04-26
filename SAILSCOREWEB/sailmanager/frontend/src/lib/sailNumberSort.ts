/**
 * Extrai um valor numérico principal do número de vela para ordenação (ex.: "ITA 139" → 139).
 */
export function sailNumberNumericKey(sailNumber: string | null | undefined): number {
  if (sailNumber == null || sailNumber === '') return Number.POSITIVE_INFINITY;
  const m = String(sailNumber).match(/\d+/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

/** Barcos/frotas públicos ou listagens por fleet (sem fleet_id). */
export function compareBySailThenCountry<
  T extends { sail_number?: string | null; boat_country_code?: string | null },
>(a: T, b: T): number {
  const na = sailNumberNumericKey(a.sail_number);
  const nb = sailNumberNumericKey(b.sail_number);
  if (na !== nb) return na - nb;
  const ca = (a.boat_country_code ?? '').toUpperCase();
  const cb = (b.boat_country_code ?? '').toUpperCase();
  if (ca !== cb) return ca.localeCompare(cb);
  return String(a.sail_number ?? '').localeCompare(String(b.sail_number ?? ''));
}
