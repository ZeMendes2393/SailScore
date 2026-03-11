'use client'

import { useEffect, useMemo, useState } from 'react'
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay'
import { BASE_URL } from '@/lib/api'
import {
  getVisibleResultsOverallColumnsForClass,
  RESULTS_OVERALL_COLUMNS,
  type ResultsOverallColumnId,
} from '@/lib/resultsOverallColumns'

type RaceTimes = {
  finish_time?: string | null
  elapsed_time?: string | null
  corrected_time?: string | null
  delta?: string | null
  points?: number | null
  position?: number | null
}

type RaceMeta = {
  start_time?: string | null
  handicap_method?: string | null
  orc_rating_mode?: string | null
}

interface OverallResult {
  sail_number: string
  boat_country_code?: string | null
  boat_name: string
  class_name: string
  skipper_name: string
  total_points: number
  net_points?: number
  per_race: {
    [raceName: string]: string | number
  }
  per_race_times?: {
    [raceName: string]: RaceTimes
  }
  finals_fleet?: string | number | null
  boat_model?: string | null
  bow_number?: string | number | null
}

interface ResultsViewerProps {
  regattaId: number
  selectedClass: string
}

export default function ResultsViewer({ regattaId, selectedClass }: ResultsViewerProps) {
  const [results, setResults] = useState<OverallResult[]>([])
  const [racesMeta, setRacesMeta] = useState<Record<string, RaceMeta>>({})
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [resultsOverallColumns, setResultsOverallColumns] = useState<string[] | Record<string, string[]> | null>(null)
  const [selectedRaceForTimes, setSelectedRaceForTimes] = useState<string | null>(null)

  useEffect(() => {
    const fetchRegatta = async () => {
      try {
        const res = await fetch(`${BASE_URL}/regattas/${regattaId}`)
        const data = await res.json()
        setResultsOverallColumns(data?.results_overall_columns ?? null)
      } catch {
        setResultsOverallColumns(null)
      }
    }
    fetchRegatta()
  }, [regattaId])

  useEffect(() => {
    if (!selectedClass) return
    const fetchOverallResults = async () => {
      setLoading(true)
      try {
        const url = `${BASE_URL}/results/overall/${regattaId}?class_name=${encodeURIComponent(selectedClass)}&public=1`
        const res = await fetch(url)
        const data = await res.json()
        if (Array.isArray(data)) {
          setResults(data)
          setRacesMeta({})
          setPublishedAt(null)
        } else if (data && typeof data === 'object') {
          setResults(Array.isArray(data.rows) ? data.rows : [])
          setRacesMeta(data.races_meta ?? {})
          setPublishedAt(data.published_at ?? null)
        } else {
          setResults([])
          setRacesMeta({})
        }
      } catch (error) {
        console.error('Error loading overall results:', error)
        setResults([])
        setPublishedAt(null)
      } finally {
        setLoading(false)
      }
    }

    fetchOverallResults()
  }, [regattaId, selectedClass])

  const visibleColumns: ResultsOverallColumnId[] = useMemo(
    () => getVisibleResultsOverallColumnsForClass(resultsOverallColumns, selectedClass),
    [resultsOverallColumns, selectedClass]
  )

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

  if (loading) return <p className="text-gray-500">Loading results…</p>
  if (results.length === 0) return <p className="text-gray-500">No published results yet for this class.</p>

  const raceNames = (() => {
    const set = new Set<string>()
    results.forEach((r) => Object.keys(r.per_race || {}).forEach((k) => set.add(k)))
    return Array.from(set)
  })()

  const hasDetailForRace = (raceName: string) =>
    results.some((r) => {
      const t = r.per_race_times?.[raceName]
      return t && (t.points != null || t.finish_time || t.elapsed_time || t.corrected_time || t.delta)
    })

  const sortedResults = [...results].sort(
    (a, b) => (a.net_points ?? a.total_points) - (b.net_points ?? b.total_points) || a.total_points - b.total_points
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h2 className="text-2xl font-bold">Overall — {selectedClass}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {formattedPublishedAt && (
            <span className="text-sm bg-slate-100 text-slate-700 px-2 py-1 rounded">
              Published at {formattedPublishedAt}
            </span>
          )}
          <a
            href={`${BASE_URL}/results/overall/${regattaId}/pdf?class_name=${encodeURIComponent(selectedClass)}`}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 underline"
          >
            Download PDF
          </a>
        </div>
      </div>

      <table className="table-auto w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            {fixedColumnIds.map((id) => (
              <th key={id} className="border px-2 py-1">
                {RESULTS_OVERALL_COLUMNS.find((c) => c.id === id)?.label ?? id}
              </th>
            ))}
            {raceNames.map((race) => {
              const hasDetail = hasDetailForRace(race)
              const isSelected = selectedRaceForTimes === race
              return (
                <th
                  key={race}
                  className={`border px-2 py-1 ${hasDetail ? 'cursor-pointer hover:bg-blue-100 select-none' : ''} ${isSelected ? 'bg-blue-200 font-semibold' : ''}`}
                  onClick={() => hasDetail && setSelectedRaceForTimes((prev) => (prev === race ? null : race))}
                  title={hasDetail ? (isSelected ? 'Clique para ocultar detalhe' : 'Clique para ver detalhe desta race') : undefined}
                >
                  {race}
                  {hasDetail && <span className="ml-1 text-xs opacity-70">⏱</span>}
                </th>
              )
            })}
            {visibleColumns.includes('total') && (
              <th className="border px-2 py-1 font-bold">Total</th>
            )}
            {visibleColumns.includes('net') && (
              <th className="border px-2 py-1 font-bold">Net</th>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedResults.map((r, i) => (
            <tr key={`${r.sail_number}-${r.class_name}-${i}`}>
              {fixedColumnIds.map((id) => {
                if (id === 'place') return <td key={id} className="border px-2 py-1">{i + 1}</td>
                if (id === 'fleet') return <td key={id} className="border px-2 py-1 text-center">{r.finals_fleet ?? '—'}</td>
                if (id === 'sail_no') return <td key={id} className="border px-2 py-1"><SailNumberDisplay countryCode={r.boat_country_code} sailNumber={r.sail_number} /></td>
                if (id === 'boat') return <td key={id} className="border px-2 py-1">{r.boat_name}</td>
                if (id === 'skipper') return <td key={id} className="border px-2 py-1">{r.skipper_name}</td>
                if (id === 'class') return <td key={id} className="border px-2 py-1">{r.class_name}</td>
                if (id === 'model') return <td key={id} className="border px-2 py-1">{r.boat_model ?? '—'}</td>
                if (id === 'bow') return <td key={id} className="border px-2 py-1">{r.bow_number ?? '—'}</td>
                return <td key={id} className="border px-2 py-1">—</td>
              })}
              {raceNames.map((race) => (
                <td key={race} className="border px-2 py-1 text-center">{r.per_race[race] ?? '-'}</td>
              ))}
              {visibleColumns.includes('total') && (
                <td className="border px-2 py-1 font-bold">{typeof r.total_points === 'number' ? r.total_points.toFixed(2) : r.total_points}</td>
              )}
              {visibleColumns.includes('net') && (
                <td className="border px-2 py-1 font-bold">{typeof r.net_points === 'number' ? r.net_points.toFixed(2) : (r.net_points ?? r.total_points)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Tabela de detalhe da race selecionada (handicap: tempos) */}
      {selectedRaceForTimes && (
        <div className="mt-10">
          {(() => {
            const meta = racesMeta[selectedRaceForTimes]
            const startTime = meta?.start_time
            const orcMode = meta?.handicap_method === 'orc' ? (meta?.orc_rating_mode || 'medium') : null
            const detailRows = sortedResults
              .map((r) => ({ row: r, times: r.per_race_times?.[selectedRaceForTimes] }))
              .filter(({ times }) => times && (times.points != null || times.finish_time || times.elapsed_time || times.corrected_time || times.delta))
              .sort((a, b) => (a.times?.position ?? 999) - (b.times?.position ?? 999))

            return (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-bold">{selectedRaceForTimes}</h3>
                  {startTime && (
                    <span className="text-sm text-gray-600">Start: {startTime}</span>
                  )}
                  {orcMode && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800">
                      Rating: {orcMode.charAt(0).toUpperCase() + orcMode.slice(1)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedRaceForTimes(null)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Fechar
                  </button>
                </div>
                <table className="table-auto w-full border text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-2 py-1">#</th>
                      <th className="border px-2 py-1">Sail #</th>
                      <th className="border px-2 py-1">Start</th>
                      <th className="border px-2 py-1">Finish</th>
                      <th className="border px-2 py-1">Elapsed</th>
                      <th className="border px-2 py-1">Corrected</th>
                      <th className="border px-2 py-1">Delta</th>
                      <th className="border px-2 py-1">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map(({ row, times }) => (
                      <tr key={`${row.sail_number}-${selectedRaceForTimes}`}>
                        <td className="border px-2 py-1 text-center">{times?.position ?? '—'}</td>
                        <td className="border px-2 py-1">
                          <SailNumberDisplay countryCode={row.boat_country_code} sailNumber={row.sail_number} />
                        </td>
                        <td className="border px-2 py-1 text-center">{startTime ?? '—'}</td>
                        <td className="border px-2 py-1 text-center">{times?.finish_time ?? '—'}</td>
                        <td className="border px-2 py-1 text-center">{times?.elapsed_time ?? '—'}</td>
                        <td className="border px-2 py-1 text-center">{times?.corrected_time ?? '—'}</td>
                        <td className="border px-2 py-1 text-center">{times?.delta ?? '—'}</td>
                        <td className="border px-2 py-1 text-center">
                          {times?.points != null ? times.points.toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
