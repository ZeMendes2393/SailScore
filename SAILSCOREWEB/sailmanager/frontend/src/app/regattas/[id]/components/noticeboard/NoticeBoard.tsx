'use client';

import { useState } from 'react';
import Documents from './sections/DocumentsPublic';
import Rule42 from './sections/Rule42Public';
import Hearings from './sections/HearingsPublic';
import ProtestTimeLimitPublic from './sections/ProtestTimeLimitPublic';
import ScoringEnquiriesPublic from './sections/ScoringEnquiriesPublic';
import RequestsPublic from './sections/RequestsPublic';
import QuestionsPublic from './sections/QuestionsPublic';

type Section =
  | 'documents'
  | 'rule42'
  | 'protests'
  | 'ptl'
  | 'scoring'
  | 'requests'
  | 'questions';

export default function NoticeBoard({ regattaId }: { regattaId: number }) {
  if (!Number.isFinite(regattaId)) {
    return <div className="p-4">Invalid regatta.</div>;
  }

  const [section, setSection] = useState<Section>('documents');

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
      <h2 className="text-xl font-semibold">Notice Board</h2>

      <div role="tablist" aria-label="Public sections" className="flex gap-2 border-b">
        <Tab value="documents" label="Documents" />
        <Tab value="rule42" label="Rule 42" />
        <Tab value="protests" label="Protest Decisions" />
        <Tab value="scoring" label="Scoring Enquiries" />
        <Tab value="requests" label="Requests" />
        <Tab value="questions" label="Questions" />
        <Tab value="ptl" label="Protest Time Limit" />
      </div>

      <div className="pt-4">
        {section === 'documents' && <Documents regattaId={regattaId} />}
        {section === 'rule42' && <Rule42 regattaId={regattaId} />}
        {section === 'protests' && <Hearings regattaId={regattaId} />}
        {section === 'scoring' && <ScoringEnquiriesPublic regattaId={regattaId} />}
        {section === 'requests' && <RequestsPublic regattaId={regattaId} />}
        {section === 'questions' && <QuestionsPublic regattaId={regattaId} />}
        {section === 'ptl' && <ProtestTimeLimitPublic regattaId={regattaId} />}
      </div>
    </div>
  );
}
