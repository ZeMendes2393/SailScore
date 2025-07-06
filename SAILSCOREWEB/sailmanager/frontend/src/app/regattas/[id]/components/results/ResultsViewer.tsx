"use client";

import { useEffect, useState } from "react";

interface ResultsViewerProps {
  regattaId: number;
}

interface RaceResult {
  id: number;
  race_number: number;
  results: {
    position: number;
    boat_name: string;
    sail_number: string;
    points: number;
  }[];
}

export default function ResultsViewer({ regattaId }: ResultsViewerProps) {
  const [races, setRaces] = useState<RaceResult[]>([]);

  useEffect(() => {
    // Mock fetch de resultados - futuramente será API call
    const mockData: RaceResult[] = [
      {
        id: 1,
        race_number: 1,
        results: [
          { position: 1, boat_name: "Flecha", sail_number: "POR 123", points: 1 },
          { position: 2, boat_name: "Vento Norte", sail_number: "POR 456", points: 2 },
          { position: 3, boat_name: "Mar Bravo", sail_number: "POR 789", points: 3 },
        ],
      },
      {
        id: 2,
        race_number: 2,
        results: [
          { position: 1, boat_name: "Vento Norte", sail_number: "POR 456", points: 1 },
          { position: 2, boat_name: "Mar Bravo", sail_number: "POR 789", points: 2 },
          { position: 3, boat_name: "Flecha", sail_number: "POR 123", points: 3 },
        ],
      },
    ];
    setRaces(mockData);
  }, [regattaId]);

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold mb-4">Resultados</h2>
      {races.map((race) => (
        <div key={race.id} className="border rounded shadow p-4">
          <h3 className="text-lg font-medium mb-2">Prova {race.race_number}</h3>
          <table className="min-w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Posição</th>
                <th className="p-2 border">Barco</th>
                <th className="p-2 border">Vela</th>
                <th className="p-2 border">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {race.results.map((r, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="p-2 border text-center">{r.position}</td>
                  <td className="p-2 border">{r.boat_name}</td>
                  <td className="p-2 border">{r.sail_number}</td>
                  <td className="p-2 border text-center">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
