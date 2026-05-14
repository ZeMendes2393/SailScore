"use client";

import { useEffect, useState } from "react";
import UploadNoticeForm from "../UploadNoticeForm";
import AdminNoticeTable from "../AdminNoticeTable";
import { useNotices } from "@/lib/hooks/useNotices";
import { apiGet } from "@/lib/api";

export default function Documents({ regattaId }: { regattaId: number }) {
  const { data, loading, error, refresh } = useNotices(regattaId);
  const [justUploaded, setJustUploaded] = useState(false);
  const [timezone, setTimezone] = useState<string | null>(null);

  // fetch regatta timezone so we can show notice dates in local regatta time
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const regatta: any = await apiGet(`/regattas/${regattaId}`);
        if (!alive) return;
        const tz = (regatta?.timezone || "").trim();
        setTimezone(tz || null);
      } catch {
        if (!alive) return;
        setTimezone(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [regattaId]);

  useEffect(() => {
    if (justUploaded) { refresh(); setJustUploaded(false); }
  }, [justUploaded, refresh]);

  return (
    <div className="space-y-6">
      <UploadNoticeForm regattaId={regattaId} onUploadSuccess={() => setJustUploaded(true)} />
      {loading && <div className="text-gray-500">Loading…</div>}
      {error && <div className="text-red-600">{String(error)}</div>}
      <AdminNoticeTable items={data} timezone={timezone} onChanged={refresh} />
    </div>
  );
}
