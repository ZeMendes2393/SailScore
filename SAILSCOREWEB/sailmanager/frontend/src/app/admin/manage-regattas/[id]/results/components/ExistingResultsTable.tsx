// src/app/admin/manage-regattas/[id]/results/components/ExistingResultsTable.tsx
'use client';

import type { ApiResult } from '../types';

interface Props {
  results: ApiResult[];
  loading: boolean;
  onMove: (rowId: number, delta: -1 | 1) => void;
  onEditPos: (rowId: number, newPos: number) => void;
  onSaveOrder: () => void;
  onDelete: (rowId: number) => void;
  scoringCodes: Record<string, number>;                 // 👈 NOVO
  onMarkCode: (rowId: number, code: string | null) => void; // 👈 NOVO
}

export default function ExistingResultsTable({
  results, loading, onMove, onEditPos, onSaveOrder, onDelete,
  scoringCodes, onMarkCode,
}: Props) {
  if (loading) return <p className="p-4 text-gray-500">A carregar…</p>;
  if (results.length === 0) return <p className="p-4 text-gray-500">Sem resultados guardados para esta corrida.</p>;

  const sorted = results.slice().sort((a, b) => a.position - b.position);
  const codeOptions = Object.keys(scoringCodes); // ex.: ['DNF','DNC','DSQ']

  return (
    <>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th className="border px-2 py-2 text-left">Vela</th>
            <th className="border px-2 py-2 text-left">Timoneiro</th>
            <th className="border px-2 py-2 text-center">Posição</th>
            <th className="border px-2 py-2 text-left">Código</th> {/* 👈 NOVO */}
            <th className="border px-2 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => (
            <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border px-2 py-2">{row.sail_number}</td>
              <td className="border px-2 py-2">{row.skipper_name}</td>

              {/* POSIÇÃO (bloquear se houver código) */}
              <td className="border px-2 py-2 text-center">
                <input
                  type="number"
                  min={1}
                  className="w-24 border rounded px-2 py-1 text-center"
                  defaultValue={row.position}
                  disabled={loading || !!row.code}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v >= 1) onEditPos(row.id, v);
                  }}
                />
              </td>

              {/* CÓDIGO */}
              <td className="border px-2 py-2">
                <div className="flex items-center gap-2">
                  <select
                    className="border rounded px-2 py-1"
                    value={row.code ?? ''}
                    disabled={loading}
                    onChange={(ev) => onMarkCode(row.id, ev.target.value || null)}
                    aria-label="Código de pontuação (ex.: DNF/DNC/DSQ)"
                  >
                    <option value="">(nenhum)</option>
                    {codeOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {row.code ? (
                    <span className="text-xs text-gray-500">
                      vale {scoringCodes[row.code]} pts
                    </span>
                  ) : null}
                </div>
              </td>

              {/* AÇÕES */}
              <td className="border px-2 py-2 text-right">
                <div className="inline-flex gap-2">
                  <button
                    disabled={loading}
                    onClick={() => onMove(row.id, -1)}
                    className="px-2 py-1 rounded border hover:bg-gray-100 disabled:opacity-50"
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => onMove(row.id, +1)}
                    className="px-2 py-1 rounded border hover:bg-gray-100 disabled:opacity-50"
                    title="Descer"
                  >
                    ↓
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => {
                      if (confirm('Eliminar este resultado? As posições seguintes serão ajustadas.')) {
                        onDelete(row.id);
                      }
                    }}
                    className="px-2 py-1 rounded border hover:bg-red-50 text-red-600 disabled:opacity-50"
                    title="Eliminar"
                  >
                    🗑
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="sticky bottom-0 bg-white/80 backdrop-blur border-t p-2 text-right">
        <button
          disabled={loading}
          onClick={onSaveOrder}
          className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded disabled:opacity-50"
        >
          Guardar ordem
        </button>
      </div>
    </>
  );
}
