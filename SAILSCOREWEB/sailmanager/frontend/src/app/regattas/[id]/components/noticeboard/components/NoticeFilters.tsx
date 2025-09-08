"use client";
import { NoticeDocType } from "@/types/notice";

interface Props {
  classes: string[];
  onClassChange: (cls: string | null) => void;
  onDocTypeChange: (t: NoticeDocType | null) => void;
  onImportantChange: (v: boolean | null) => void;
  onOnlyAllChange: (v: boolean | null) => void;
  onQueryChange: (q: string) => void;
}

export default function NoticeFilters({
  classes, onClassChange, onDocTypeChange, onImportantChange, onOnlyAllChange, onQueryChange
}: Props) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between bg-white border rounded-lg p-3">
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600">Classe</label>
          <select onChange={e => onClassChange(e.target.value || null)} className="border rounded p-2 bg-white">
            <option value="">Todas</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Tipo</label>
          <select onChange={e => onDocTypeChange((e.target.value || null) as any)} className="border rounded p-2 bg-white">
            <option value="">Todos</option>
            <option value="RACE_DOCUMENT">Race Documents</option>
            <option value="RULE_42">Rule 42</option>
            <option value="JURY_DOC">Jury</option>
            <option value="TECHNICAL">Technical</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Importante</label>
          <select onChange={e => onImportantChange(e.target.value === "" ? null : e.target.value === "true")} className="border rounded p-2 bg-white">
            <option value="">Ambos</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">All Classes</label>
          <select onChange={e => onOnlyAllChange(e.target.value === "" ? null : e.target.value === "true")} className="border rounded p-2 bg-white">
            <option value="">Ambos</option>
            <option value="true">Só ALL</option>
            <option value="false">Inclui específicas</option>
          </select>
        </div>
      </div>

      <div>
        <input
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Pesquisar por título…"
          className="border rounded p-2 w-64"
        />
      </div>
    </div>
  );
}
