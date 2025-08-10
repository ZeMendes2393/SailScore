'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

interface OverallResult {
  sail_number: string
  boat_name: string
  class_name: string
  skipper_name: string
  total_points: number
  per_race: Record<string, number | string>
}

export default function OverallResultsPage() {
  const params = useParams<{ id: string }>()
  const regattaId = params.id

  const [classes, setClasses] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  const [results, setResults] = useState<OverallResult[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingResults, setLoadingResults] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // nomes das regatas (apenas da classe corrente)
  const raceNames = useMemo(() => {
    const s = new Set<string>()
    results.forEach(r => Object.keys(r.per_race || {}).forEach(k => s.add(k)))
    return Array.from(s)
  }, [results])

  // 1) Carregar classes disponíveis da regata
  useEffect(() => {
    const fetchClasses = async () => {
      setLoadingClasses(true)
      setError(null)
      try {
        const res = await fetch(`http://localhost:8000/regattas/${regattaId}/classes`)
        if (!res.ok) throw new Error('Falha ao obter classes da regata')
        const data: string[] = await res.json()
        setClasses(data || [])
        if (data?.length) setSelectedClass(prev => prev ?? data[0])
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar classes')
      } finally {
        setLoadingClasses(false)
      }
    }
    fetchClasses()
  }, [regattaId])

  // 2) Carregar resultados só da classe selecionada
  useEffect(() => {
    const fetchOverallResults = async () => {
      if (!selectedClass) {
        setResults([])
        setLoadingResults(false)
        return
      }
      setLoadingResults(true)
      setError(null)
      try {
        const url = `http://localhost:8000/results/overall/${regattaId}?class_name=${encodeURIComponent(
          selectedClass
        )}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Falha ao obter resultados')
        const data = await res.json()
        if (!Array.isArray(data)) throw new Error('Formato inesperado da resposta')
        setResults(data)
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar resultados')
      } finally {
        setLoadingResults(false)
      }
    }
    fetchOverallResults()
  }, [regattaId, selectedClass])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">🏆 Classificação Geral</h2>

      {/* estado de erro (simples) */}
      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-2 text-red-700">
          {error}
        </div>
      )}

      {/* Abas de classes */}
      {loadingClasses ? (
        <p className="text-gray-500">A carregar classes…</p>
      ) : classes.length === 0 ? (
        <p className="text-gray-500">Sem classes configuradas para esta regata.</p>
      ) : (
        <div className="flex gap-2 mb-4 flex-wrap">
          {classes.map(cls => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-3 py-1 rounded font-semibold border transition ${
                selectedClass === cls
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      )}

      {/* Tabela da classe selecionada */}
      {selectedClass && (
        <div className="mt-2">
          <h3 className="text-lg font-semibold mb-2">Classe: {selectedClass}</h3>

          {loadingResults ? (
            <p className="text-gray-500">A carregar resultados…</p>
          ) : results.length === 0 ? (
            <p className="text-gray-500">Sem resultados para a classe {selectedClass}.</p>
          ) : (
            <table className="table-auto w-full border border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2">#</th>
                  <th className="border px-3 py-2">Nº Vela</th>
                  <th className="border px-3 py-2">Embarcação</th>
                  <th className="border px-3 py-2">Timoneiro</th>
                  {raceNames.map(name => (
                    <th key={name} className="border px-3 py-2">
                      {name}
                    </th>
                  ))}
                  <th className="border px-3 py-2 font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.class_name}-${r.sail_number}-${i}`}>
                    <td className="border px-3 py-2">{i + 1}º</td>
                    <td className="border px-3 py-2">{r.sail_number}</td>
                    <td className="border px-3 py-2">{r.boat_name}</td>
                    <td className="border px-3 py-2">{r.skipper_name}</td>
                    {raceNames.map(name => (
                      <td key={name} className="border px-3 py-2 text-center">
                        {r.per_race?.[name] ?? '-'}
                      </td>
                    ))}
                    <td className="border px-3 py-2 font-semibold">{r.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
