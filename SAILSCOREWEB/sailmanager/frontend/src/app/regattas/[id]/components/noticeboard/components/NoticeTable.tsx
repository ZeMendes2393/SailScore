'use client';

import { Notice } from '@/types/notice';
import { getApiBaseUrl } from '@/lib/api';
import { useTranslations } from 'next-intl';

interface Props {
  items: Notice[];
}

export default function NoticeTable({ items }: Props) {
  const t = useTranslations('noticeSections.documents');

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-slate-800">
        <thead className="bg-slate-50/95 text-left">
          <tr>
            <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">{t('date')}</th>
            <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">{t('time')}</th>
            <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">{t('titleCol')}</th>
            <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">{t('category')}</th>
            <th className="border-b border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">{t('download')}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-gray-500">
                {t('noDocuments')}
              </td>
            </tr>
          )}
          {items.map((n) => {
            const d = new Date(n.published_at);
            const date = d.toLocaleDateString('en-GB');
            const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            return (
              <tr key={n.id} className="border-b border-slate-100 last:border-b-0 hover:bg-blue-50/40">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{date}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{time}</td>
                <td className="min-w-[16rem] px-4 py-3">
                  <span className="font-semibold text-slate-950">{n.title}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    {n.source.replaceAll('_', ' ')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <a
                    href={`${getApiBaseUrl()}/notices/${n.id}/download`}
                    className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    {t('download')}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
