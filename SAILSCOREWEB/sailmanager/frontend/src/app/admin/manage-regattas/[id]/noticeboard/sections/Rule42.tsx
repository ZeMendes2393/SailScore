"use client";

export default function Rule42({ regattaId }: { regattaId: number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-lg font-semibold mb-2">Rule 42</h3>
      <p className="text-sm text-gray-600">
        Secção para documentos/aviso específicos de Rule 42 da regata #{regattaId}.
      </p>
      {/* TODO: quando definires filtros (ex.: doc_type RULE42), ligamos à listagem como em Documents */}
    </div>
  );
}
