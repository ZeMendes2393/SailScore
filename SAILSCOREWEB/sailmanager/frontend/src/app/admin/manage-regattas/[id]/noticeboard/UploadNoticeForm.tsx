"use client";

import { useEffect, useMemo, useState } from "react";
import { NoticeSource } from "@/types/notice";
import { BASE_URL as API_BASE } from "@/lib/api";

interface UploadNoticeFormProps {
  regattaId: number;
  onUploadSuccess: () => void;
}

export default function UploadNoticeForm({ regattaId, onUploadSuccess }: UploadNoticeFormProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<NoticeSource>("OTHER");

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      setError(null);
      try {
        // keep for potential future use; currently documents always apply to all classes
        const res = await fetch(`${API_BASE}/regattas/${regattaId}`);
        if (!res.ok) throw new Error("Failed to load regatta.");
        await res.json();
      } catch (e: any) {
        setError(e?.message || "Failed to load regatta.");
      }
    };
    if (regattaId) fetchClasses();
  }, [API_BASE, regattaId]);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !file) return false;
    return true;
  }, [title, file]);

  const handleFiles = (f: File | null) => {
    if (!f) return setFile(null);
    if (f.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
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
      fd.append("applies_to_all", String(true));
      fd.append("file", file);

      const res = await fetch(`${API_BASE}/notices/upload/`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Failed to upload document.");
      }

      // reset
      setTitle("");
      setFile(null);
      setSource("OTHER");
      setSuccess("Document uploaded successfully.");
      onUploadSuccess?.();
    } catch (e: any) {
      setError(e?.message || "An unexpected error occurred.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-4 border-b pb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Add document</h3>
          <p className="mt-1 text-xs text-gray-500">
            Upload a PDF to the notice board and choose which classes it applies to.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Title *</span>
          <input
            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Category / Source</span>
          <select
            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

      {/* Documents are always applied to all classes for now, so class selection was removed */}

      <label className="block">
        <span className="text-sm font-medium">PDF file *</span>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm cursor-pointer hover:bg-blue-700">
            <span>Choose file</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files?.[0] || null)}
            />
          </label>
          {file && (
            <span className="truncate text-sm text-gray-700">
              {file.name}{" "}
              <span className="text-gray-400">(PDF)</span>
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          PDF only. Recommended size &lt; 10MB.
        </p>
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

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="submit"
          disabled={!canSubmit || uploading}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload"}
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
          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
