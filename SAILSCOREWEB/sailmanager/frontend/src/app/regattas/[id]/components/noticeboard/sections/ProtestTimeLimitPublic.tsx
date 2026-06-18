'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api';

type Row = {
  id: number;
  regatta_id: number;
  class_name: string;
  fleet: string | null;
  date: string;
  time_limit_hm: string;
};

function formatDateDMY(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso?.trim() || '');
  if (!m) return iso;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(dt.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dt);
}

export default function ProtestTimeLimitPublic({ regattaId }: { regattaId: number }) {
  const t = useTranslations('noticeSections.ptl');
  const tCommon = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('ALL');

  const dateOptions = useMemo(() => {
    const uniq = Array.from(new Set(rows.map((r) => r.date).filter(Boolean)));
    return uniq.sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (selectedDate === 'ALL') return rows;
    return rows.filter((r) => r.date === selectedDate);
  }, [rows, selectedDate]);

  async function fetchRows() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Row[]>(`/ptl/${regattaId}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || t('loadFailed'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regattaId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <select
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          title={t('filterByDate')}
        >
          <option value="ALL">{t('filterAll')}</option>
          {dateOptions.map((d) => (
            <option key={d} value={d}>
              {formatDateDMY(d)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[18%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
          </colgroup>

          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">{t('class')}</th>
              <th className="px-3 py-2 text-left">{t('fleet')}</th>
              <th className="px-3 py-2 text-left">{t('timeLimit')}</th>
              <th className="px-3 py-2 text-left">{t('date')}</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td className="px-3 py-2" colSpan={4}>
                  {tCommon('loading')}
                </td>
              </tr>
            )}

            {!loading && visibleRows.length === 0 && (
              <tr>
                <td className="px-3 py-2 text-center text-gray-500" colSpan={4}>
                  {t('noRecords')}
                </td>
              </tr>
            )}

            {visibleRows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.class_name}</td>
                <td className="px-3 py-2">{r.fleet || tCommon('dash')}</td>
                <td className="px-3 py-2 font-mono">{r.time_limit_hm}</td>
                <td className="px-3 py-2">{formatDateDMY(r.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}
