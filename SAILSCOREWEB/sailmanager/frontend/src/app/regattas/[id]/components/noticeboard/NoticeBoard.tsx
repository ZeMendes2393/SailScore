'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Documents from './sections/DocumentsPublic';
import Rule42 from './sections/Rule42Public';
import Hearings from './sections/HearingsPublic';
import ProtestTimeLimitPublic from './sections/ProtestTimeLimitPublic';
import ScoringEnquiriesPublic from './sections/ScoringEnquiriesPublic';
import RequestsPublic from './sections/RequestsPublic';
import QuestionsPublic from './sections/QuestionsPublic';
import FleetsPublic from './sections/FleetsPublic';

type Section =
  | 'documents'
  | 'rule42'
  | 'protests'
  | 'ptl'
  | 'scoring'
  | 'requests'
  | 'questions'
  | 'fleets';

export default function NoticeBoard({ regattaId }: { regattaId: number }) {
  const [section, setSection] = useState<Section>('documents');
  const t = useTranslations('noticeBoard');

  if (!Number.isFinite(regattaId)) {
    return <div className="p-4">{t('invalidRegatta')}</div>;
  }

  const Tab = ({ value, label }: { value: Section; label: string }) => (
    <button
      type="button"
      onClick={() => setSection(value)}
      className={[
        'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2',
        section === value
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300',
      ].join(' ')}
      aria-selected={section === value}
      role="tab"
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t('title')}</h2>

      <div
        role="tablist"
        aria-label={t('tabListAria')}
        className="flex gap-2 border-b flex-wrap"
      >
        <Tab value="documents" label={t('tabs.documents')} />
        <Tab value="rule42" label={t('tabs.rule42')} />
        <Tab value="protests" label={t('tabs.protests')} />
        <Tab value="scoring" label={t('tabs.scoring')} />
        <Tab value="requests" label={t('tabs.requests')} />
        <Tab value="questions" label={t('tabs.questions')} />
        <Tab value="ptl" label={t('tabs.ptl')} />
        <Tab value="fleets" label={t('tabs.fleets')} />
      </div>

      <div className="pt-4">
        {section === 'documents' && <Documents regattaId={regattaId} />}
        {section === 'rule42' && <Rule42 regattaId={regattaId} />}
        {section === 'protests' && <Hearings regattaId={regattaId} />}
        {section === 'scoring' && <ScoringEnquiriesPublic regattaId={regattaId} />}
        {section === 'requests' && <RequestsPublic regattaId={regattaId} />}
        {section === 'questions' && <QuestionsPublic regattaId={regattaId} />}
        {section === 'ptl' && <ProtestTimeLimitPublic regattaId={regattaId} />}
        {section === 'fleets' && <FleetsPublic regattaId={regattaId} />}
      </div>
    </div>
  );
}
