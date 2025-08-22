'use client';

import { useState } from 'react';
import type { ScoringConfig } from '../types';

interface Props {
  scoring: ScoringConfig;
  onChange: (cfg: ScoringConfig) => void;
  onSave: () => void;
  saving: boolean;
}

export default function ScoringPanel({ scoring, onChange, onSave, saving }: Props) {
  const codes = scoring.code_points ?? {};

  const [newCode, setNewCode] = useState('');
  const [newPoints, setNewPoints] = useState<number | ''>('');

  const updateNumber = (field: 'discard_count' | 'discard_threshold', v: number | '') => {
    onChange({
      ...scoring,
      [field]: typeof v === 'string' ? 0 : v,
    });
  };

  const addCode = () => {
    const k = newCode.trim().toUpperCase();
    const p = Number(newPoints);
    if (!k) return alert('Indica o código (ex.: DNF)');
    if (Number.isNaN(p)) return alert('Indica os pontos para esse código');
    if (codes[k] !== undefined) return alert('Esse código já existe');

    onChange({
      ...scoring,
      code_points: { ...(codes || {}), [k]: p },
    });
    setNewCode('');
    setNewPoints('');
  };

  const setCodePoints = (k: string, v: number) => {
    onChange({
      ...scoring,
      code_points: { ...(codes || {}), [k]: v },
    });
  };

  const removeCode = (k: string) => {
    const clone = { ...(codes || {}) };
    delete clone[k];
    onChange({
      ...scoring,
      code_points: clone,
    });
  };

  return (
    <div className="space-y-6">
      {/* Descartes */}
      <div className="p-3 border rounded bg-white">
        <h4 className="text-md font-semibold mb-2">Descartes</h4>
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm text-gray-700">Nº de descartes</label>
            <input
              type="number"
              min={0}
              value={scoring.discard_count}
              onChange={(e) => updateNumber('discard_count', e.target.value === '' ? '' : Number(e.target.value))}
              className="border rounded px-3 py-2 w-32"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Ativar após (nº regatas)</label>
            <input
              type="number"
              min={0}
              value={scoring.discard_threshold}
              onChange={(e) => updateNumber('discard_threshold', e.target.value === '' ? '' : Number(e.target.value))}
              className="border rounded px-3 py-2 w-40"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          O cálculo do <strong>Net</strong> na classificação geral usa estes valores.
        </p>
      </div>

      {/* Pontuação por Código (DNF/DNC/DSQ/OCS/RET/etc.) */}
      <div className="p-3 border rounded bg-white">
        <h4 className="text-md font-semibold mb-2">Pontuação por Código</h4>

        {/* Lista de códigos existentes */}
        <table className="w-full text-sm border border-collapse mb-3">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">Código</th>
              <th className="border px-2 py-1 text-left">Pontos</th>
              <th className="border px-2 py-1 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(codes).length === 0 && (
              <tr>
                <td colSpan={3} className="border px-2 py-2 text-gray-500">
                  Sem códigos definidos. Adiciona, por exemplo: DNF, DNC, DSQ…
                </td>
              </tr>
            )}
            {Object.entries(codes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => (
                <tr key={k}>
                  <td className="border px-2 py-1 font-mono">{k}</td>
                  <td className="border px-2 py-1">
                    <input
                      type="number"
                      step="0.5"
                      className="w-28 border rounded px-2 py-1"
                      value={v}
                      onChange={(e) => setCodePoints(k, Number(e.target.value))}
                    />
                  </td>
                  <td className="border px-2 py-1 text-right">
                    <button
                      onClick={() => removeCode(k)}
                      className="px-2 py-1 rounded border hover:bg-red-50 text-red-600"
                      title="Remover"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Adicionar novo código */}
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-sm text-gray-700">Código</label>
            <input
              type="text"
              placeholder="ex.: DNF"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="border rounded px-3 py-2 w-40 uppercase"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700">Pontos</label>
            <input
              type="number"
              step="0.5"
              placeholder="ex.: 10"
              value={newPoints}
              onChange={(e) => setNewPoints(e.target.value === '' ? '' : Number(e.target.value))}
              className="border rounded px-3 py-2 w-32"
            />
          </div>
          <button
            onClick={addCode}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Adicionar código
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Estes códigos (DNF/DNC/DSQ/OCS/RET, etc.) sobrepõem a pontuação normal. Ao reordenar/editar posições,
          a marcação de código é removida automaticamente.
        </p>
      </div>

      {/* Guardar */}
      <div className="text-right">
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
