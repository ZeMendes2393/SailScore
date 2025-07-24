"use client";

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
  const [activeTab, setActiveTab] = useState<"entry" | "notice" | "form" | "results" | null>(null); // ✅ incluir "results"

  useEffect(() => {
    const fetchRegatta = async () => {
      const res = await fetch(`http://localhost:8000/regattas/${regattaId}`);
      const data = await res.json();
      setRegatta(data);
    };
    fetchRegatta();
  }, [regattaId]);

  if (!regatta) return <p className="p-8">A carregar regata...</p>;

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="bg-white shadow rounded p-6 mb-6">
        <h1 className="text-3xl font-bold mb-2">{regatta.name}</h1>
        <p className="text-gray-600">
          {regatta.location} | {regatta.start_date} – {regatta.end_date}
        </p>
        <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs mt-2 inline-block">
          {regatta.status || "Scheduled"}
        </span>
      </div>

      {/* NAVIGATION TABS */}
      <div className="bg-white shadow rounded mb-4 px-6 py-4 flex gap-6 text-blue-600 font-semibold">
        <button onClick={() => setActiveTab("entry")} className="hover:underline">Entry List</button>
        <button onClick={() => setActiveTab("notice")} className="hover:underline">Notice Board</button>
        <button onClick={() => setActiveTab("form")} className="hover:underline">Online Entry</button>
        <button onClick={() => setActiveTab("results")} className="hover:underline">Results</button> {/* ✅ nova aba */}
      </div>

      {/* TAB CONTENT */}
      <div className="p-6 bg-white rounded shadow">
        {activeTab === "entry" && <EntryList regattaId={regattaId} />}
        {activeTab === "notice" && <NoticeBoard regattaId={regattaId} admin />}
        {activeTab === "form" && (
          <p className="text-sm text-gray-500">
            Admins não podem submeter inscrições. Esta área está visível apenas para consistência visual.
          </p>
        )}
{activeTab === "results" && <AdminResultsClient regattaId={regattaId} />}
        {!activeTab && (
          <p className="text-gray-600">
            Escolhe uma secção acima para ver os detalhes desta regata.
          </p>
        )}
      </div>
    </main>
  );
}
