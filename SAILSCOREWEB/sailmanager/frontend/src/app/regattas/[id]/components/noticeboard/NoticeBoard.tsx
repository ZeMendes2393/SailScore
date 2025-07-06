"use client";

import { useEffect, useState } from "react";
import UploadNoticeForm from "../../../../admin/manage-regattas/[id]/noticeboard/UploadNoticeForm";

interface Notice {
  id: number;
  filename: string;
  filepath: string;
  uploaded_at: string;
  title: string;
}

interface NoticeBoardProps {
  regattaId: number;
  admin?: boolean;
}

export default function NoticeBoard({ regattaId, admin = false }: NoticeBoardProps) {
  const [notices, setNotices] = useState<Notice[]>([]);

  const fetchNotices = async () => {
    try {
      const res = await fetch(`http://localhost:8000/notices/${regattaId}`);
      const data = await res.json();
      if (Array.isArray(data)) setNotices(data);
      else setNotices([]);
    } catch (err) {
      console.error("Erro ao buscar notices:", err);
      setNotices([]);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmDelete = confirm("Tens a certeza que queres apagar este documento?");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://localhost:8000/notices/${id}`, {
        method: "DELETE",
      });
      if (res.status === 204) {
        fetchNotices(); // atualizar lista
      } else {
        console.error("Erro ao apagar o documento.");
      }
    } catch (err) {
      console.error("Erro ao fazer o delete:", err);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [regattaId]);

  return (
    <div className="overflow-x-auto">
      <h2 className="text-xl font-semibold mb-4">Notice Board</h2>

      {admin && (
        <div className="mb-6">
          <UploadNoticeForm regattaId={regattaId} onUploadSuccess={fetchNotices} />
        </div>
      )}

      {notices.length === 0 ? (
        <p className="text-gray-500">Nenhum documento disponível.</p>
      ) : (
        <table className="min-w-full text-sm border border-gray-200">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3 border-b">📄</th>
              <th className="p-3 border-b">Título</th>
              <th className="p-3 border-b">Data</th>
              <th className="p-3 border-b text-right" colSpan={admin ? 2 : 1}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {notices.map((notice) => (
              <tr key={notice.id} className="hover:bg-gray-50">
                <td className="p-3">PDF</td>
                <td className="p-3 font-medium">{notice.title}</td>
                <td className="p-3 text-gray-600">
                  {new Date(notice.uploaded_at).toLocaleString("pt-PT", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="p-3 text-right">
                  <a
                    href={`http://localhost:8000${notice.filepath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Download
                  </a>
                </td>

                {admin && (
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleDelete(notice.id)}
                      className="text-red-600 hover:underline font-medium"
                    >
                      Apagar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
