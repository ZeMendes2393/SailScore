'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import useProtestPage, { ProtestType } from './useProtestPage';
import ProtestorCard from './components/ProtestorCard';
import RespondentsEditor from './components/RespondentsEditor';

const TYPES: ProtestType[] = [
  'protest',
  'redress',
  'reopen',
  'support_person_report',
  'misconduct_rss69',
];

export default function NewProtestPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const { user } = useAuth();

  // 1) Querystring tem prioridade; 2) se regatista, usar current_regatta_id
  const regattaId = useMemo(() => {
    const fromQS = Number(qs.get('regattaId') || '');
    if (Number.isFinite(fromQS) && fromQS > 0) return fromQS;
    if (user?.role === 'regatista' && user?.current_regatta_id) return user.current_regatta_id;
    return null;
  }, [qs, user?.role, user?.current_regatta_id]);

  const api = useProtestPage(regattaId);

  if (!regattaId) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-semibold">Novo Protesto</h1>
        <p className="p-4 rounded border bg-amber-50 text-amber-900">
          Seleciona primeiro uma regata (abre este ecrã a partir da página da regata
          ou usa o parâmetro <code>?regattaId=...</code>).
        </p>
        <button className="px-3 py-2 rounded border" onClick={() => router.push('/regattas')}>
          Ir para regattas
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Novo Protesto</h1>
        <button
          className="px-3 py-2 rounded border"
          onClick={() => router.push(`/dashboard/protests?regattaId=${regattaId}`)}
        >
          Voltar
        </button>
      </div>

      {/* Básico */}
      <section className="bg-white rounded border p-4 space-y-3">
        <h2 className="font-semibold">Informação básica</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Tipo</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={api.type}
              onChange={(e) => api.setType(e.target.value as ProtestType)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Race date</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={api.raceDate}
              onChange={(e) => api.setRaceDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Race number</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={api.raceNumber}
              onChange={(e) => api.setRaceNumber(e.target.value)}
              placeholder="ex.: 3"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Group (optional)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={api.groupName}
              onChange={(e) => api.setGroupName(e.target.value)}
              placeholder="ex.: Yellow"
            />
          </div>
        </div>
      </section>

      {/* Protestor */}
      <section className="bg-white rounded border p-4 space-y-3">
        <h2 className="font-semibold">Protestor</h2>
        <ProtestorCard
          loadingEntries={api.loadingEntries}
          regattaId={regattaId}
          myEntries={api.myEntries}
          initiatorEntryId={api.initiatorEntryId}
          setInitiatorEntryId={api.setInitiatorEntryId}
          selectedInitiator={api.selectedInitiator}
          initiatorRep={api.initiatorRep}
          setInitiatorRep={api.setInitiatorRep}
          repLocked={api.repLocked}
          setRepLocked={api.setRepLocked}
        />
      </section>

      {/* Respondentes */}
      <section className="bg-white rounded border p-4 space-y-3">
        <h2 className="font-semibold">Respondentes</h2>
        <RespondentsEditor
          respondents={api.respondents}
          classes={api.classes}
          entriesByClass={api.entriesByClass}
          addRespondent={api.addRespondent}
          removeRespondent={api.removeRespondent}
          updateRespondent={api.updateRespondent}
          ensureClassEntries={api.ensureClassEntries}
        />
      </section>

      {/* Incident info (UI) */}
      <section className="bg-white rounded border p-4 space-y-3">
        <h2 className="font-semibold">Incident information</h2>
        <div>
          <label className="block text-sm mb-1">When & where</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={2}
            value={api.incidentWhenWhere}
            onChange={(e) => api.setIncidentWhenWhere(e.target.value)}
            placeholder="ex.: Upwind leg, near mark 1 at ~14:25"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Description of incident</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={4}
            value={api.incidentDescription}
            onChange={(e) => api.setIncidentDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Rules alleged</label>
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={2}
            value={api.rulesAlleged}
            onChange={(e) => api.setRulesAlleged(e.target.value)}
            placeholder="ex.: RRS 10, 11; Appendix P"
          />
        </div>
        <p className="text-xs text-gray-500">Nota: estes campos ainda não são guardados no backend.</p>
      </section>

      {/* Submeter */}
      {api.error && <div className="text-red-600">{api.error}</div>}
      <div className="flex items-center gap-3">
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          onClick={async () => {
            const ok = await api.submit();
            if (ok) router.push(`/dashboard/protests?regattaId=${regattaId}`);
          }}
          disabled={api.submitting}
        >
          {api.submitting ? 'A enviar…' : 'Submeter protesto'}
        </button>
        <button
          className="px-4 py-2 rounded border"
          onClick={() => router.push(`/dashboard/protests?regattaId=${regattaId}`)}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
