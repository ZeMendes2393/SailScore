import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_ORG = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG?.trim() || '';

/** Envia o pathname e ?org= ao layout para decidir qual design carregar (evita flash do site default). */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/$/, '') || '/';
  let orgFromQs = request.nextUrl.searchParams.get('org')?.trim() || '';

  if (pathname === '/calendar' && !orgFromQs && DEFAULT_ORG) {
    const url = request.nextUrl.clone();
    url.searchParams.set('org', DEFAULT_ORG);
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  if (orgFromQs) {
    requestHeaders.set('x-org-slug', orgFromQs);
  }
  /** Dashboard com ?regattaId= — o layout resolve organization_slug via API (mesmo padrão que /regattas/:id). */
  if (pathname.startsWith('/dashboard')) {
    const rid = request.nextUrl.searchParams.get('regattaId')?.trim() || '';
    if (/^\d+$/.test(rid)) {
      requestHeaders.set('x-dashboard-regatta-id', rid);
    }
  }
  /** Login sailor: ?regattaId= — SSR do layout obtém branding da org (como /regattas/:id). */
  if (pathname === '/login' || pathname.startsWith('/login')) {
    const loginRid = request.nextUrl.searchParams.get('regattaId')?.trim() || '';
    if (/^\d+$/.test(loginRid)) {
      requestHeaders.set('x-login-regatta-id', loginRid);
    }
  }
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
