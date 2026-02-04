'use client';

import { useMemo, useState } from 'react';
import type { Entry, DraftResult } from '../types';

interface Props {
  draft: DraftResult[];
  entries: Entry[];
  available: Entry[];
  draftInput: string;
  setDraftInput: (v: string) => void;
  onAddBySail: () => void;
  onAddEntry: (entryId: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (entryId: number) => void;
  onSaveBulk: () => void;

  scoringCodes: Record<string, number>;
  onSetDraftCode: (entryId: number, code: string | null) => void;
  onSetDraftPos: (entryId: number, pos: number) => void;
}

// sets fixos para dropdown (front)
const AUTO_N_PLUS_ONE_CODES = ['DNC', 'DNF', 'DNS', 'OCS', 'UFD', 'BFD', 'DSQ', 'RET', 'NSC', 'DNE', 'DGM'] as const;
const ADJUSTABLE_CODES = ['RDG', 'SCP', 'ZPF', 'DPI'] as const;

const removesFromRanking = (code?: string | null) => !!code && code.toUpperCase() !== 'RDG';

export default function DraftResultsEditor({
  draft,
  entries,
  available,
  draftInput,
  setDraftInput,
  onAddBySail,
  onAddEntry,
  onMove,
  onRemove,
  onSaveBulk,
  scoringCodes,
  onSetDraftCode,
  onSetDraftPos,
}: Props) {
  const [filter, setFilter] = useState('');

  const entriesById = useMemo(() => {
    const m = new Map<number, Entry>();
    for (const e of entries) m.set(e.id, e);
    return m;
  }, [entries]);

  const filteredAvailable = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return available;
    return available.filter(
      (e) =>
        (e.sail_number || '').toLowerCase().includes(f) ||
        (e.first_name + ' ' + e.last_name).toLowerCase().includes(f) ||
        (e.club || '').toLowerCase().includes(f)
    );
  }, [available, filter]);

  const codeOptions = useMemo(() => {
    const custom = Object.keys(scoringCodes || {}).map((c) => c.toUpperCase()).sort();
    const all = new Set<string>();

    for (const c of AUTO_N_PLUS_ONE_CODES) all.add(c);
    for (const c of ADJUSTABLE_CODES) all.add(c);
    for (const c of custom) all.add(c);

    return Array.from(all);
  }, [scoringCodes]);

  const autoNPlusOneValue = useMemo(() => {
    // draft trabalha com "available" (que já vem filtrado por fleet se aplicável no teu hook)
    return (available?.length ?? 0) + 1;
  }, [available]);

  const computedPoints = (pos: number, code?: string | null) => {
    const c = (code || '').toUpperCase();
    if (!c) return pos;

    if ((AUTO_N_PLUS_ONE_CODES as readonly string[]).includes(c)) {
      // preview simples (o backend recalcula sempre corretamente)
      return autoNPlusOneValue;
    }

    if ((ADJUSTABLE_CODES as readonly string[]).includes(c)) {
      // no draft não pedimos points ainda (mantemos simples)
      return 'manual';
    }

    if (c in scoringCodes) return scoringCodes[c];
    return pos;
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-2 text-sm">Adicionar por nº de vela (rascunho):</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={draftInput}
            onChange={(e) => setDraftInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddBySail()}
            className="border rounded px-3 py-2 w-full"
            placeholder="Ex: POR123"
            aria-label="Número de vela para adicionar ao rascunho"
          />
          <button onClick={onAddBySail} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            ➕ Adicionar
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Inscritos disponíveis ({filteredAvailable.length})</h4>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Procurar por vela / nome / clube"
            className="border rounded px-3 py-1.5 text-sm w-64"
            aria-label="Pesquisar inscritos disponíveis"
          />
        </div>

        {filteredAvailable.length === 0 ? (
          <p className="text-xs text-gray-500">Sem inscritos a corresponder ao filtro.</p>
        ) : (
          <ul className="space-y-1 max-h-64 overflow-auto pr-1">
            {filteredAvailable.map((entry) => (
              <li
                key={entry.id}
                className="flex justify-between items-center p-2 border rounded bg-white hover:bg-gray-50"
              >
                <span className="truncate">
                  <span className="font-medium">{entry.sail_number}</span>
                  {' — '}
                  {entry.first_name} {entry.last_name}
                  {entry.club ? <span className="text-gray-500"> ({entry.club})</span> : null}
                </span>
                <button onClick={() => onAddEntry(entry.id)} className="text-sm text-green-700 hover:underline">
                  Adicionar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Rascunho ({draft.length})</h4>

        {draft.length === 0 ? (
          <p className="text-xs text-gray-500">Ainda não adicionaste embarcações ao rascunho.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {draft.map((r, i) => {
                const e = entriesById.get(r.entryId);
                const pts = computedPoints(r.position, r.code);

                return (
                  <li key={r.entryId} className="flex items-center justify-between border p-2 rounded bg-white gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="inline-block w-10 text-right mr-2 font-semibold">{r.position}º</span>
                      <span className="font-medium">{e?.sail_number}</span>
                      <span className="text-gray-600">
                        {' '}
                        — {e?.first_name} {e?.last_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Pos</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className="w-20 border rounded px-2 py-1 text-center"
                        value={r.position}
                        onChange={(ev) => onSetDraftPos(r.entryId, Math.max(1, Number(ev.target.value) || 1))}
                        onBlur={(ev) => onSetDraftPos(r.entryId, Math.max(1, Number(ev.target.value) || 1))}
                        disabled={removesFromRanking(r.code)} // ✅ só bloqueia se code != RDG
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Código</label>
                      <select
                        className="border rounded px-2 py-1"
                        value={r.code ?? ''}
                        onChange={(ev) => onSetDraftCode(r.entryId, ev.target.value || null)}
                      >
                        <option value="">(nenhum)</option>
                        {codeOptions.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-20 text-right text-sm">
                      <span className="px-2 py-1 rounded bg-gray-100 inline-block">{String(pts)}</span>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => onMove(i, -1)} className="px-2 py-1 rounded border hover:bg-gray-50" title="Subir">
                        ↑
                      </button>
                      <button onClick={() => onMove(i, +1)} className="px-2 py-1 rounded border hover:bg-gray-50" title="Descer">
                        ↓
                      </button>
                      <button
                        onClick={() => onRemove(r.entryId)}
                        className="px-2 py-1 rounded border hover:bg-gray-50 text-red-600"
                        title="Remover"
                      >
                        Remover
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="pt-2 text-right">
              <button onClick={onSaveBulk} className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800">
                💾 Guardar Resultados (em massa)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
