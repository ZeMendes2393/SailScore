import type { Entry } from '../../types';

export const AUTO_N_PLUS_ONE_DISCARDABLE = [
  'DNC',
  'DNF',
  'DNS',
  'OCS',
  'UFD',
  'BFD',
  'DSQ',
  'RET',
  'NSC',
] as const;

export const AUTO_N_PLUS_ONE_NON_DISCARDABLE = ['DNE', 'DGM'] as const;

export const AUTO_N_PLUS_ONE = new Set<string>([
  ...AUTO_N_PLUS_ONE_DISCARDABLE,
  ...AUTO_N_PLUS_ONE_NON_DISCARDABLE,
]);

export const ADJUSTABLE_CODES = ['RDG', 'SCP', 'ZPF', 'DPI'] as const;

export const START_DAY = 0;

export type OrcRatingMode = 'low' | 'medium' | 'high';

/** Rating efetivo na grelha de handicap (alinhado ao Time Scoring): ANC → entry.rating; ORC → orc_low/medium/high. */
export function getEffectiveHandicapRating(
  entry: Entry | undefined,
  method: string,
  orcMode: OrcRatingMode
): number | null {
  const m = (method || 'manual').toLowerCase();
  if (!entry) return null;
  if (m === 'anc') {
    const r = entry.rating;
    return typeof r === 'number' && !Number.isNaN(r) ? r : null;
  }
  if (m === 'orc') {
    const val = orcMode === 'low' ? entry.orc_low : orcMode === 'high' ? entry.orc_high : entry.orc_medium;
    return typeof val === 'number' && !Number.isNaN(val) ? val : null;
  }
  return null;
}

export const isAdjustable = (c: string | null | undefined) =>
  !!c && (ADJUSTABLE_CODES as readonly string[]).includes(c);

export const isAutoNPlusOne = (c: string | null | undefined) =>
  !!c && AUTO_N_PLUS_ONE.has(String(c).toUpperCase());

export function parseTimeToSeconds(s?: string | null): number | null {
  if (!s || typeof s !== 'string') return null;
  const parts = s.trim().split(':');
  if (parts.length !== 3) return null;
  const [hStr, mStr, sStr] = parts;
  const h = Number(hStr);
  const m = Number(mStr);
  const sec = Number(sStr);
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(sec)) return null;
  if (m < 0 || m >= 60 || sec < 0 || sec >= 60) return null;
  return h * 3600 + m * 60 + sec;
}

export function formatDelta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`;
}

export function timeStringToSeconds(str: string): number {
  const parts = (str || '')
    .trim()
    .split(':')
    .map((p) => parseInt(p, 10) || 0);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  return Math.min(86399, Math.max(0, h * 3600 + m * 60 + s));
}

export function secondsToTime(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds)) % 86400;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`;
}

export function computeFinishFromStartAndElapsed(
  startDay: number,
  startTimeSec: number,
  elapsedSec: number
): { finishDay: number; finishTime: string } {
  const safeElapsed = Math.max(0, Math.round(elapsedSec));
  const finishTimeSec = (startTimeSec + (safeElapsed % 86400)) % 86400;
  const baseDiff =
    finishTimeSec >= startTimeSec
      ? finishTimeSec - startTimeSec
      : finishTimeSec + 86400 - startTimeSec;
  const extraDaysSec = Math.max(0, safeElapsed - baseDiff);
  const finishDay = startDay + Math.floor(extraDaysSec / 86400);
  return { finishDay, finishTime: secondsToTime(finishTimeSec) };
}

export function formatElapsed(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}`;
}

export function parseElapsedToSeconds(str: string): number {
  const parts = (str || '')
    .trim()
    .split(':')
    .map((p) => parseInt(p, 10) || 0);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  return Math.max(0, h * 3600 + m * 60 + s);
}

export function computeElapsedFromStartAndFinish(
  startDay: number,
  startTimeSec: number,
  finishDay: number,
  finishTimeSec: number
): string {
  const safeDaysAfter = Math.max(0, finishDay - startDay);
  const baseDiff =
    finishTimeSec >= startTimeSec
      ? finishTimeSec - startTimeSec
      : finishTimeSec + 86400 - startTimeSec;
  const elapsedSec = baseDiff + safeDaysAfter * 86400;
  return formatElapsed(elapsedSec);
}

export function ancCorrectedFromElapsed(elapsedStr: string, rating: number): string {
  const sec = parseElapsedToSeconds(elapsedStr);
  return formatElapsed(Math.round(rating * sec));
}
