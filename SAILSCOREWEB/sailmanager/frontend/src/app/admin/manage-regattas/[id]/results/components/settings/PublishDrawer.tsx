'use client';

import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiGet, apiSend } from '@/lib/api';

type Props = {
  regattaId: number;
  class_name: string;
  onClose: () => void;
  races: Array<{ id: number; name: string; class_name?: string; order_index?: number | null }>;
};

type PublicationOut = {
  regatta_id: number;
  class_name: string;
  published_races_count: number;
};

export default function PublishDrawer({ regattaId, class_name, onClose, races }: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentK, setCurrentK] = useState(0);
  const [selectedK, setSelectedK] = useState(0);

  useEffect(() => {
    if (!class_name) return;
    setLoading(true);
    (async () => {
      try {
        const data = await apiGet<PublicationOut>(
          `/regattas/${regattaId}/classes/${encodeURIComponent(class_name)}/publication`,
          token ?? undefined
        );
        const k = data?.published_races_count ?? 0;
        setCurrentK(k);
        setSelectedK(k);
      } catch {
        setCurrentK(0);
        setSelectedK(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [regattaId, class_name, token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiSend(
        `/regattas/${regattaId}/classes/${encodeURIComponent(class_name)}/publication`,
        'PUT',
        { published_races_count: selectedK },
        token ?? undefined
      );
      onClose();
    } catch (e: any) {
      alert(e?.message || 'Failed to update publication.');
    } finally {
      setSaving(false);
    }
  };

  const orderedRaces = [...(races || [])].sort(
    (a, b) => (a.order_index ?? a.id) - (b.order_index ?? b.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="publish-drawer-title">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 id="publish-drawer-title" className="text-lg font-semibold flex items-center gap-2">
            <Globe size={20} strokeWidth={2} />
            Publish (Public)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600 mb-4">
            Public results pages will show only the first K races (in series order). Choose how many races to publish for class <strong>{class_name}</strong>.
          </p>

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : orderedRaces.length === 0 ? (
            <p className="text-gray-500">No races for this class yet. Create races first.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Publish up to:</p>
              <label className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="publish_k"
                  checked={selectedK === 0}
                  onChange={() => setSelectedK(0)}
                  className="rounded-full"
                />
                <span>None (0 races) — public sees &quot;No published results yet&quot;</span>
              </label>
              {orderedRaces.map((race, idx) => {
                const k = idx + 1;
                return (
                  <label
                    key={race.id}
                    className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="publish_k"
                      checked={selectedK === k}
                      onChange={() => setSelectedK(k)}
                      className="rounded-full"
                    />
                    <span>
                      Race {k}: {race.name}
                      {k === currentK && currentK > 0 && (
                        <span className="ml-2 text-xs text-blue-600">(current)</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
