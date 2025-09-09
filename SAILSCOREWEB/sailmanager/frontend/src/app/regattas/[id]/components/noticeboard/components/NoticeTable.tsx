"use client";

import { Notice } from "@/types/notice";
import { BASE_URL as API_BASE } from "@/lib/api";

interface Props {
  items: Notice[];
  onPreview: (notice: Notice) => void;
}

export default function NoticeTable({ items, onPreview }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="p-3">Data</th>
            <th className="p-3">Hora</th>
            <th className="p-3">Título</th>
            <th className="p-3">Categoria</th>
            <th className="p-3">Classes</th>
            <th className="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="p-6 text-center text-gray-500">
                Sem documentos.
              </td>
            </tr>
          )}
          {items.map((n) => {
            const d = new Date(n.published_at);
            const date = d.toLocaleDateString("pt-PT");
            const time = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

            return (
              <tr key={n.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{date}</td>
                <td className="p-3">{time}</td>
                <td className="p-3">
                  <span className="font-medium">{n.title}</span>
                </td>
                <td className="p-3">{n.source.replaceAll("_", " ")}</td>
                <td className="p-3">
                  {n.applies_to_all ? (
                    <span className="text-xs rounded bg-gray-100 px-2 py-0.5">All Classes</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(n.classes ?? []).map((c) => (
                        <span key={`cls-${c}`} className="text-xs rounded bg-gray-100 px-2 py-0.5">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-2">
                    <button onClick={() => onPreview(n)} className="text-blue-600 hover:underline">
                      Ver
                    </button>
                    <a
                      href={`${API_BASE}/notices/${n.id}/download`}
                      className="text-blue-600 hover:underline"
                    >
                      Download
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
