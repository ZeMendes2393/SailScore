'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiGet } from '@/lib/api';
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay';

type QuestionRead = {
  id: number;
  seq_no: number;
  class_name?: string | null;
  sail_number?: string | null;
  subject: string;
  body: string;
  status: 'open' | 'answered' | 'closed';
  answer_text?: string | null;
  created_at: string;
};

export default function QuestionsPublic({ regattaId }: { regattaId: number }) {
  const t = useTranslations('noticeSections.questions');
  const tCommon = useTranslations('common');
  const [rows, setRows] = useState<QuestionRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const listPath = useMemo(() => `/regattas/${regattaId}/questions`, [regattaId]);

  const statusLabel = (status: QuestionRead['status']) => {
    if (status === 'open') return t('statusOpen');
    if (status === 'answered') return t('statusAnswered');
    return t('statusClosed');
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await apiGet<QuestionRead[]>(listPath);
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
              <th className="p-2 w-20">{t('number')}</th>
              <th className="p-2 w-32">{t('sailNo')}</th>
              <th className="p-2 w-40">{t('class')}</th>
              <th className="p-2">{t('subject')}</th>
              <th className="p-2 w-28">{t('status')}</th>
              <th className="p-2 w-[28rem]">{t('answer')}</th>
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
                  {t('noQuestions')}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2">{t('questionPrefix', { no: r.seq_no })}</td>
                <td className="p-2">
                  <SailNumberDisplay
                    countryCode={(r as any).boat_country_code}
                    sailNumber={r.sail_number}
                  />
                </td>
                <td className="p-2">{r.class_name || tCommon('dash')}</td>
                <td className="p-2 max-w-[28rem]">
                  <div className="font-medium">{r.subject}</div>
                  <div className="whitespace-pre-wrap break-words opacity-80">{r.body}</div>
                </td>
                <td className="p-2">{statusLabel(r.status)}</td>
                <td className="p-2 max-w-[28rem]">
                  <div className="whitespace-pre-wrap break-words">
                    {r.answer_text?.trim() || tCommon('dash')}
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
