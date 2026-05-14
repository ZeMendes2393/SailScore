'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import RegattaHeader from '../components/RegattaHeader'
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay'
import { getApiBaseUrl } from '@/lib/api'
import {
  getVisibleResultsOverallColumnsForClass,
  RESULTS_OVERALL_COLUMNS,
  type ResultsOverallColumnId,
} from '@/lib/resultsOverallColumns'

interface RegattaConfig {
  id: number
  name: string
  discard_count: number
  discard_threshold: number
  results_overall_columns?: string[] | Record<string, string[]> | null
}

interface OverallResult {
  sail_number: string
  boat_country_code?: string | null
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
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
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
        const res = await fetch(`${getApiBaseUrl()}/regattas/${regattaId}`)
        if (!res.ok) throw new Error('Failed to load regatta')
        const data = await res.json()
        setRegatta({
          id: data.id,
          name: data.name,
          discard_count: data.discard_count ?? 0,
          discard_threshold: data.discard_threshold ?? 0,
          results_overall_columns: data.results_overall_columns ?? null,
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
        const res = await fetch(`${getApiBaseUrl()}/regattas/${regattaId}/classes`)
        if (!res.ok) throw new Error('Failed to load regatta classes')
        const data: string[] = await res.json()
        setClasses(data || [])
        if (data?.length) setSelectedClass(prev => prev ?? data[0])
      } catch (e: any) {
        setError(e?.message || 'Failed to load classes')
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
        const url = `${getApiBaseUrl()}/results/overall/${regattaId}?class_name=${encodeURIComponent(
          selectedClass
        )}&public=1`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Falha ao obter resultados')
        const data = await res.json()
        const rows = Array.isArray(data) ? data : (data?.rows ?? [])
        setRawResults(rows)
        setPublishedAt(data?.published_at ?? null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load results')
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

  const visibleColumns: ResultsOverallColumnId[] = useMemo(
    () => getVisibleResultsOverallColumnsForClass(regatta?.results_overall_columns, selectedClass),
    [regatta?.results_overall_columns, selectedClass]
  )

  /** Format ISO published_at as "11 Mar 2026 at 02:17" (local time, English). */
  const formattedPublishedAt = useMemo(() => {
    if (!publishedAt) return null
    try {
      const d = new Date(publishedAt)
      if (Number.isNaN(d.getTime())) return null
      const day = d.getDate()
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const month = months[d.getMonth()]
      const year = d.getFullYear()
      const h = d.getHours().toString().padStart(2, '0')
      const m = d.getMinutes().toString().padStart(2, '0')
      return `${day} ${month} ${year} at ${h}:${m}`
    } catch {
      return null
    }
  }, [publishedAt])

  const fixedColumnIds = visibleColumns.filter((id) => id !== 'total' && id !== 'net')

  return (
    <main className="min-h-screen bg-gray-50">
      <RegattaHeader regattaId={Number(regattaId)} />
      <div className="container-page py-8">
      <div className="p-6 max-w-6xl mx-auto text-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h2 className="text-4xl font-bold tracking-tight"> Overall standings</h2>
        <div className="flex flex-wrap items-center gap-2">
          {formattedPublishedAt && (
            <span className="text-lg bg-slate-100 text-slate-700 px-4 py-2 rounded-lg">
              Published at {formattedPublishedAt}
            </span>
          )}
          {regatta && (
            <span className="text-lg bg-blue-100 text-blue-800 px-4 py-2 rounded-lg">
            Discards: <strong>{regatta.discard_count}</strong>
            {regatta.discard_count > 0 && (
              <> (after <strong>{regatta.discard_threshold}</strong> races)</>
            )}
          </span>
        )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-2 text-red-700">
          {error}
        </div>
      )}

      {/* Abas de classes */}
      {loadingClasses ? (
        <p className="text-gray-500">Loading classes…</p>
      ) : classes.length === 0 ? (
        <p className="text-gray-500">No classes configured for this regatta.</p>
      ) : (
        <div className="flex gap-2 mb-4 flex-wrap">
          {classes.map(cls => (
            <button
              key={cls}
              onClick={() => setSelectedClass(cls)}
              className={`px-5 py-2.5 rounded-xl text-lg font-semibold border transition ${
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
          <h3 className="text-2xl font-semibold mb-4">Class: {selectedClass}</h3>

          {loadingResults ? (
            <p className="text-gray-500">Loading results…</p>
          ) : results.length === 0 ? (
            <p className="text-gray-500">No published results yet for this class.</p>
          ) : (
            <table className="table-auto w-full border border-collapse text-lg [&_td]:min-h-[3.25rem] [&_th]:text-lg">
              <thead>
                <tr className="bg-gray-100">
                  {fixedColumnIds.map((id) => (
                    <th key={id} className="border px-4 py-4 font-semibold">
                      {RESULTS_OVERALL_COLUMNS.find((c) => c.id === id)?.label ?? id}
                    </th>
                  ))}
                  {raceNames.map((name) => (
                    <th key={name} className="border px-4 py-4 font-semibold">
                      {name}
                    </th>
                  ))}
                  {visibleColumns.includes('total') && (
                    <th className="border px-4 py-4 font-bold text-right">Total</th>
                  )}
                  {visibleColumns.includes('net') && (
                    <th className="border px-4 py-4 font-bold text-right">Net</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.class_name}-${r.sail_number}-${i}`}>
                    {fixedColumnIds.map((id) => {
                      if (id === 'place') return <td key={id} className="border px-4 py-4 text-center">{i + 1}</td>
                      if (id === 'fleet') return <td key={id} className="border px-4 py-4 text-center">{(r as any).finals_fleet ?? '—'}</td>
                      if (id === 'sail_no') return <td key={id} className="border px-4 py-4"><SailNumberDisplay countryCode={r.boat_country_code} sailNumber={r.sail_number} /></td>
                      if (id === 'boat') return <td key={id} className="border px-4 py-4">{r.boat_name}</td>
                      if (id === 'skipper') return <td key={id} className="border px-4 py-4">{r.skipper_name}</td>
                      if (id === 'class') return <td key={id} className="border px-4 py-4">{r.class_name}</td>
                      if (id === 'model') return <td key={id} className="border px-4 py-4">{(r as any).boat_model ?? '—'}</td>
                      if (id === 'bow') return <td key={id} className="border px-4 py-4">{(r as any).bow_number ?? '—'}</td>
                      return <td key={id} className="border px-4 py-4">—</td>
                    })}
                    {raceNames.map((name) => {
                      const raw = r.per_race?.[name]
                      const num = typeof raw === 'number' ? raw : (typeof raw === 'string' ? (raw.match(/-?\d+(\.\d+)?/) ? Number((raw.match(/-?\d+(\.\d+)?/) ?? [])[0]) : NaN) : NaN)
                      const discarded = r.discardedRaceNames.has(name) && Number.isFinite(num)
                      return (
                        <td
                          key={name}
                          className={`border px-4 py-4 text-center ${discarded ? 'text-gray-400' : ''}`}
                          title={discarded ? 'Discarded' : undefined}
                        >
                          {discarded ? `(${typeof raw === 'number' ? raw : (raw ?? '-')})` : (raw ?? '-')}
                        </td>
                      )
                    })}
                    {visibleColumns.includes('total') && (
                      <td className="border px-4 py-4 font-semibold text-right">{Number(r.total_points).toFixed(2)}</td>
                    )}
                    {visibleColumns.includes('net') && (
                      <td className="border px-4 py-4 font-extrabold text-right">{Number(r.net_points).toFixed(2)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
    </div>
    </main>
  )
}
