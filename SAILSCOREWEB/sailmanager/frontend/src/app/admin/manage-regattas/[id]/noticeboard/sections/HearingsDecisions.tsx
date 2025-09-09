"use client";

export default function HearingsDecisions({ regattaId }: { regattaId: number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-lg font-semibold mb-2">Protest Decisions</h3>
      <p className="text-sm text-gray-600">
        Publicação e gestão de decisões de protesto/hearings para a regata #{regattaId}.
      </p>
      {/* TODO: quando os endpoints estiverem prontos, mostramos tabela/lista semelhante a Documents */}
    </div>
  );
}
