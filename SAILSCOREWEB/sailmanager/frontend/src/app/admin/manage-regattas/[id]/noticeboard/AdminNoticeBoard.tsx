'use client';

import { useState } from "react";
import Documents from "./sections/Documents";
import Rule42 from "./sections/Rule42";
import HearingsDecisions from "./sections/HearingsDecisions";
import ProtestTimeLimit from "./sections/ProtestTimeLimit";
import ScoringEnquiries from "./sections/ScoringEnquiries";
import Requests from "./sections/Requests";
import Questions from "./sections/Questions"; // ⬅️ NEW

type Section =
  | "documents"
  | "rule42"
  | "protest-decisions"
  | "protest-time-limit"
  | "scoring"
  | "requests"
  | "questions"; // ⬅️ NEW

export default function AdminNoticeBoard({ regattaId }: { regattaId: number }) {
  const [section, setSection] = useState<Section>("documents");

  const Tab = ({ value, label }: { value: Section; label: string }) => (
    <button
      type="button"
      onClick={() => setSection(value)}
      className={[
        "px-4 py-2 text-sm font-medium rounded-t-lg border-b-2",
        section === value
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300",
      ].join(" ")}
      aria-selected={section === value}
      role="tab"
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Notice Board — Admin</h2>

      {/* Tabs */}
      <div role="tablist" aria-label="Notice board sections" className="flex gap-2 border-b">
        <Tab value="documents" label="Documents" />
        <Tab value="rule42" label="Rule 42" />
        <Tab value="protest-decisions" label="Protest Decisions" />
        <Tab value="protest-time-limit" label="Protest Time Limit" />
        <Tab value="scoring" label="Scoring Enquiries" />
        <Tab value="requests" label="Requests" />
        <Tab value="questions" label="Questions" /> {/* ⬅️ NEW */}
      </div>

      {/* Section content */}
      <div className="pt-4">
        {section === "documents" && <Documents regattaId={regattaId} />}
        {section === "rule42" && <Rule42 regattaId={regattaId} />}
        {section === "protest-decisions" && <HearingsDecisions regattaId={regattaId} />}
        {section === "protest-time-limit" && <ProtestTimeLimit regattaId={regattaId} />}
        {section === "scoring" && <ScoringEnquiries regattaId={regattaId} />}
        {section === "requests" && <Requests regattaId={regattaId} />}
        {section === "questions" && <Questions regattaId={regattaId} />} {/* ⬅️ NEW */}
      </div>
    </div>
  );
}
