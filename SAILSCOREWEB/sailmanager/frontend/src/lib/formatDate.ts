/** Locale padrão do site (dia mês ano em inglês). */
export const DATE_LOCALE = 'en-GB';
const EN_MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const LONG_OPTS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

const SHORT_OPTS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

const DATE_TIME_OPTS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export function formatDateLong(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return `${d.getDate()} ${EN_MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString(DATE_LOCALE, SHORT_OPTS);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString(DATE_LOCALE, DATE_TIME_OPTS);
}

export function formatDateTimeInTimezone(
  value: string | Date | null | undefined,
  timezone?: string | null
): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  if (timezone) {
    try {
      return new Intl.DateTimeFormat(DATE_LOCALE, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
      }).format(d);
    } catch {
      /* fallback */
    }
  }
  return formatDateTime(d);
}

/** Intervalo de regata: "17 May 2026 – 19 May 2026" */
export function formatDateRange(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) {
      return `${start} – ${end}`;
    }
    if (s.getTime() === e.getTime()) return formatDateLong(s);
    return `${formatDateLong(s)} – ${formatDateLong(e)}`;
  } catch {
    return `${start} – ${end}`;
  }
}

/** YYYY-MM-DD → dia mês ano (en-GB) */
export function formatIsoDateOnly(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return '—';
  const t = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (!Number.isFinite(dt.getTime())) return '—';
    return formatDateLong(dt);
  }
  return formatDateLong(t);
}
