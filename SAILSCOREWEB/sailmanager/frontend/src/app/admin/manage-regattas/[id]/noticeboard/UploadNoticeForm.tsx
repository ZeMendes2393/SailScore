"use client";

import { useState } from "react";

interface UploadNoticeFormProps {
  regattaId: number;
  onUploadSuccess: () => void;
}

export default function UploadNoticeForm({ regattaId, onUploadSuccess }: UploadNoticeFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("regatta_id", regattaId.toString());
    formData.append("title", title);

    setUploading(true);
    try {
      const res = await fetch("http://localhost:8000/notices/upload/", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setFile(null);
        setTitle("");
        onUploadSuccess();
      } else {
        console.error("Falha ao enviar ficheiro");
      }
    } catch (err) {
      console.error("Erro ao fazer upload:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Título</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full border rounded p-2"
          placeholder="Título do documento"
          required
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Carregar PDF</span>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mt-2 block w-full"
        />
      </label>

      <button
        type="submit"
        disabled={!file || uploading || !title.trim()}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {uploading ? "A carregar..." : "Upload"}
      </button>
    </form>
  );
}
