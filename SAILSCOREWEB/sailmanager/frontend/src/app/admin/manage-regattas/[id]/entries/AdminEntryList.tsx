'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/api';

interface Entry {
  id: number;
  class_name: string;
  first_name: string;
  last_name: string;
  club: string;
  email?: string;
  contact_phone_1?: string;
  sail_number?: string;
  boat_name?: string;
  category?: string;
  paid?: boolean | null;
  confirmed?: boolean | null;
}

interface AdminEntryListProps {
  regattaId: number;
  selectedClass: string | null;
}

export default function AdminEntryList({ regattaId, selectedClass }: AdminEntryListProps) {
  const router = useRouter();
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [entries, setEntries] = useState<Entry[]>([]);

  const filteredEntries = useMemo(() => {
    if (!selectedClass) return entries;
    const cls = selectedClass.trim().toLowerCase();
    return entries.filter(e => (e.class_name || '').trim().toLowerCase() === cls);
  }, [entries, selectedClass]);

  useEffect(() => {
    let alive = true;

    async function tryLoad(): Promise<Entry[]> {
      const paths = [
        `/entries?regatta_id=${Number(regattaId)}`,
        `/entries?regattaId=${Number(regattaId)}`,
        `/entries?regatta=${Number(regattaId)}`,
      ];
      for (const p of paths) {
        try {
          const data: any = await apiGet<any>(p, token || undefined);
          const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          if (arr.length || Array.isArray(data)) return arr as Entry[];
        } catch {}
      }
      return [];
    }

    (async () => {
      try {
        const list = await tryLoad();
        if (!alive) return;
        setEntries(Array.isArray(list) ? list : []);
      } catch {
        if (alive) setEntries([]);
      }
    })();

    return () => { alive = false; };
  }, [regattaId, token]);

  // Suave: base 200; hover 300 aplicado à LINHA (group-hover)
  const rowColors = (e: Entry) => {
    const paid = !!e.paid;
    const confirmed = !!e.confirmed;
    if (paid && confirmed) {
      return { base: 'bg-green-200 text-gray-900', hover: 'group-hover:bg-green-300' };
    }
    if (!paid && !confirmed) {
      return { base: 'bg-red-200 text-gray-900', hover: 'group-hover:bg-red-300' };
    }
    return { base: 'bg-yellow-200 text-gray-900', hover: 'group-hover:bg-yellow-300' };
  };

  const goToEdit = (entryId: number) => {
    router.push(`/admin/manage-regattas/${regattaId}/entries/${entryId}?regattaId=${regattaId}`);
  };

  if (!isAdmin) return <p className="text-gray-500">Admin only.</p>;

  return (
    <div>
      {filteredEntries.length === 0 ? (
        <p className="text-gray-500">No entries for this class in this regatta yet.</p>
      ) : (
        <table className="w-full table-auto border border-black mt-2 text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2 border border-black">Class</th>
              <th className="p-2 border border-black">Sail no.</th>
              <th className="p-2 border border-black">Name</th>
              <th className="p-2 border border-black">Club</th>
              <th className="p-2 border border-black text-center">Paid</th>
              <th className="p-2 border border-black text-center">Confirmed</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map(entry => {
              const c = rowColors(entry);
              // aplicamos cor nas TD; o hover vem do TR com "group"
              const cell = `p-2 border border-black ${c.base} ${c.hover} transition-colors`;
              return (
                <tr
                  key={entry.id}
                  onClick={() => goToEdit(entry.id)}
                  className="group cursor-pointer"
                >
                  <td className={cell}>{entry.class_name || '—'}</td>
                  <td className={cell}>{entry.sail_number || '—'}</td>
                  <td className={cell}>
                    {(entry.first_name || '')} {(entry.last_name || '')}
                  </td>
                  <td className={cell}>{entry.club || '—'}</td>
                  <td className={`${cell} text-center`}>
                    <input
                      type="checkbox"
                      checked={!!entry.paid}
                      readOnly
                      disabled
                      className="pointer-events-none"
                    />
                  </td>
                  <td className={`${cell} text-center`}>
                    <input
                      type="checkbox"
                      checked={!!entry.confirmed}
                      readOnly
                      disabled
                      className="pointer-events-none"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
