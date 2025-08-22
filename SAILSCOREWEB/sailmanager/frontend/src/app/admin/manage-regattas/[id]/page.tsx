'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import EntryList from "@/app/regattas/[id]/components/entrylist/EntryList";
import MultiStepEntryForm from "@/components/onlineentry/MultiStepEntryForm";
import NoticeBoard from "../../../regattas/[id]/components/noticeboard/NoticeBoard";
import AdminResultsClient from "./results/AdminResultsClient";

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status?: string;
}

export default function AdminRegattaPage() {
  const { id } = useParams();
  const regattaId = parseInt(id as string);

  const [regatta, setRegatta] = useState<Regatta | null>(null);
  const [activeTab, setActiveTab] = useState<"entry" | "notice" | "form" | "results" | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  useEffect(() => {
    const fetchRegatta = async () => {
      const res = await fetch(`http://localhost:8000/regattas/${regattaId}`);
      if (!res.ok) return;
      const data = await res.json();
      setRegatta(data);
    };
    const fetchClasses = async () => {
      const res = await fetch(`http://localhost:8000/regattas/${regattaId}/classes`);
      if (!res.ok) return setAvailableClasses([]);
      const data: string[] = await res.json();
      setAvailableClasses(Array.isArray(data) ? data : []);
    };
    fetchRegatta();
    fetchClasses();
  }, [regattaId]);

  useEffect(() => {
    if (activeTab === "entry" && !selectedClass && availableClasses.length > 0) {
      setSelectedClass(availableClasses[0] ?? null);
    }
  }, [activeTab, availableClasses, selectedClass]);

  if (!regatta) return <p className="p-8">A carregar regata...</p>;

  const isResults = activeTab === "results";

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow rounded p-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">{regatta.name}</h1>
        <p className="text-gray-600">
          {regatta.location} | {regatta.start_date} – {regatta.end_date}
        </p>
        <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs mt-2 inline-block">
          {regatta.status || "Scheduled"}
        </span>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded mb-4 px-6 py-4 flex gap-6 text-blue-600 font-semibold">
        <button onClick={() => setActiveTab("entry")} className="hover:underline">Entry List</button>
        <button onClick={() => setActiveTab("notice")} className="hover:underline">Notice Board</button>
        <button onClick={() => setActiveTab("form")} className="hover:underline">Online Entry</button>
        <button onClick={() => setActiveTab("results")} className="hover:underline">Results</button>
      </div>

      {/* Class selector (só para Entry List) */}
      {activeTab === "entry" && availableClasses.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {availableClasses.map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-3 py-1 rounded font-semibold border ${
                selectedClass === cls ? "bg-blue-600 text-white" : "bg-white text-blue-600 border-blue-600"
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      )}

      {/* OUTRAS TABS no card “estreito” */}
      {!isResults && (
        <div className="p-6 bg-white rounded shadow">
          {activeTab === "entry" && <EntryList regattaId={regattaId} selectedClass={selectedClass} />}
          {activeTab === "notice" && <NoticeBoard regattaId={regattaId} admin />}
          {activeTab === "form" && (
            <p className="text-sm text-gray-500">
              Admins não podem submeter inscrições. Esta área está visível apenas para consistência visual.
            </p>
          )}
          {!activeTab && <p className="text-gray-600">Escolhe uma secção acima para ver os detalhes desta regata.</p>}
        </div>
      )}

      {/* RESULTS: full-bleed (ocupa largura total da janela) */}
      {isResults && (
        <section className="mt-2">
          {/* full-bleed wrapper: rompe containers/max-width a montante */}
          <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen">
            {/* Gutter lateral: usa px-6; troca para px-0 se quiseres colar às margens */}
            <div className="px-6">
              <AdminResultsClient regattaId={regattaId} />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
