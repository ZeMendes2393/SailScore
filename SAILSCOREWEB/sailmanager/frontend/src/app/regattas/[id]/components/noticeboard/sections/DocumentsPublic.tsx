'use client';

import { useState } from 'react';
import { useNotices } from '@/lib/hooks/useNotices';
import type { Notice } from '@/types/notice';
import NoticeTable from '../components/NoticeTable';
import PdfModal from '../components/PdfModal';

export default function Documents({ regattaId }: { regattaId: number }) {
  const { data, loading, error, refresh } = useNotices(regattaId);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Notice | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Documents</h3>
        <button
          onClick={refresh}
          className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
        >
          Atualizar
        </button>
      </div>

      {loading && <div className="text-gray-500">A carregar…</div>}
      {error && <div className="text-red-600">{String(error)}</div>}

      <NoticeTable
        items={data}
        onPreview={(n) => {
          setCurrent(n);
          setOpen(true);
        }}
      />

      <PdfModal open={open} notice={current} onClose={() => setOpen(false)} />
    </div>
  );
}
