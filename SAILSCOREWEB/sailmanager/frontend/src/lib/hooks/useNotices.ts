"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Notice, NoticeDocType } from "@/types/notice";

export function useNotices(regattaId: number) {
  const [data, setData] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [className, setClassName] = useState<string | null>(null);
  const [docType, setDocType] = useState<NoticeDocType | null>(null);
  const [important, setImportant] = useState<boolean | null>(null);
  const [onlyAll, setOnlyAll] = useState<boolean | null>(null);
  const [query, setQuery] = useState<string>(""); // pesquisa por título (client-side)

  const fetchNotices = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (className) params.set("class_name", className);
      if (docType) params.set("doc_type", docType);
      if (important !== null) params.set("important", String(important));
      if (onlyAll !== null) params.set("only_all_classes", String(onlyAll));
      params.set("limit", "500");
      const result = await api<Notice[]>(`/notices/${regattaId}?${params.toString()}`);
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Erro ao obter documentos.");
    } finally {
      setLoading(false);
    }
  }, [regattaId, className, docType, important, onlyAll]);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const filtered = query
    ? data.filter(n => n.title.toLowerCase().includes(query.toLowerCase()))
    : data;

  return {
    data: filtered, loading, error,
    setClassName, setDocType, setImportant, setOnlyAll, setQuery,
    refresh: fetchNotices,
  };
}
