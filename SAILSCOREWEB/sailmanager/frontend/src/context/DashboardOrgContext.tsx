'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { appendDashboardOrgQuery, useDashboardOrgSlug } from '@/lib/dashboardOrgQuery';

export type DashboardOrgContextValue = {
  orgSlug: string | null;
  withOrg: (path: string) => string;
};

const DashboardOrgCtx = createContext<DashboardOrgContextValue | null>(null);

/** Um único `useDashboardOrgSlug` por árvore — resolve slug, sincroniza `?org=` na URL. */
export function DashboardOrgProvider({ children }: { children: ReactNode }) {
  const orgSlug = useDashboardOrgSlug();
  const value = useMemo<DashboardOrgContextValue>(
    () => ({
      orgSlug,
      withOrg: (path: string) => appendDashboardOrgQuery(path, orgSlug),
    }),
    [orgSlug]
  );
  return <DashboardOrgCtx.Provider value={value}>{children}</DashboardOrgCtx.Provider>;
}

export function useDashboardOrg(): DashboardOrgContextValue {
  const v = useContext(DashboardOrgCtx);
  if (!v) {
    throw new Error('useDashboardOrg must be used under /dashboard (DashboardOrgProvider)');
  }
  return v;
}

/** Componentes partilhados (ex. ProtestorCard): dentro do dashboard usa contexto; senão ignora org. */
export function useDashboardOrgOptional(): DashboardOrgContextValue | null {
  return useContext(DashboardOrgCtx);
}
