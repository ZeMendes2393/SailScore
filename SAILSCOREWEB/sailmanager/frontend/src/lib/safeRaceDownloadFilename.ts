/**
 * Same rules as backend `_safe_race_export_filename` (results_race.py):
 * "{regatta} - {race name} - {class}" (class omitted if empty), then safe characters.
 */
export function safeRaceDownloadFilename(
  regattaName: string | null | undefined,
  raceName: string | null | undefined,
  raceId: number,
  ext: string,
  className?: string | null
): string {
  const e = ext.startsWith('.') ? ext.slice(1) : ext;
  const reg = (regattaName ?? '').trim() || 'Regatta';
  const rn = (raceName ?? '').trim();
  const raceLabel = rn || `Race ${raceId}`;
  const cn = (className ?? '').trim();
  const base = cn ? `${reg} - ${raceLabel} - ${cn}` : `${reg} - ${raceLabel}`;
  let safe = '';
  for (const ch of base) {
    const ok =
      /[\p{L}\p{N}]/u.test(ch) || ' -_.'.includes(ch);
    safe += ok ? ch : '_';
  }
  safe = safe.replace(/^[\s._]+|[\s._]+$/g, '');
  if (!safe) safe = `race_${raceId}_results`;
  return `${safe}.${e}`;
}
