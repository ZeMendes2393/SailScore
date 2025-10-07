// EntryList.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiGet, BASE_URL } from '@/lib/api';

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
  paid?: boolean;
}

interface EntryListProps {
  regattaId: number;
  selectedClass: string | null;
}

export default function EntryList({ regattaId, selectedClass }: EntryListProps) {
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filteredEntries = useMemo(() => {
    if (!selectedClass) return entries;
    const cls = selectedClass.trim().toLowerCase();
    return entries.filter(e => (e.class_name || '').trim().toLowerCase() === cls);
  }, [entries, selectedClass]);

  useEffect(() => {
    let alive = true;

    async function tryLoad(): Promise<Entry[]> {
      // tenta diferentes nomes de query param que os backends costumam usar
      const candidates = [
        `/entries?regatta_id=${Number(regattaId)}`,
        `/entries?regattaId=${Number(regattaId)}`,
        `/entries?regatta=${Number(regattaId)}`,
      ];

      for (const path of candidates) {
        try {
          const data: any = await apiGet<any>(path, token || undefined);
          const arr = Array.isArray(data)
            ? data
            : Array.isArray(data?.items) ? data.items : [];
          if (arr.length || Array.isArray(data)) return arr as Entry[];
        } catch {
          // continua a tentar o próximo
        }
      }
      return [];
    }

    (async () => {
      try {
        const list = await tryLoad();
        if (alive) setEntries(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('❌ Erro a carregar inscrições:', e);
        if (alive) setEntries([]); // evita .map is not a function
      }
    })();

    return () => { alive = false; };
  }, [regattaId, token]);

  const togglePaid = async (entryId: number) => {
    if (!isAdmin || !token) return;

    try {
      const res = await fetch(`${BASE_URL}/entries/${entryId}/toggle_paid`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error('❌ Erro ao atualizar pagamento:', errorData?.detail ?? res.status);
        return;
      }
      const data = await res.json();
      setEntries(prev => prev.map(e => (e.id === entryId ? { ...e, paid: data.paid } : e)));
    } catch (error) {
      console.error('⚠️ Erro na requisição:', error);
    }
  };

  const toggleDetails = (id: number) => {
    if (!isAdmin) return;
    setSelectedId(prev => (prev === id ? null : id));
  };

  return (
    <div>
      {filteredEntries.length === 0 ? (
        <p className="text-gray-500">Ainda não há inscrições para esta classe nesta regata.</p>
      ) : (
        <table className="w-full table-auto border mt-2 text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2 border">Classe</th>
              <th className="p-2 border">Nome</th>
              <th className="p-2 border">Clube</th>
              {isAdmin && <th className="p-2 border text-center">Pago</th>}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map(entry => (
              <React.Fragment key={entry.id}>
                <tr
                  onClick={() => toggleDetails(entry.id)}
                  className={isAdmin ? 'cursor-pointer hover:bg-gray-50' : ''}
                >
                  <td className="p-2 border">{entry.class_name}</td>

                  {/* NAVEGAÇÃO: clique no nome abre página de edição */}
                  <td className="p-2 border">
                    <a
                      className={isAdmin ? 'text-blue-600 underline' : ''}
                      onClick={(e) => {
                        e.stopPropagation(); // não abrir/fechar detalhes
                        if (!isAdmin) return;
                        e.preventDefault();
                        // abrir página dedicada
                        window.location.href = `/admin/entries/${entry.id}?regattaId=${regattaId}`;
                      }}
                      href={`/admin/entries/${entry.id}?regattaId=${regattaId}`}
                    >
                      {entry.first_name} {entry.last_name}
                    </a>
                  </td>

                  <td className="p-2 border">{entry.club}</td>
                  {isAdmin && (
                    <td className="p-2 border text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(entry.paid)}
                        onChange={() => togglePaid(entry.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                  )}
                </tr>

                {isAdmin && selectedId === entry.id && (
                  <tr>
                    <td colSpan={4} className="p-2 border bg-gray-50">
                      <div className="text-gray-700 space-y-1">
                        <p><strong>Email:</strong> {entry.email || '—'}</p>
                        <p><strong>Contacto:</strong> {entry.contact_phone_1 || '—'}</p>
                        <p><strong>Número de vela:</strong> {entry.sail_number || '—'}</p>
                        <p><strong>Nome do barco:</strong> {entry.boat_name || '—'}</p>
                        <p><strong>Categoria:</strong> {entry.category || '—'}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
