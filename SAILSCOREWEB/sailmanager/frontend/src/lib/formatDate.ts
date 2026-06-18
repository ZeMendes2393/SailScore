/** Locale padrão do site. */
export const DATE_LOCALE = 'en-GB';

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

export function formatDateLong(
  value: string | Date | null | undefined,
  locale: string = DATE_LOCALE
): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, LONG_OPTS).format(d);
}

export function formatDateShort(
  value: string | Date | null | undefined,
  locale: string = DATE_LOCALE
): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString(locale, SHORT_OPTS);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: string = DATE_LOCALE
): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString(locale, DATE_TIME_OPTS);
}

/** Data e hora para badges de publicação (ex.: "11 Mar 2026, 02:17"). */
export function formatPublishedAt(
  value: string | Date | null | undefined,
  locale: string = DATE_LOCALE
): string | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDateTimeInTimezone(
  value: string | Date | null | undefined,
  timezone?: string | null,
  locale: string = DATE_LOCALE
): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  if (timezone) {
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
      }).format(d);
    } catch {
      /* fallback */
    }
  }
  return formatDateTime(d, locale);
}

/** Intervalo de regata: "17 May 2026 – 19 May 2026" */
export function formatDateRange(
  start: string,
  end: string,
  locale: string = DATE_LOCALE
): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) {
      return `${start} – ${end}`;
    }
    if (s.getTime() === e.getTime()) return formatDateLong(s, locale);
    return `${formatDateLong(s, locale)} – ${formatDateLong(e, locale)}`;
  } catch {
    return `${start} – ${end}`;
  }
}

/** YYYY-MM-DD → dia mês ano */
export function formatIsoDateOnly(
  iso: string | null | undefined,
  locale: string = DATE_LOCALE
): string {
  if (!iso || typeof iso !== 'string') return '—';
  const t = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (!Number.isFinite(dt.getTime())) return '—';
    return formatDateLong(dt, locale);
  }
  return formatDateLong(t, locale);
}
