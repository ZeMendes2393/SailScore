"use client";

import { Notice } from "@/types/notice";
import { apiDelete, apiDownloadFile } from "@/lib/api";
import notify from "@/lib/notify";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";

type Props = { items: Notice[]; timezone?: string | null; onChanged: () => void };

function formatDate(iso: string | undefined, timezone?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  if (timezone) {
    try {
      return new Intl.DateTimeFormat('pt-PT', {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  }
  return d.toLocaleString();
}

export default function AdminNoticeTable({ items, timezone, onChanged }: Props) {
  const confirm = useConfirm();
  const { token } = useAuth();
  const del = async (id: number) => {
    const ok = await confirm({
      title: "Delete this document?",
      description: "The document will be permanently removed from the notice board.",
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await apiDelete(`/notices/${id}`);
      notify.success("Document deleted.");
      onChanged();
    } catch (e) {
      console.error(e);
      notify.error("Failed to delete document.");
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="p-3 font-medium text-gray-700">Title</th>
            <th className="p-3 font-medium text-gray-700">Published</th>
            <th className="p-3 text-right font-medium text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((n) => (
            <tr key={n.id} className="border-t hover:bg-gray-50 transition-colors">
              <td className="p-3">{n.title}</td>
              <td className="p-3 whitespace-nowrap text-sm text-gray-700">
                {formatDate(n.published_at, timezone)}
              </td>
              <td className="p-3 text-right">
                <div className="inline-flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await apiDownloadFile(
                          `/notices/${n.id}/download`,
                          n.filename || `${n.title || 'document'}.pdf`,
                          token ?? undefined
                        );
                      } catch (e: any) {
                        notify.error(e?.message || 'Failed to download document.');
                      }
                    }}
                    className="inline-flex items-center rounded-md border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => del(n.id)}
                    className="inline-flex items-center rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td className="p-6 text-center text-gray-500" colSpan={3}>
                No documents yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
