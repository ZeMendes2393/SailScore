// ProtestorCard.tsx
'use client';

type EntryOption = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  class_name?: string | null;
  sail_number?: string | null;
  boat_name?: string | null;
  email?: string | null;
};

interface Props {
  loadingEntries: boolean;
  regattaId: number;
  myEntries: EntryOption[];
  initiatorEntryId: number | undefined;
  setInitiatorEntryId: (id: number | undefined) => void;
  selectedInitiator?: EntryOption;
  initiatorRep: string;
  setInitiatorRep: (v: string) => void;
  repLocked: boolean;
  setRepLocked: (v: boolean) => void;
}

function entryFullName(en?: EntryOption): string {
  if (!en) return '';
  const full = `${en.first_name || ''} ${en.last_name || ''}`.trim();
  return full || en.email || en.boat_name || en.sail_number || '';
}

export default function ProtestorCard({
  loadingEntries,
  regattaId,
  myEntries,
  initiatorEntryId,
  setInitiatorEntryId,
  selectedInitiator,
  initiatorRep,
  setInitiatorRep,
  repLocked,
  setRepLocked,
}: Props) {
  return (
    <div className="space-y-3">
      {loadingEntries && (
        <div className="text-sm text-gray-500">A carregar os teus dados…</div>
      )}

      {!loadingEntries && myEntries.length === 0 && (
        <div className="p-3 rounded border bg-amber-50 text-amber-900 text-sm">
          Não encontrámos nenhuma inscrição tua nesta regata.
          <br />
          Verifica em{' '}
          <a href={`/dashboard/entry-data?regattaId=${regattaId}`} className="underline">
            Entry data
          </a>{' '}
          ou pede à organização para associar a tua inscrição à tua conta.
        </div>
      )}

      {myEntries.length > 1 && (
        <div className="mb-2">
          <label className="block text-sm mb-1">Escolher o teu barco</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={initiatorEntryId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setInitiatorEntryId(v ? Number(v) : undefined);
            }}
          >
            <option value="" disabled>
              Seleciona…
            </option>
            {myEntries.map((en) => (
              <option key={en.id} value={en.id}>
                {en.sail_number || '—'} · {en.boat_name || '—'} · {en.class_name || '—'}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 rounded p-3 border">
        <div>
          <div className="text-xs text-gray-500">Name</div>
          <div className="font-medium">{entryFullName(selectedInitiator) || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Position</div>
          <div className="font-medium">Skipper</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Class</div>
          <div className="font-medium">{selectedInitiator?.class_name || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Sail no.</div>
          <div className="font-medium">{selectedInitiator?.sail_number || '—'}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-sm mb-1">Represented by</label>
          <input
            className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
            value={initiatorRep}
            onChange={(e) => setInitiatorRep(e.target.value)}
            disabled={repLocked}
          />
        </div>
        <button
          type="button"
          className="mt-6 px-3 py-2 border rounded"
          onClick={() => setRepLocked(!repLocked)}
          title={repLocked ? 'Editar' : 'Bloquear'}
        >
          {repLocked ? 'Editar' : 'Bloquear'}
        </button>
      </div>
    </div>
  );
}
