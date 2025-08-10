"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MultiStepEntryForm from "@/components/onlineentry/MultiStepEntryForm";
import EntryList from "./components/entrylist/EntryList";
import NoticeBoard from "./components/noticeboard/NoticeBoard";

interface Regatta {
  id: number;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status?: string;
}

interface RegattaClass {
  id: number;
  regatta_id: number;
  class_name: string;
}

export default function RegattaDetails() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [regatta, setRegatta] = useState<Regatta | null>(null);
  const [activeTab, setActiveTab] = useState<"entry" | "notice" | "form" | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<RegattaClass[]>([]);

  useEffect(() => {
    const fetchRegatta = async () => {
      const res = await fetch(`http://localhost:8000/regattas/${id}`);
      const data = await res.json();
      setRegatta(data);
    };

    const fetchClasses = async () => {
      const res = await fetch(`http://localhost:8000/regatta-classes/by_regatta/${id}`);
      const data = await res.json();
      if (Array.isArray(data)) setAvailableClasses(data);
      else console.warn("❌ Erro ao carregar classes:", data);
    };

    fetchRegatta();
    fetchClasses();
  }, [id]);

  useEffect(() => {
    if (activeTab === "entry" && !selectedClass && availableClasses.length > 0) {
      setSelectedClass(availableClasses[0].class_name);
    }
  }, [activeTab, availableClasses, selectedClass]);

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

      {/* CLASS SELECTOR */}
      {availableClasses.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {availableClasses.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls.class_name)}
              className={`px-3 py-1 rounded font-semibold border ${
                selectedClass === cls.class_name
                  ? "bg-blue-600 text-white"
                  : "bg-white text-blue-600 border-blue-600"
              }`}
            >
              {cls.class_name}
            </button>
          ))}
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="bg-white shadow rounded mb-4 px-6 py-4 flex gap-6 text-blue-600 font-semibold">
        <button onClick={() => setActiveTab("entry")} className="hover:underline">Entry List</button>
        <button onClick={() => setActiveTab("notice")} className="hover:underline">Notice Board</button>
        <button onClick={() => setActiveTab("form")} className="hover:underline">Online Entry</button>
        <button
          onClick={() => router.push(`/regattas/${id}/results`)} // 🔁 redireciona para nova página
          className="hover:underline"
        >
          Results
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="p-6 bg-white rounded shadow">
        {activeTab === "entry" && <EntryList regattaId={parseInt(id)} selectedClass={selectedClass} />}
        {activeTab === "notice" && <NoticeBoard regattaId={parseInt(id)} />}
        {activeTab === "form" && <MultiStepEntryForm regattaId={parseInt(id)} />}

        {!activeTab && (
          <p className="text-gray-600">
            Escolhe uma secção acima para ver os detalhes desta regata.
          </p>
        )}
      </div>
    </main>
  );
}
