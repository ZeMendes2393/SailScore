'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

type RequestRead = {
  id: number;
  request_no: number;
  class_name?: string | null;
  sail_number?: string | null;
  request_text: string;
  admin_response?: string | null;
  status: 'submitted' | 'under_review' | 'closed';
  created_at: string;
};

export default function RequestsPublic({ regattaId }: { regattaId: number }) {
  const t = useTranslations('noticeSections.requests');
  const tCommon = useTranslations('common');
  const [rows, setRows] = useState<RequestRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    p.set('status_q', 'all');
    return `/regattas/${regattaId}/requests?${p.toString()}`;
  }, [regattaId]);

  const statusLabel = (status: RequestRead['status']) => {
    if (status === 'submitted') return t('statusSubmitted');
    if (status === 'under_review') return t('statusUnderReview');
    return t('statusClosed');
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await apiGet<RequestRead[]>(listPath);
        setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErr(e?.message || t('loadFailed'));
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [listPath, t]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
      </div>

      <div className="bg-white rounded border overflow-x-auto">
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 w-16">{t('number')}</th>
              <th className="p-2 w-32">{t('sailNo')}</th>
              <th className="p-2 w-40">{t('class')}</th>
              <th className="p-2">{t('request')}</th>
              <th className="p-2 w-28">{t('status')}</th>
              <th className="p-2 w-[28rem]">{t('response')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={6}>
                  {tCommon('loading')}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={6}>
                  {t('noRequests')}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2">{r.request_no}</td>
                <td className="p-2">
                  <SailNumberDisplay
                    countryCode={(r as any).boat_country_code}
                    sailNumber={r.sail_number}
                  />
                </td>
                <td className="p-2">{r.class_name || tCommon('dash')}</td>
                <td className="p-2 max-w-[28rem]">
                  <div className="whitespace-pre-wrap break-words">{r.request_text}</div>
                </td>
                <td className="p-2">{statusLabel(r.status)}</td>
                <td className="p-2 max-w-[28rem]">
                  <div className="whitespace-pre-wrap break-words">
                    {r.admin_response?.trim() || tCommon('dash')}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && <div className="text-red-600">{err}</div>}
    </div>
  );
}
