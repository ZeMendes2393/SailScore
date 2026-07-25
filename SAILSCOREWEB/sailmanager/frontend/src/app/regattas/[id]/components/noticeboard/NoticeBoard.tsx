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
        'rounded-full px-4 py-2 text-sm font-semibold transition shadow-sm',
        section === value
          ? 'bg-blue-600 text-white shadow-blue-200'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900',
      ].join(' ')}
      aria-selected={section === value}
      role="tab"
    >
      {label}
    </button>
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Official notices
        </p>
        <h2 className="text-2xl font-bold text-slate-950">{t('title')}</h2>
      </div>

      <div
        role="tablist"
        aria-label={t('tabListAria')}
        className="flex flex-wrap gap-2 rounded-2xl bg-slate-100/80 p-2"
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {section === 'documents' && <Documents regattaId={regattaId} />}
        {section === 'rule42' && <Rule42 regattaId={regattaId} />}
        {section === 'protests' && <Hearings regattaId={regattaId} />}
        {section === 'scoring' && <ScoringEnquiriesPublic regattaId={regattaId} />}
        {section === 'requests' && <RequestsPublic regattaId={regattaId} />}
        {section === 'questions' && <QuestionsPublic regattaId={regattaId} />}
        {section === 'ptl' && <ProtestTimeLimitPublic regattaId={regattaId} />}
        {section === 'fleets' && <FleetsPublic regattaId={regattaId} />}
      </div>
    </section>
  );
}
