"use client";

import { useMemo } from "react";

type Props = {
  classes: string[];
  onClassChange: (cls: string | null) => void;
  onOnlyAllChange: (v: boolean | null) => void;
  onQueryChange: (q: string) => void;
};

export default function NoticeFilters({
  classes,
  onClassChange,
  onOnlyAllChange,
  onQueryChange,
}: Props) {
  const classOptions = useMemo(() => {
    const out: { label: string; value: string; key: string }[] = [];
    const seen = new Set<string>();

    for (const raw of classes ?? []) {
      if (!raw) continue;
      const label = String(raw).trim();
      if (!label) continue;

      // normaliza para deduplicação/keys estáveis
      const norm = label
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (seen.has(norm)) continue;
      seen.add(norm);

      out.push({
        label,             // mostra original
        value: label,      // value com original
        key: `cls-${norm}` // key estável e única
      });
    }

    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [classes]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between bg-white border rounded-lg p-3">
      <div className="flex flex-wrap gap-3">
        {/* Classe */}
        <div>
          <label className="block text-xs font-medium text-gray-600">Classe</label>
          <select
            onChange={(e) => onClassChange(e.target.value || null)}
            className="border rounded p-2 bg-white"
            defaultValue=""
          >
            <option value="">Todas</option>
            {classOptions.map((opt) => (
              <option key={opt.key} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Só “All Classes” */}
        <div>
          <label className="block text-xs font-medium text-gray-600">All Classes</label>
          <select
            onChange={(e) =>
              onOnlyAllChange(e.target.value === "" ? null : e.target.value === "true")
            }
            className="border rounded p-2 bg-white"
            defaultValue=""
          >
            <option value="">Ambos</option>
            <option value="true">Só ALL</option>
            <option value="false">Inclui específicas</option>
          </select>
        </div>
      </div>

      {/* Pesquisa por título */}
      <div>
        <input
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Pesquisar por título…"
          className="border rounded p-2 w-64"
          type="search"
        />
      </div>
    </div>
  );
}
