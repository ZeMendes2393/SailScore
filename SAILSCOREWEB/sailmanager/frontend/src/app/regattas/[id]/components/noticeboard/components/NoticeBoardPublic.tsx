"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotices } from "@/lib/hooks/useNotices";
import NoticeFilters from "./NoticeFilters";
import { api, BASE_URL as API_BASE } from "@/lib/api";
import type { RegattaClass, Notice } from "@/types/notice";

type Props = { regattaId: number };

export default function NoticeBoardPublic({ regattaId }: Props) {
  // Hook de notices – versão “light” (sem doc_type / is_important)
  const {
    data,
    loading,
    error,
    setClassName,
    setOnlyAll,
    setQuery,
    refresh,
  } = useNotices(regattaId);

  const [classes, setClasses] = useState<string[]>([]);

  useEffect(() => {
    api<RegattaClass[]>(`/regattas/${regattaId}/classes`)
      .then((list) => setClasses(Array.from(new Set(list.map((c) => c.class_name)))))
      .catch(() => setClasses([]));
  }, [regattaId]);

  const header = useMemo(
    () => (
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Documents / Notices</h2>
        <button
          onClick={refresh}
          className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
        >
          Atualizar
        </button>
      </div>
    ),
    [refresh]
  );

  return (
    <div className="space-y-4">
      {header}

      <NoticeFilters
        classes={classes}
        onClassChange={setClassName}
        onOnlyAllChange={setOnlyAll}
        onQueryChange={setQuery}
        /* removidos: onDocTypeChange, onImportantChange */
      />

      {loading && <div className="text-gray-500">A carregar…</div>}
      {error && <div className="text-red-600">{String(error)}</div>}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Título</th>
              <th className="p-3">Publicado</th>
              <th className="p-3">Classes</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map((n: Notice) => (
              <tr key={n.id} className="border-t">
                <td className="p-3">{n.title}</td>
                <td className="p-3">
                  {n.published_at
                    ? new Date(n.published_at).toLocaleString()
                    : "—"}
                </td>
                <td className="p-3">
                  {n.applies_to_all ? "ALL" : (n.classes ?? []).join(", ")}
                </td>
                <td className="p-3 text-right">
                  <a
                    href={`${API_BASE}/notices/${n.id}/download`}
                    className="text-blue-600 hover:underline"
                  >
                    Download
                  </a>
                  {/* Se preferires apenas abrir numa nova aba o ficheiro estático:
                      <a href={`${API_BASE}${n.filepath}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Abrir
                      </a>
                  */}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={4}>
                  Sem documentos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
