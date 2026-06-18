import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_COOKIE, type AppLocale } from './config';
import { resolveLocaleWithoutCookie } from './resolveLocale';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;

  let locale: AppLocale = DEFAULT_LOCALE;
  if (isSupportedLocale(fromCookie)) {
    locale = fromCookie;
  } else {
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') || '/';
    const orgSlugHint = headersList.get('x-org-slug')?.trim() || null;
    locale = await resolveLocaleWithoutCookie(pathname, orgSlugHint);
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
