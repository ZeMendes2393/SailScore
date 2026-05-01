"use client";

import { Notice } from "@/types/notice";
import { getApiBaseUrl } from "@/lib/api";

interface Props {
  items: Notice[];
}

export default function NoticeTable({ items }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="p-3">Date</th>
            <th className="p-3">Time</th>
            <th className="p-3">Title</th>
            <th className="p-3">Category</th>
            <th className="p-3 text-right">Download</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="p-6 text-center text-gray-500">
                No documents.
              </td>
            </tr>
          )}
          {items.map((n) => {
            const d = new Date(n.published_at);
            const date = d.toLocaleDateString("en-GB");
            const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

            return (
              <tr key={n.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{date}</td>
                <td className="p-3">{time}</td>
                <td className="p-3">
                  <span className="font-medium">{n.title}</span>
                </td>
                <td className="p-3">{n.source.replaceAll("_", " ")}</td>
                <td className="p-3 text-right">
                  <a
                    href={`${getApiBaseUrl()}/notices/${n.id}/download`}
                    className="text-blue-600 hover:underline"
                  >
                    Download
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
