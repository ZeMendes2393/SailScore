"use client";
import { useEffect, useState } from "react";
import UploadNoticeForm from "./UploadNoticeForm";
import AdminNoticeTable from "./AdminNoticeTable";
import { useNotices } from "@/lib/hooks/useNotices";

export default function AdminNoticeBoard({ regattaId }: { regattaId: number }) {
  const { data, loading, error, refresh } = useNotices(regattaId);
  const [justUploaded, setJustUploaded] = useState(false);

  useEffect(() => {
    if (justUploaded) { refresh(); setJustUploaded(false); }
  }, [justUploaded, refresh]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Notice Board — Admin</h2>
      <UploadNoticeForm regattaId={regattaId} onUploadSuccess={() => setJustUploaded(true)} />
      {loading && <div className="text-gray-500">A carregar…</div>}
      {error && <div className="text-red-600">{error}</div>}
      <AdminNoticeTable items={data} onChanged={refresh} />
    </div>
  );
}
