'use client';
import RequireAuth from '@/components/RequireAuth';

export default function Page() {
  return (
    <RequireAuth roles={['regatista','admin']}>
      <div className="p-6">
        <h1 className="text-xl font-semibold">[NOME DA FEATURE]</h1>
        <p className="text-gray-600 text-sm">Em breve…</p>
      </div>
    </RequireAuth>
  );
}
