"use client";
import { useEffect, useMemo, useState } from "react";
import { useNotices } from "@/lib/hooks/useNotices";
import NoticeFilters from "./NoticeFilters";
import NoticeTable from "./NoticeTable";
import PdfModal from "./PdfModal";
import { api } from "@/lib/api";
import { RegattaClass, Notice } from "@/types/notice";

export default function NoticeBoardPublic({ regattaId }: { regattaId: number }) {
  const { data, loading, error, setClassName, setDocType, setImportant, setOnlyAll, setQuery, refresh } = useNotices(regattaId);
  const [classes, setClasses] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Notice | null>(null);

  useEffect(() => {
    api<RegattaClass[]>(`/regattas/${regattaId}/classes`)
      .then(list => setClasses(list.map(c => c.class_name)))
      .catch(() => setClasses([]));
  }, [regattaId]);

  const onPreview = (n: Notice) => { setCurrent(n); setOpen(true); };

  const header = useMemo(() => (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold">Documents / Notices</h2>
      <button onClick={refresh} className="text-sm px-3 py-1 border rounded hover:bg-gray-50">Atualizar</button>
    </div>
  ), [refresh]);

  return (
    <div className="space-y-4">
      {header}
      <NoticeFilters
        classes={classes}
        onClassChange={setClassName}
        onDocTypeChange={setDocType}
        onImportantChange={setImportant}
        onOnlyAllChange={setOnlyAll}
        onQueryChange={setQuery}
      />

      {loading && <div className="text-gray-500">A carregar…</div>}
      {error && <div className="text-red-600">{error}</div>}

      <NoticeTable items={data} onPreview={onPreview} />

      <PdfModal open={open} notice={current} onClose={() => setOpen(false)} />
    </div>
  );
}
