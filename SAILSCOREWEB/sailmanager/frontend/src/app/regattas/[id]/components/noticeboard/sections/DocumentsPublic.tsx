'use client';

import { useNotices } from '@/lib/hooks/useNotices';
import NoticeTable from '../components/NoticeTable';

export default function Documents({ regattaId }: { regattaId: number }) {
  const { data, loading, error } = useNotices(regattaId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Documents</h3>
      </div>

      {loading && <div className="text-gray-500">Loading…</div>}
      {error && <div className="text-red-600">{String(error)}</div>}

      <NoticeTable items={data} />
    </div>
  );
}
