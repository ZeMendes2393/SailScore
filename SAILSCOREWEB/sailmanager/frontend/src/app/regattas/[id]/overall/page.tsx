'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

interface RegattaConfig {
  id: number
  name: string
  discard_count: number
  discard_threshold: number
}

interface OverallResult {
  sail_number: string
  boat_name: string
  class_name: string
  skipper_name: string
  total_points: number
  per_race: Record<string, number | string>
}

type ComputedRow = OverallResult & {
  net_points: number
  discardedRaceNames: Set<string>
}

export default function OverallResultsPage() {
  const params = useParams<{ id: string }>()
  const regattaId = params.id

  const [classes, setClasses] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  const [rawResults, setRawResults] = useState<OverallResult[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingResults, setLoadingResults] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [regatta, setRegatta] = useState<RegattaConfig | null>(null)

  // nomes das regatas (apenas da classe corrente)
  const raceNames = useMemo(() => {
    const s = new Set<string>()
    rawResults.forEach(r => Object.keys(r.per_race || {}).forEach(k => s.add(k)))
    return Array.from(s)
  }, [rawResults])

  // 0) buscar config da regata (descartes)
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`http://localhost:8000/regattas/${regattaId}`)
        if (!res.ok) throw new Error('Falha ao obter regata')
        const data = await res.json()
        setRegatta({
          id: data.id,
          name: data.name,
          discard_count: data.discard_count ?? 0,
          discard_threshold: data.discard_threshold ?? 0,
        })
      } catch (e: any) {
        console.error(e)
      }
    }
    run()
  }, [regattaId])

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
        setRawResults([])
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
        setRawResults(data)
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar resultados')
      } finally {
        setLoadingResults(false)
      }
    }
    fetchOverallResults()
  }, [regattaId, selectedClass])

  // 3) calcular NET e quais corridas são descartadas (no cliente)
  const results: ComputedRow[] = useMemo(() => {
    const discards = regatta?.discard_count ?? 0
    const threshold = regatta?.discard_threshold ?? 0

    // helper: extrai número de strings tipo "DNC (21)" ou "15.0"
    const extractPoints = (val: number | string | null | undefined) => {
      if (typeof val === 'number' && Number.isFinite(val)) return val
      if (typeof val === 'string') {
        const m = val.match(/-?\d+(\.\d+)?/)
        if (m) return Number(m[0])
      }
      return NaN
    }

    return rawResults
      .map((r) => {
        // pares {name, points} apenas com valores numéricos válidos
        const pairs = Object.entries(r.per_race || {})
          .map(([name, v]) => {
            const n = extractPoints(v as any)
            return Number.isFinite(n) ? { name, points: n } : null
          })
          .filter(Boolean) as { name: string; points: number }[]

        // total recalculado a partir das provas numéricas
        const totalFromPairs = pairs.reduce((acc, cur) => acc + cur.points, 0)

        let discardedRaceNames = new Set<string>()
        let net = totalFromPairs

        console.log({
  discards,
  threshold,
  racesCount: pairs.length,
  regatta
})


        // aplicar regra: só há descartes se #provas >= threshold
        if (pairs.length >= threshold && discards > 0) {
          // escolher os piores (maiores pontos)
          const sortedDesc = pairs.slice().sort((a, b) => b.points - a.points)
          const k = Math.min(discards, pairs.length)
          const toDiscard = sortedDesc.slice(0, k)
          const sumDiscard = toDiscard.reduce((acc, cur) => acc + cur.points, 0)
          discardedRaceNames = new Set(toDiscard.map(x => x.name))
          net = totalFromPairs - sumDiscard
        }

        return {
          ...r,
          // usamos o total coerente com per_race para a tabela
          total_points: Number(totalFromPairs.toFixed(2)),
          net_points: Number(net.toFixed(2)),
          discardedRaceNames,
        }
      })
      // ordenar pelo net (menor é melhor), depois total como desempate
      .sort((a, b) => (a.net_points - b.net_points) || (a.total_points - b.total_points))
  }, [rawResults, regatta])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold"> Classificação Geral</h2>
        {regatta && (
          <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
            Descartes: <strong>{regatta.discard_count}</strong>
            {regatta.discard_count > 0 && (
              <> (após <strong>{regatta.discard_threshold}</strong> regatas)</>
            )}
          </span>
        )}
      </div>

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
                  <th className="border px-3 py-2 font-bold text-right">Total</th>
                  <th className="border px-3 py-2 font-bold text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.class_name}-${r.sail_number}-${i}`}>
                    <td className="border px-3 py-2">{i + 1}º</td>
                    <td className="border px-3 py-2">{r.sail_number}</td>
                    <td className="border px-3 py-2">{r.boat_name}</td>
                    <td className="border px-3 py-2">{r.skipper_name}</td>

                    {raceNames.map(name => {
                      const raw = r.per_race?.[name]
                      // mostramos o que veio (número ou string tipo DNC), mas só marcamos descarte se for numérico
                      const num = typeof raw === 'number' ? raw : (typeof raw === 'string' ? (raw.match(/-?\d+(\.\d+)?/) ? Number(raw.match(/-?\d+(\.\d+)?/)![0]) : NaN) : NaN)
                      const discarded = r.discardedRaceNames.has(name) && Number.isFinite(num)
                      return (
                        <td
                          key={name}
                          className={`border px-3 py-2 text-center ${discarded ? 'text-gray-400' : ''}`}
                          title={discarded ? 'Descartada' : undefined}
                        >
                          {discarded ? `(${typeof raw === 'number' ? raw : (raw ?? '-')})` : (raw ?? '-')}
                        </td>
                      )
                    })}

                    <td className="border px-3 py-2 font-semibold text-right">{r.total_points.toFixed?.(2) ?? r.total_points}</td>
                    <td className="border px-3 py-2 font-extrabold text-right">{r.net_points.toFixed?.(2) ?? r.net_points}</td>
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
