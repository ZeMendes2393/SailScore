'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDashboardRegattaId } from '@/lib/dashboardRegattaScope';

/**
 * Acrescenta `?org=` (ou funde no query string existente) para o cabeçalho/rodapé
 * do layout coincidirem com a organização (middleware → x-org-slug).
 */
export function appendDashboardOrgQuery(
  path: string,
  orgSlug: string | null | undefined
): string {
  const s = typeof orgSlug === 'string' ? orgSlug.trim() : '';
  if (!s) return path;
  const qIndex = path.indexOf('?');
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const existing = qIndex >= 0 ? path.slice(qIndex + 1) : '';
  const params = new URLSearchParams(existing);
  params.set('org', s);
  return `${pathname}?${params.toString()}`;
}

type RegattaOrg = { organization_slug?: string | null };

/**
 * Slug da organização para o sailor dashboard:
 * 1) `?org=` na URL
 * 2) senão, GET `/regattas/:id` com o regatta atual (current_regatta_id / ?regattaId=)
 *    e usa `organization_slug`.
 *
 * Se (2) preencher o slug e a URL ainda não tiver `org`, faz `replace` para o mesmo path
 * com `org` — assim o layout SSR e o middleware passam a ter contexto estável.
 */
export function useDashboardOrgSlug(): string | null {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { token } = useAuth();
  const regattaId = useDashboardRegattaId();

  const fromUrl = useMemo(
    () => searchParams.get('org')?.trim() || null,
    [searchParams]
  );

  const [fromRegatta, setFromRegatta] = useState<string | null>(null);

  useEffect(() => {
    if (fromUrl) {
      setFromRegatta(null);
      return;
    }
    if (!regattaId || !token) {
      setFromRegatta(null);
      return;
    }
    let cancelled = false;
    apiGet<RegattaOrg>(`/regattas/${regattaId}`, token)
      .then((data) => {
        if (cancelled) return;
        const slug = data?.organization_slug?.trim();
        setFromRegatta(slug || null);
      })
      .catch(() => {
        if (!cancelled) setFromRegatta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fromUrl, regattaId, token]);

  const resolved = fromUrl || fromRegatta;

  useEffect(() => {
    if (fromUrl || !fromRegatta || !pathname) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('org', fromRegatta);
    router.replace(`${pathname}?${params.toString()}`);
  }, [fromUrl, fromRegatta, pathname, router, searchParams]);

  return resolved;
}
