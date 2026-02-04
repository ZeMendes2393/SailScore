// src/app/admin/manage-regattas/[id]/results/components/ExistingResultsTable.tsx
'use client';

import { useMemo, useState } from 'react';
import type { ApiResult } from '../types';

interface Props {
  results?: ApiResult[];
  loading: boolean;
  onMove: (rowId: number, delta: -1 | 1) => void;
  onEditPos: (rowId: number, newPos: number) => void;
  onSaveOrder: () => void;
  onDelete: (rowId: number) => void;

  // mapping "custom" vindo do backend (regatta/class settings)
  scoringCodes?: Record<string, number>;

  // ✅ agora aceita points (para RDG/SCP/ZPF/DPI)
  onMarkCode: (rowId: number, code: string | null, points?: number | null) => void;
}

// --- Sets fixos do sistema ---
const AUTO_N_PLUS_ONE_DISCARDABLE = ['DNC', 'DNF', 'DNS', 'OCS', 'UFD', 'BFD', 'DSQ', 'RET', 'NSC'] as const;
const AUTO_N_PLUS_ONE_NON_DISCARDABLE = ['DNE', 'DGM'] as const;
const ADJUSTABLE_CODES = ['RDG', 'SCP', 'ZPF', 'DPI'] as const;

const isAdjustable = (c: string | null | undefined) => !!c && (ADJUSTABLE_CODES as readonly string[]).includes(c);
const removesFromRanking = (c: string | null | undefined) => !!c && c !== 'RDG';

export default function ExistingResultsTable({
  results,
  loading,
  onMove,
  onEditPos,
  onSaveOrder,
  onDelete,
  scoringCodes,
  onMarkCode,
}: Props) {
  const safeResults = Array.isArray(results) ? results : [];
  const customMap = scoringCodes ?? {};

  const sorted = useMemo(
    () => safeResults.slice().sort((a, b) => a.position - b.position),
    [safeResults]
  );

  // options: auto + adjustable + custom (sem duplicados)
  const codeGroups = useMemo(() => {
    const custom = Object.keys(customMap)
      .map((x) => x.toUpperCase())
      .filter(
        (c) =>
          !(AUTO_N_PLUS_ONE_DISCARDABLE as readonly string[]).includes(c) &&
          !(AUTO_N_PLUS_ONE_NON_DISCARDABLE as readonly string[]).includes(c) &&
          !(ADJUSTABLE_CODES as readonly string[]).includes(c)
      )
      .sort();

    return {
      autoDiscardable: [...AUTO_N_PLUS_ONE_DISCARDABLE],
      autoNonDiscardable: [...AUTO_N_PLUS_ONE_NON_DISCARDABLE],
      adjustable: [...ADJUSTABLE_CODES],
      custom,
    };
  }, [customMap]);

  // estado local para “mini input” dos ajustáveis
  const [pendingCode, setPendingCode] = useState<Record<number, string>>({});
  const [pendingPoints, setPendingPoints] = useState<Record<number, string>>({});

  const clearPending = (rowId: number) => {
    setPendingCode((prev) => {
      const n = { ...prev };
      delete n[rowId];
      return n;
    });
    setPendingPoints((prev) => {
      const n = { ...prev };
      delete n[rowId];
      return n;
    });
  };

  const formatCodeWithValue = (row: ApiResult) => {
    const c = (row.code || '').toUpperCase();
    if (!c) return '';
    // pedido: “código seguido do valor”
    // ex: DNC 31 / RDG 4.5
    const pts = row.points;
    const ptsStr = Number.isFinite(Number(pts)) ? String(pts) : '';
    return ptsStr ? `${c} ${ptsStr}` : c;
  };

  if (loading) return <p className="p-4 text-gray-500">A carregar…</p>;
  if (sorted.length === 0) return <p className="p-4 text-gray-500">Sem resultados guardados para esta corrida.</p>;

  return (
    <>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            <th className="border px-2 py-2 text-left">Vela</th>
            <th className="border px-2 py-2 text-left">Timoneiro</th>
            <th className="border px-2 py-2 text-center">Posição</th>
            <th className="border px-2 py-2 text-left">Código</th>
            <th className="border px-2 py-2 text-right">Ações</th>
          </tr>
        </thead>

        <tbody>
          {sorted.map((row, idx) => {
            const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            const codeUpper = row.code ? row.code.toUpperCase() : null;

            const showAdjustBox = !!pendingCode[row.id] && isAdjustable(pendingCode[row.id]);
            const posDisabled = removesFromRanking(codeUpper); // ✅ só bloqueia se code != RDG

            return (
              <tr key={row.id} className={rowBg}>
                <td className="border px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span>{row.sail_number}</span>
                    {row.code ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700"
                        title="Código + valor"
                      >
                        {formatCodeWithValue(row)}
                      </span>
                    ) : null}
                  </div>
                </td>

                <td className="border px-2 py-2">{row.skipper_name}</td>

                <td className="border px-2 py-2 text-center">
                  <input
                    type="number"
                    min={1}
                    className="w-24 border rounded px-2 py-1 text-center"
                    defaultValue={row.position}
                    disabled={loading || posDisabled}
                    onBlur={(e) => {
                      const v = Math.max(1, Number(e.target.value) || 1);
                      onEditPos(row.id, v);
                    }}
                  />
                </td>

                <td className="border px-2 py-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <select
                        className="border rounded px-2 py-1"
                        value={row.code ?? ''}
                        disabled={loading}
                        onChange={(ev) => {
                          const raw = (ev.target.value || '').trim();
                          const next = raw ? raw.toUpperCase() : null;

                          // limpar pending anterior
                          clearPending(row.id);

                          if (!next) {
                            onMarkCode(row.id, null, null);
                            return;
                          }

                          if (isAdjustable(next)) {
                            // abre mini input, não envia ainda
                            setPendingCode((p) => ({ ...p, [row.id]: next }));
                            // valor inicial: points atual (se houver), senão vazio
                            setPendingPoints((p) => ({ ...p, [row.id]: row.points != null ? String(row.points) : '' }));
                            return;
                          }

                          // auto N+1 ou custom fixo: só enviar code
                          onMarkCode(row.id, next, null);
                        }}
                        aria-label="Código de pontuação"
                      >
                        <option value="">(nenhum)</option>

                        <optgroup label="Auto (N+1) — discardable">
                          {codeGroups.autoDiscardable.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>

                        <optgroup label="Auto (N+1) — NÃO discardable">
                          {codeGroups.autoNonDiscardable.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>

                        <optgroup label="Ajustável (pede valor)">
                          {codeGroups.adjustable.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>

                        {codeGroups.custom.length > 0 && (
                          <optgroup label="Custom (fixos)">
                            {codeGroups.custom.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>

                      {row.code ? (
                        <span className="text-xs text-gray-500">
                          pontos: <b>{row.points}</b>
                        </span>
                      ) : null}
                    </div>

                    {/* Mini input para RDG/SCP/ZPF/DPI */}
                    {showAdjustBox && (
                      <div className="flex items-center gap-2 bg-gray-50 border rounded p-2">
                        <span className="text-xs text-gray-600 w-20">
                          {pendingCode[row.id]}
                        </span>

                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          className="border rounded px-2 py-1 w-32"
                          value={pendingPoints[row.id] ?? ''}
                          placeholder="ex: 4.5"
                          onChange={(e) => setPendingPoints((p) => ({ ...p, [row.id]: e.target.value }))}
                        />

                        <button
                          type="button"
                          className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                          onClick={() => {
                            const code = pendingCode[row.id];
                            const rawPts = (pendingPoints[row.id] ?? '').trim();

                            const pts = Number(rawPts);
                            if (!Number.isFinite(pts)) {
                              alert('Valor inválido (pontos).');
                              return;
                            }

                            onMarkCode(row.id, code, pts);
                            clearPending(row.id);
                          }}
                        >
                          Aplicar
                        </button>

                        <button
                          type="button"
                          className="ml-auto px-2 py-1 rounded border text-xs hover:bg-gray-100"
                          onClick={() => clearPending(row.id)}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </td>

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
                        if (confirm('Eliminar este resultado? As posições seguintes serão ajustadas.')) onDelete(row.id);
                      }}
                      className="px-2 py-1 rounded border hover:bg-red-50 text-red-600 disabled:opacity-50"
                      title="Eliminar"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
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
