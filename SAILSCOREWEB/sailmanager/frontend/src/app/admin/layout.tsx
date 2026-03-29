import { Suspense } from 'react';

/** useSearchParams nas páginas admin precisa de boundary Suspense (Next.js). */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen bg-gray-50" aria-hidden />}>{children}</Suspense>;
}
