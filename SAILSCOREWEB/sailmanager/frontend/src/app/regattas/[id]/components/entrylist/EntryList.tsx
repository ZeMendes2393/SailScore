"use client";
import { useEffect, useState } from "react";

interface Entry {
  id: number;
  class_name: string;
  first_name: string;
  last_name: string;
  club: string;
}
export default function EntryList({
  regattaId,
  admin = false,
}: {
  regattaId: number;
  admin?: boolean;
}) {


  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const fetchEntries = async () => {
      const res = await fetch(`http://localhost:8000/entries/by_regatta/${regattaId}`);
      const data = await res.json();
      setEntries(data);
    };
    fetchEntries();
  }, [regattaId]);

  return (
    <div>
      {entries.length === 0 ? (
        <p className="text-gray-500">Ainda não há inscrições para esta regata.</p>
      ) : (
        <table className="w-full table-auto border mt-2">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2 border">Classe</th>
              <th className="p-2 border">Nome</th>
              <th className="p-2 border">Clube</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="p-2 border">{entry.class_name}</td>
                <td className="p-2 border">{`${entry.first_name} ${entry.last_name}`}</td>

                <td className="p-2 border">{entry.club}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
