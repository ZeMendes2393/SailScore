import { Suspense, type ReactNode } from 'react';
import { DashboardOrgProvider } from '@/context/DashboardOrgContext';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[min(100%,90rem)] px-4 py-8 text-sm text-gray-500">
          A carregar…
        </div>
      }
    >
      <DashboardOrgProvider>{children}</DashboardOrgProvider>
    </Suspense>
  );
}
