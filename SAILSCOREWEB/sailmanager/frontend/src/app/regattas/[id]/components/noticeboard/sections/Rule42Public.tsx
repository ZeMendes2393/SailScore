'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

type Row = {
  id: number;
  sail_num: string;
  boat_country_code?: string | null;
  penalty_number: string;
  race: string;
  group: string | null;
  rule: string;
  comp_action: string | null;
  description: string | null;
  class_name: string;
  date: string;
};

export default function Rule42({ regattaId }: { regattaId: number }) {
  const t = useTranslations('noticeSections.rule42');
  const tCommon = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await apiGet<Row[]>(`/rule42/${regattaId}`);
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setErr(e?.message || t('loadFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [regattaId, t]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      {loading && <div className="text-gray-500">{tCommon('loading')}</div>}
      {err && <div className="text-red-600">{err}</div>}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">{t('sailNumber')}</th>
              <th className="p-2">{t('penaltyNumber')}</th>
              <th className="p-2">{t('race')}</th>
              <th className="p-2">{t('group')}</th>
              <th className="p-2">{t('rule')}</th>
              <th className="p-2">{t('competitorAction')}</th>
              <th className="p-2">{t('notes')}</th>
              <th className="p-2">{t('class')}</th>
              <th className="p-2">{t('date')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={9}>
                  {tCommon('loading')}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={9}>
                  {t('noRecords')}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  <SailNumberDisplay countryCode={r.boat_country_code} sailNumber={r.sail_num} />
                </td>
                <td className="p-2">{r.penalty_number}</td>
                <td className="p-2">{r.race}</td>
                <td className="p-2">{r.group || tCommon('dash')}</td>
                <td className="p-2">{r.rule}</td>
                <td className="p-2">{r.comp_action || tCommon('dash')}</td>
                <td className="p-2">{r.description || tCommon('dash')}</td>
                <td className="p-2">{r.class_name}</td>
                <td className="p-2">{new Date(r.date).toLocaleDateString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
