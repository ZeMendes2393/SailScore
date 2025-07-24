"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Entry {
  id: number;
  class_name: string;
  skipper_name: string;
}

interface FinalResult {
  id: number;
  position: number;
  class_name: string;
  skipper_name: string;
}

export default function RaceResultsPage() {
  const params = useParams();
  const regattaId = params.id;
  const raceId = params.race_id;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [results, setResults] = useState<Record<number, number>>({});
  const [finalResults, setFinalResults] = useState<FinalResult[]>([]);

  useEffect(() => {
    const fetchEntries = async () => {
      const res = await fetch(`http://localhost:8000/entries/by_regatta/${regattaId}`);
      const data = await res.json();
      setEntries(data);
    };

    const fetchExistingResults = async () => {
      const res = await fetch(`http://localhost:8000/results/by_race/${raceId}`);
      if (res.ok) {
        const data = await res.json();
        setFinalResults(data);
      }
    };

    fetchEntries();
    fetchExistingResults();
  }, [regattaId, raceId]);

  const handleSubmit = async () => {
    for (const entry of entries) {
      const position = results[entry.id];
      if (!position) continue;

      await fetch("http://localhost:8000/results/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          race_id: raceId,
          entry_id: entry.id,
          position: position,
        }),
      });
    }

    // Recarregar resultados
    const res = await fetch(`http://localhost:8000/results/by_race/${raceId}`);
    const data = await res.json();
    setFinalResults(data);
    setResults({});
    alert("Resultados submetidos com sucesso!");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Resultados da Corrida</h1>

      <ul className="space-y-4">
        {entries.map((entry) => (
          <li key={entry.id} className="bg-white p-4 rounded shadow">
            <div className="mb-2">
              <strong>{entry.class_name}</strong> - {entry.skipper_name}
            </div>
            <input
              type="number"
              min={1}
              className="border px-2 py-1 rounded w-32"
              placeholder="Posição"
              value={results[entry.id] || ""}
              onChange={(e) =>
                setResults({ ...results, [entry.id]: Number(e.target.value) })
              }
            />
          </li>
        ))}
      </ul>

      <button
        onClick={handleSubmit}
        className="mt-6 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        Submeter Resultados
      </button>

      {finalResults.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-4">Classificação Final</h2>
          <table className="min-w-full border border-gray-300 text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="border px-2 py-1">Posição</th>
                <th className="border px-2 py-1">Classe</th>
                <th className="border px-2 py-1">Tripulação</th>
              </tr>
            </thead>
            <tbody>
              {finalResults
                .sort((a, b) => a.position - b.position)
                .map((result) => (
                  <tr key={result.id}>
                    <td className="border px-2 py-1 text-center">{result.position}</td>
                    <td className="border px-2 py-1">{result.class_name}</td>
                    <td className="border px-2 py-1">{result.skipper_name}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
