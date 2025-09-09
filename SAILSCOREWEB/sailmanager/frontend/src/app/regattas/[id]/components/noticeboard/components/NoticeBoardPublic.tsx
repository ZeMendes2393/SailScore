// src/app/admin/manage-regattas/[id]/noticeboard/NoticeBoardPublic.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useNotices } from "@/lib/hooks/useNotices";
import NoticeFilters from "./NoticeFilters";
import { apiGet, BASE_URL as API_BASE } from "@/lib/api";
import type { Notice } from "@/types/notice";

type Props = { regattaId: number };

export default function NoticeBoardPublic({ regattaId }: Props) {
  const {
    data,
    loading,
    error,
    setClassName,
    setOnlyAll,
    setQuery,
    refresh,
  } = useNotices(regattaId);

  // <- classes vêm como string[]
  const [classes, setClasses] = useState<string[]>([]);

  useEffect(() => {
    apiGet<string[]>(`/regattas/${regattaId}/classes`)
      .then((list) => {
        // protege contra respostas tortas
        const arr = Array.isArray(list) ? list : [];
        setClasses(
          Array.from(new Set(arr.filter((x): x is string => typeof x === "string")))
        );
      })
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
        // se o teu NoticeFilters exigir estes props, passa no-op:
        // onDocTypeChange={() => {}}
        // onImportantChange={() => {}}
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
                    ? new Date(n.published_at).toLocaleString("pt-PT")
                    : "—"}
                </td>
                <td className="p-3">
                  {n.applies_to_all ? "ALL" : (n.classes ?? []).join(", ")}
                </td>
                <td className="p-3 text-right">
                  {/* Usa o caminho público que o backend expõe via /uploads */}
                  <a
                    href={`${API_BASE}${n.filepath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Abrir PDF
                  </a>
                </td>
              </tr>
            ))}
            {data.length === 0 && !loading && (
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
