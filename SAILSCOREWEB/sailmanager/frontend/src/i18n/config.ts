/** Supported UI locales (Portugal Portuguese, not Brazilian). */
export const SUPPORTED_LOCALES = ['en-GB', 'pt-PT'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en-GB';

/** Persisted when the visitor explicitly chooses a language. */
export const LOCALE_COOKIE = 'sailscore_locale';

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export const LOCALE_SHORT_LABELS: Record<AppLocale, string> = {
  'en-GB': 'EN',
  'pt-PT': 'PT',
};
