'use client';

import { useNotices } from '@/lib/hooks/useNotices';
import { useTranslations } from 'next-intl';
import NoticeTable from '../components/NoticeTable';

export default function Documents({ regattaId }: { regattaId: number }) {
  const t = useTranslations('noticeSections.documents');
  const tCommon = useTranslations('common');
  const { data, loading, error } = useNotices(regattaId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
      </div>

      {loading && <div className="text-gray-500">{tCommon('loading')}</div>}
      {error && <div className="text-red-600">{String(error)}</div>}

      <NoticeTable items={data} />
    </div>
  );
}
