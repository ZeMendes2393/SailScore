"use client";

import { useEffect, useState } from "react";
import UploadNoticeForm from "../UploadNoticeForm";
import AdminNoticeTable from "../AdminNoticeTable";
import { useNotices } from "@/lib/hooks/useNotices";

export default function Documents({ regattaId }: { regattaId: number }) {
  const { data, loading, error, refresh } = useNotices(regattaId);
  const [justUploaded, setJustUploaded] = useState(false);

  useEffect(() => {
    if (justUploaded) { refresh(); setJustUploaded(false); }
  }, [justUploaded, refresh]);

  return (
    <div className="space-y-6">
      <UploadNoticeForm regattaId={regattaId} onUploadSuccess={() => setJustUploaded(true)} />
      {loading && <div className="text-gray-500">A carregar…</div>}
      {error && <div className="text-red-600">{String(error)}</div>}
      <AdminNoticeTable items={data} onChanged={refresh} />
    </div>
  );
}
