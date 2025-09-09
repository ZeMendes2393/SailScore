"use client";

import { useEffect, useMemo, useState } from "react";
import { RegattaClass, NoticeSource } from "@/types/notice";
import { BASE_URL as API_BASE } from "@/lib/api";

interface UploadNoticeFormProps {
  regattaId: number;
  onUploadSuccess: () => void;
}

export default function UploadNoticeForm({ regattaId, onUploadSuccess }: UploadNoticeFormProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<NoticeSource>("OTHER");
  const [appliesToAll, setAppliesToAll] = useState(true);

  const [availableClasses, setAvailableClasses] = useState<RegattaClass[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      setLoadingClasses(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/regattas/${regattaId}/classes`);
        if (!res.ok) throw new Error("Falha ao obter classes da regata.");
        const data = (await res.json()) as RegattaClass[];
        setAvailableClasses(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setAvailableClasses([]);
        setError(e?.message || "Erro ao carregar classes.");
      } finally {
        setLoadingClasses(false);
      }
    };
    if (regattaId) fetchClasses();
  }, [API_BASE, regattaId]);

  useEffect(() => {
    if (appliesToAll) setSelectedClasses([]);
  }, [appliesToAll]);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !file) return false;
    if (!appliesToAll && selectedClasses.length === 0) return false;
    return true;
  }, [title, file, appliesToAll, selectedClasses.length]);

  const toggleClass = (cls: string) => {
    setSelectedClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const handleFiles = (f: File | null) => {
    if (!f) return setFile(null);
    if (f.type !== "application/pdf") {
      setError("Apenas PDFs são permitidos.");
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.append("regatta_id", String(regattaId));
      fd.append("title", title.trim());
      fd.append("source", source);
      fd.append("applies_to_all", String(appliesToAll));
      if (!appliesToAll) selectedClasses.forEach((c) => fd.append("classes", c));
      fd.append("file", file);

      const res = await fetch(`${API_BASE}/notices/upload/`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Falha no upload do documento.");
      }

      // reset
      setTitle("");
      setFile(null);
      setSource("OTHER");
      setAppliesToAll(true);
      setSelectedClasses([]);
      setSuccess("Documento carregado com sucesso.");
      onUploadSuccess?.();
    } catch (e: any) {
      setError(e?.message || "Ocorreu um erro inesperado.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 rounded-lg border bg-white">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Título *</span>
          <input
            className="mt-1 block w-full rounded border p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Categoria / Fonte</span>
          <select
            className="mt-1 block w-full rounded border p-2 bg-white"
            value={source}
            onChange={(e) => setSource(e.target.value as NoticeSource)}
          >
            <option value="ORGANIZING_AUTHORITY">Organizing Authority</option>
            <option value="RACE_COMMITTEE">Race Committee</option>
            <option value="JURY">Jury</option>
            <option value="TECHNICAL_COMMITTEE">Technical Committee</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={appliesToAll}
            onChange={(e) => setAppliesToAll(e.target.checked)}
          />
          <span className="text-sm">Aplicável a todas as classes</span>
        </label>

        {!appliesToAll && (
          <div>
            <div className="text-sm font-medium mb-1">Classes aplicáveis *</div>
            <div className="max-h-40 overflow-auto rounded border p-2">
              {loadingClasses ? (
                <div className="text-sm text-gray-500">A carregar classes…</div>
              ) : availableClasses.length === 0 ? (
                <div className="text-sm text-gray-500">Sem classes disponíveis.</div>
              ) : (
                <ul className="space-y-1">
                  {availableClasses.map((c) => (
                    <li key={c.id}>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selectedClasses.includes(c.class_name)}
                          onChange={() => toggleClass(c.class_name)}
                        />
                        <span className="text-sm">{c.class_name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input de ficheiro mais visível */}
      <label className="block">
        <span className="text-sm font-medium">Ficheiro PDF *</span>
        <div className="mt-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white cursor-pointer hover:bg-blue-700">
            <span>Escolher ficheiro</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files?.[0] || null)}
            />
          </label>
          {file && <span className="ml-3 text-sm text-gray-600">{file.name}</span>}
        </div>
        <p className="mt-1 text-xs text-gray-500">Apenas PDFs. Tamanho recomendado &lt; 10MB.</p>
      </label>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit || uploading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? "A carregar…" : "Upload"}
        </button>
        <button
          type="button"
          onClick={() => {
            setTitle("");
            setFile(null);
            setSource("OTHER");
            setAppliesToAll(true);
            setSelectedClasses([]);
            setError(null);
            setSuccess(null);
          }}
          className="px-4 py-2 rounded border"
        >
          Limpar
        </button>
      </div>
    </form>
  );
}
