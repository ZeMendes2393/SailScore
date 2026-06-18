'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_SHORT_LABELS,
  SUPPORTED_LOCALES,
  type AppLocale,
} from '@/i18n/config';

type LanguageSwitcherProps = {
  className?: string;
  variant?: 'compact' | 'inline';
  /** on-dark = blue headers; on-light = marketing landing */
  theme?: 'on-dark' | 'on-light';
};

export default function LanguageSwitcher({
  className = '',
  variant = 'compact',
  theme = 'on-dark',
}: LanguageSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const t = useTranslations('common');

  const setLocale = (next: AppLocale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${LOCALE_COOKIE_MAX_AGE};SameSite=Lax`;
    router.refresh();
  };

  const baseBtn =
    variant === 'compact'
      ? 'min-w-[2.25rem] px-2 py-1.5 text-sm font-bold rounded-lg transition'
      : 'px-2 py-1 text-sm font-semibold rounded-md transition';

  const shellClass =
    theme === 'on-light'
      ? 'bg-slate-100 border border-slate-200'
      : 'bg-black/10';

  const inactiveClass =
    theme === 'on-light'
      ? 'text-slate-600 hover:bg-white hover:text-slate-900'
      : 'text-white/90 hover:bg-white/15 hover:text-white';

  const activeClass =
    theme === 'on-light'
      ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
      : 'bg-white text-blue-800 shadow-sm';

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-xl p-0.5 ${shellClass} ${className}`}
      role="group"
      aria-label={t('language')}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={`${baseBtn} ${active ? activeClass : inactiveClass}`}
            aria-pressed={active}
            lang={code}
          >
            {LOCALE_SHORT_LABELS[code]}
          </button>
        );
      })}
    </div>
  );
}
