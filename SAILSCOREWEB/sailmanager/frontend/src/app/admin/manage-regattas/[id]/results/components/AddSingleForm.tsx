'use client';

interface Props {
  singleSail: string;
  setSingleSail: (v: string) => void;
  singlePos: number | '';
  setSinglePos: (v: number | '') => void;
  onAdd: () => void;
}

export default function AddSingleForm({
  singleSail, setSingleSail, singlePos, setSinglePos, onAdd
}: Props) {
  return (
    <div className="mb-6 p-4 border rounded-2xl bg-white shadow-sm">
      <h4 className="text-md font-semibold mb-2">Adicionar resultado em falta</h4>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Nº vela (ex: POR123)"
          value={singleSail}
          onChange={(e) => setSingleSail(e.target.value)}
          className="border rounded px-3 py-2 w-60"
        />
        <input
          type="number"
          min={1}
          placeholder="Posição"
          value={singlePos}
          onChange={(e) => setSinglePos(e.target.value ? Number(e.target.value) : '')}
          className="border rounded px-3 py-2 w-32"
        />
        <button
          onClick={onAdd}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Adicionar
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Insere na posição indicada e ajusta automaticamente as restantes.
      </p>
    </div>
  );
}
