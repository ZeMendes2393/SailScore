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
export const PRP_CODE_PREFIX = 'PRP';
export const PRP_TEMPLATE_CODE = '__PRP_TEMPLATE__';
/** Escolher categoria N+1 antes do código concreto */
export const AUTO_N1_DISCARDABLE_TEMPLATE = '__AUTO_N1_DISCARDABLE__';
export const AUTO_N1_NON_DISCARDABLE_TEMPLATE = '__AUTO_N1_NON_DISCARDABLE__';

export const isAutoN1DiscardableTemplate = (c: string | null | undefined) =>
  c === AUTO_N1_DISCARDABLE_TEMPLATE;
export const isAutoN1NonDiscardableTemplate = (c: string | null | undefined) =>
  c === AUTO_N1_NON_DISCARDABLE_TEMPLATE;
export const isAutoN1TemplatePending = (c: string | null | undefined) =>
  isAutoN1DiscardableTemplate(c) || isAutoN1NonDiscardableTemplate(c);

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

/** Penalização por % = PRP:nome. O código PRP sozinho é custom de pontos fixos. */
export const isPrpCode = (c: string | null | undefined) =>
  !!c && String(c).toUpperCase().startsWith(`${PRP_CODE_PREFIX}:`);

/** Custom inline (pontos por resultado, não auto/adjustable/PRP). */
export const isCustomPenaltyCode = (c: string | null | undefined): boolean => {
  const k = String(c || '')
    .trim()
    .toUpperCase();
  if (!k) return false;
  if (AUTO_N_PLUS_ONE.has(k)) return false;
  if ((ADJUSTABLE_CODES as readonly string[]).includes(k)) return false;
  if (isPrpCode(k)) return false;
  return true;
};

/** Código interno PRP:nome — o nome visível é só o que o admin escreve no campo Name. */
export const buildPrpCode = (name: string) => `${PRP_CODE_PREFIX}:${name.trim()}`;

/** Texto do campo Name (parte após PRP:). */
export const extractPrpName = (code: string | null | undefined): string => {
  if (!isPrpCode(code)) return '';
  const raw = String(code ?? '').trim();
  const idx = raw.indexOf(':');
  if (idx < 0) return '';
  return raw.slice(idx + 1).trim();
};

export function formatPrpCodeLabel(code: string | null | undefined): string {
  return extractPrpName(code);
}

/** Badge/grelha: apenas o nome + pontos (ex. Late start 19.8). */
export function formatPrpCodeWithValue(
  code: string | null | undefined,
  points: number | string | null | undefined
): string {
  const name = extractPrpName(code);
  const ptsStr = Number.isFinite(Number(points)) ? String(points) : '';
  if (!name) return ptsStr || '';
  return ptsStr ? `${name} ${ptsStr}` : name;
}

export function prpCodeTooltip(code: string | null | undefined): string | undefined {
  const name = extractPrpName(code);
  if (!name) return 'Percentage penalty';
  return `Percentage penalty: ${name}`;
}

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
