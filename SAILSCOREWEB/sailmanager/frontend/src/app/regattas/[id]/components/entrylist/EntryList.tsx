"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface Entry {
  id: number;
  class_name: string;
  first_name: string;
  last_name: string;
  club: string;
  email?: string;
  contact_phone_1?: string;
  sail_number?: string;
  boat_name?: string;
  category?: string;
  paid?: boolean;
}

interface EntryListProps {
  regattaId: number;
  selectedClass: string | null; // ✅ nova prop
}

export default function EntryList({ regattaId, selectedClass }: EntryListProps) {
  const { user, token } = useAuth();
  const isAdmin = user?.role === "admin";

  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const url = selectedClass
          ? `http://localhost:8000/entries/by_regatta/${regattaId}?class=${encodeURIComponent(selectedClass)}`
          : `http://localhost:8000/entries/by_regatta/${regattaId}`;

        const res = await fetch(url);
        const data = await res.json();
        setEntries(data);
      } catch (err) {
        console.error("❌ Erro a carregar inscrições:", err);
      }
    };

    fetchEntries();
  }, [regattaId, selectedClass]); // ✅ depende também da classe selecionada

  const togglePaid = async (entryId: number) => {
    if (!isAdmin || !token) return;

    try {
      const res = await fetch(`http://localhost:8000/entries/${entryId}/toggle_paid`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("❌ Erro ao atualizar pagamento:", errorData.detail);
        return;
      }

      const data = await res.json();

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, paid: data.paid } : entry
        )
      );
    } catch (error) {
      console.error("⚠️ Erro na requisição:", error);
    }
  };

  const toggleDetails = (id: number) => {
    if (!isAdmin) return;
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      {entries.length === 0 ? (
        <p className="text-gray-500">Ainda não há inscrições para esta classe nesta regata.</p>
      ) : (
        <table className="w-full table-auto border mt-2 text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2 border">Classe</th>
              <th className="p-2 border">Nome</th>
              <th className="p-2 border">Clube</th>
              {isAdmin && <th className="p-2 border text-center">Pago</th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <React.Fragment key={entry.id}>
                <tr
                  onClick={() => toggleDetails(entry.id)}
                  className={isAdmin ? "cursor-pointer hover:bg-gray-50" : ""}
                >
                  <td className="p-2 border">{entry.class_name}</td>
                  <td className="p-2 border">{entry.first_name} {entry.last_name}</td>
                  <td className="p-2 border">{entry.club}</td>
                  {isAdmin && (
                    <td className="p-2 border text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(entry.paid)}
                        onChange={() => togglePaid(entry.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                </tr>

                {isAdmin && selectedId === entry.id && (
                  <tr>
                    <td colSpan={4} className="p-2 border bg-gray-50">
                      <div className="text-gray-700 space-y-1">
                        <p><strong>Email:</strong> {entry.email || "—"}</p>
                        <p><strong>Contacto:</strong> {entry.contact_phone_1 || "—"}</p>
                        <p><strong>Número de vela:</strong> {entry.sail_number || "—"}</p>
                        <p><strong>Nome do barco:</strong> {entry.boat_name || "—"}</p>
                        <p><strong>Categoria:</strong> {entry.category || "—"}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
