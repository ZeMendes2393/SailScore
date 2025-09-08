"use client";

import { Notice } from "@/types/notice";
import { BASE_URL as API_BASE, apiDelete } from "@/lib/api";

type Props = { items: Notice[]; onChanged: () => void };

export default function AdminNoticeTable({ items, onChanged }: Props) {
  const del = async (id: number) => {
    if (!confirm("Apagar documento?")) return;
    try {
      await apiDelete(`/notices/${id}`);
      onChanged();
    } catch (e) {
      console.error(e);
      alert("Falha ao apagar o documento.");
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="p-3">Título</th>
            <th className="p-3">Classes</th>
            <th className="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((n) => (
            <tr key={n.id} className="border-t">
              <td className="p-3">{n.title}</td>
              <td className="p-3">
                {n.applies_to_all ? "ALL" : (n.classes ?? []).join(", ")}
              </td>
              <td className="p-3 text-right">
                <div className="inline-flex gap-3">
                  {/* Download com filename correto via endpoint */}
                  <a
                    href={`${API_BASE}/notices/${n.id}/download`}
                    className="text-blue-600 hover:underline"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => del(n.id)}
                    className="text-red-600 hover:underline"
                  >
                    Apagar
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="p-6 text-center text-gray-500" colSpan={3}>
                Sem documentos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
