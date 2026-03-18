"use client";

import { Notice } from "@/types/notice";
import { BASE_URL as API_BASE, apiDelete } from "@/lib/api";

type Props = { items: Notice[]; timezone?: string | null; onChanged: () => void };

function formatDate(iso: string | undefined, timezone?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  if (timezone) {
    try {
      return new Intl.DateTimeFormat(undefined, {
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
  const del = async (id: number) => {
    if (!confirm("Delete this document?")) return;
    try {
      await apiDelete(`/notices/${id}`);
      onChanged();
    } catch (e) {
      console.error(e);
      alert("Failed to delete document.");
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="p-3">Title</th>
            <th className="p-3">Published</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((n) => (
            <tr key={n.id} className="border-t">
              <td className="p-3">{n.title}</td>
              <td className="p-3 whitespace-nowrap text-sm text-gray-700">
                {formatDate(n.published_at, timezone)}
              </td>
              <td className="p-3 text-right">
                <div className="inline-flex gap-3">
                  <a
                    href={`${API_BASE}/notices/${n.id}/download`}
                    className="text-blue-600 hover:underline"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => del(n.id)}
                    className="text-red-600 hover:underline"
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
