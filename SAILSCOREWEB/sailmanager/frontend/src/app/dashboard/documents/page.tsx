'use client';

import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';

// === API base (sem trailing slash) ===
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

type Entry = {
  id: number;
  regatta_id: number;
  class_name?: string | null;
  sail_number?: string | null;
};

type EntryAttachment = {
  id: number;
  entry_id: number;
  filename: string;
  title: string;
  size_bytes: number;

  // BE pode devolver qualquer um destes:
  stored_path?: string | null; // ex.: público absoluto/relativo
  filepath?: string | null;    // ex.: "/uploads/entry_attachments/..."
  created_at?: string | null;
  uploaded_at?: string | null;
};

// ------- helpers -------
function humanSize(bytes: number) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, n = bytes!;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

function fmtDate(s?: string | null) {
  if (!s) return '—';
  // tolera "YYYY-MM-DD HH:mm:ss" (sem 'T')
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : '—';
}

export default function Page() {
  const { user, token } = useAuth();

  // regatta ativa (igual à restante app)
  const regattaId = useMemo(() => {
    if (user?.role === 'regatista' && (user as any)?.current_regatta_id)
      return (user as any).current_regatta_id as number;
    return Number(process.env.NEXT_PUBLIC_CURRENT_REGATTA_ID || '1');
  }, [user?.role, (user as any)?.current_regatta_id]);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [atts, setAtts] = useState<EntryAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 1) descobrir a Entry do utilizador nesta regata
  useEffect(() => {
    if (!token || !regattaId) return; // 🔒 sem token, não chama

    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const rows = await apiGet<Entry[]>(
          `/entries?mine=true&regatta_id=${regattaId}`,
          token
        );
        if (!alive) return;
        const e = Array.isArray(rows) && rows.length ? rows[0] : null;
        setEntry(e);
      } catch (e: any) {
        if (e?.status === 401) return; // ❌ não re-tentar
        if (!alive) return;
        setErr(e?.message || 'Failed to load your entry.');
        setEntry(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [token, regattaId]);

  // 2) carregar anexos dessa Entry
  useEffect(() => {
    if (!token || !entry?.id) return; // 🔒 sem token/entry não chama

    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const rows = await apiGet<EntryAttachment[]>(
          `/entries/${entry.id}/attachments`,
          token
        );
        if (!alive) return;
        setAtts(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (e?.status === 401) return; // ❌ não re-tentar
        if (!alive) return;
        setErr(e?.message || 'Failed to load documents.');
        setAtts([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [token, entry?.id]);

  return (
    <RequireAuth roles={['regatista','admin']}>
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">My Documents</h1>

        {loading && <div className="text-gray-600">Loading…</div>}
        {err && <div className="text-red-600">{err}</div>}

        {!loading && !entry && !err && (
          <div className="p-4 rounded border bg-white">
            No entry found for this regatta.
          </div>
        )}

        {entry && (
          <div className="overflow-x-auto rounded border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Title</th>
                  <th className="p-2 text-left">Filename</th>
                  <th className="p-2 text-left">Size</th>
                  <th className="p-2 text-left">Uploaded</th>
                  <th className="p-2 text-left">Link</th>
                </tr>
              </thead>
              <tbody>
                {atts.length === 0 && (
                  <tr>
                    <td className="p-4 text-gray-500" colSpan={5}>
                      No documents have been published to your entry yet.
                    </td>
                  </tr>
                )}

                {atts.map((a) => {
                  // ⬇️ Link sempre funcional:
                  // 1) se houver filepath, monta URL absoluto em cima do API_BASE
                  // 2) senão, usa o endpoint de download
                  const downloadHref = a.filepath
                    ? `${API_BASE}${a.filepath.startsWith('/') ? '' : '/'}${a.filepath}`
                    : `${API_BASE}/entries/${a.entry_id}/attachments/${a.id}/download`;

                  const when = a.created_at ?? a.uploaded_at ?? null;

                  return (
                    <tr key={a.id} className="border-t">
                      <td className="p-2">{a.title || '—'}</td>
                      <td className="p-2">{a.filename}</td>
                      <td className="p-2">{humanSize(a.size_bytes)}</td>
                      <td className="p-2">{fmtDate(when)}</td>
                      <td className="p-2">
                        {a.id ? (
                          <a
                            href={downloadHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
