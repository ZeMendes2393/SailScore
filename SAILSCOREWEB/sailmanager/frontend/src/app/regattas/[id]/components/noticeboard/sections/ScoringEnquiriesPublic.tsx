'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api';
import type { ScoringRead } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

type Row = ScoringRead & { _expanded?: boolean };

export default function ScoringEnquiriesPublic({ regattaId }: { regattaId: number }) {
  const t = useTranslations('noticeSections.scoring');
  const tCommon = useTranslations('common');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const listPath = useMemo(() => {
    const p = new URLSearchParams();
    p.set('public', '1');
    return `/regattas/${regattaId}/scoring?${p.toString()}`;
  }, [regattaId]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiGet<ScoringRead[]>(listPath);
      setRows(Array.isArray(data) ? data.map((d) => ({ ...d })) : []);
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listPath]);

  function toggleExpand(id: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, _expanded: !r._expanded } : r)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <button className="px-3 py-1 border rounded hover:bg-gray-50" onClick={load}>
          {t('refresh')}
        </button>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 w-16">{t('number')}</th>
              <th className="p-2 w-32">{t('sailNo')}</th>
              <th className="p-2 w-40">{t('class')}</th>
              <th className="p-2 w-40">{t('race')}</th>
              <th className="p-2">{t('requestedChange')}</th>
              <th className="p-2 w-40">{t('status')}</th>
              <th className="p-2 w-[28rem]">{t('decisionResponse')}</th>
              <th className="p-2 w-24 text-right">{t('moreInfo')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3" colSpan={8}>
                  {tCommon('loading')}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={8}>
                  {t('noEnquiries')}
                </td>
              </tr>
            )}

            {rows.map((r) => (
              <FragmentRow key={r.id} r={r} onToggle={() => toggleExpand(r.id)} />
            ))}
          </tbody>
        </table>
      </div>

      {err && <div className="text-red-600">{err}</div>}
    </div>
  );
}

function FragmentRow({ r, onToggle }: { r: Row; onToggle: () => void }) {
  const t = useTranslations('noticeSections.scoring');
  const tCommon = useTranslations('common');

  return (
    <>
      <tr className="border-t align-top">
        <td className="p-2">{r.id}</td>
        <td className="p-2">
          <SailNumberDisplay countryCode={(r as any).boat_country_code} sailNumber={r.sail_number} />
        </td>
        <td className="p-2">{r.class_name || tCommon('dash')}</td>
        <td className="p-2">{r.race_number || tCommon('dash')}</td>
        <td className="p-2">{r.requested_change || tCommon('dash')}</td>
        <td className="p-2 capitalize">{(r.status || '').replace('_', ' ')}</td>
        <td className="p-2 align-top w-[28rem]">
          <div className="max-w-[28rem] whitespace-pre-wrap break-words">
            {r.response?.trim() || <span className="text-gray-400">{tCommon('dash')}</span>}
          </div>
        </td>
        <td className="p-2 text-right align-middle">
          <button
            className="px-2 py-1 border rounded hover:bg-gray-50"
            onClick={onToggle}
            title={r._expanded ? t('hideDetails') : t('moreInfo')}
            aria-label={r._expanded ? t('hideDetails') : t('moreInfo')}
          >
            {r._expanded ? '−' : '+'}
          </button>
        </td>
      </tr>

      {r._expanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="p-3">
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <Field label={t('requestedScore')} value={fmtNum(r.requested_score)} />
              <Field label={t('boatAhead')} value={fmtText(r.boat_ahead)} />
              <Field label={t('boatBehind')} value={fmtText(r.boat_behind)} />
              <Field
                label={t('createdAt')}
                value={r.created_at ? new Date(r.created_at).toLocaleString('en-GB') : tCommon('dash')}
              />
              <Field
                label={t('updatedAt')}
                value={r.updated_at ? new Date(r.updated_at).toLocaleString('en-GB') : tCommon('dash')}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}

function fmtNum(n?: number | null) {
  return typeof n === 'number' && Number.isFinite(n) ? String(n) : '—';
}
function fmtText(text?: string | null) {
  return (text || '').trim() || '—';
}
