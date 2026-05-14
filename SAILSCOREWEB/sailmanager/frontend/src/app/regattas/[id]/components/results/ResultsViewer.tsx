'use client'

import { useEffect, useMemo, useState } from 'react'
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay'
import { getApiBaseUrl } from '@/lib/api'
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
  race_id?: number | null
  race_date?: string | null
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
  overall_rank?: number
  per_race: {
    [raceName: string]: string | number
  }
  per_race_fleet?: Record<string, string | null>
  per_race_times?: {
    [raceName: string]: RaceTimes
  }
  finals_fleet?: string | number | null
  boat_model?: string | null
  bow_number?: string | number | null
}
type RegattaEntryLite = {
  first_name?: string | null
  last_name?: string | null
  sail_number?: string | null
  boat_country_code?: string | null
  boat_name?: string | null
  class_name?: string | null
  crew_members?: Array<{
    first_name?: string | null
    last_name?: string | null
  }> | null
}

const FLEET_COLOR_CLASSES: Record<string, string> = {
  Yellow: 'bg-yellow-300',
  Blue: 'bg-blue-500',
  Red: 'bg-red-500',
  Green: 'bg-green-500',
  Gold: 'bg-yellow-500',
  Silver: 'bg-gray-400',
  Bronze: 'bg-amber-700',
  Emerald: 'bg-emerald-500',
}

interface ResultsViewerProps {
  regattaId: number
  selectedClass: string
}

export default function ResultsViewer({ regattaId, selectedClass }: ResultsViewerProps) {
  const [results, setResults] = useState<OverallResult[]>([])
  const [racesMeta, setRacesMeta] = useState<Record<string, RaceMeta>>({})
  const [classType, setClassType] = useState<string>('one_design')
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [resultsOverallColumns, setResultsOverallColumns] = useState<string[] | Record<string, string[]> | null>(null)
  const [selectedRaceForTimes, setSelectedRaceForTimes] = useState<string | null>(null)
  const [entriesByBoatKey, setEntriesByBoatKey] = useState<Map<string, string[]>>(new Map())

  useEffect(() => {
    const fetchRegatta = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/regattas/${regattaId}`)
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
        const url = `${getApiBaseUrl()}/results/overall/${regattaId}?class_name=${encodeURIComponent(selectedClass)}&public=1`
        const res = await fetch(url)
        const data = await res.json()
        if (Array.isArray(data)) {
          setResults(data)
          setRacesMeta({})
          setClassType('one_design')
          setPublishedAt(null)
        } else if (data && typeof data === 'object') {
          setResults(Array.isArray(data.rows) ? data.rows : [])
          setRacesMeta(data.races_meta ?? {})
          setClassType((data.class_type ?? 'one_design').toString().toLowerCase())
          setPublishedAt(data.published_at ?? null)
        } else {
          setResults([])
          setRacesMeta({})
          setClassType('one_design')
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

  useEffect(() => {
    if (!selectedClass) {
      setEntriesByBoatKey(new Map())
      return
    }
    const normalizeText = (v: string | null | undefined) => (v ?? '').trim().toUpperCase()
    const boatKey = (e: RegattaEntryLite) =>
      `${normalizeText(e.sail_number)}|${normalizeText(e.boat_country_code)}|${normalizeText(
        e.boat_name
      )}|${normalizeText(e.class_name)}`
    const boatLooseKey = (e: RegattaEntryLite) =>
      `${normalizeText(e.sail_number)}|${normalizeText(e.boat_country_code)}|${normalizeText(
        e.class_name
      )}`
    const sailClassKey = (e: RegattaEntryLite) =>
      `${normalizeText(e.sail_number)}|${normalizeText(e.class_name)}`
    const fetchEntries = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/entries/by_regatta/${regattaId}?include_waiting=1`)
        const data: RegattaEntryLite[] = await res.json()
        const next = new Map<string, string[]>()
        for (const entry of Array.isArray(data) ? data : []) {
          if ((entry.class_name ?? '').trim() !== selectedClass) continue
          const helmName = `${(entry.first_name ?? '').trim()} ${(entry.last_name ?? '').trim()}`.trim()
          const crewNames = Array.isArray(entry.crew_members)
            ? entry.crew_members
                .map((m) => `${(m?.first_name ?? '').trim()} ${(m?.last_name ?? '').trim()}`.trim())
                .filter(Boolean)
            : []
          const allBoatNames = [helmName, ...crewNames].filter(Boolean)
          if (allBoatNames.length === 0) continue
          const keys = [boatKey(entry), boatLooseKey(entry), sailClassKey(entry)]
          for (const key of keys) {
            const names = next.get(key) ?? []
            for (const personName of allBoatNames) {
              if (!names.some((n) => n.toUpperCase() === personName.toUpperCase())) {
                names.push(personName)
              }
            }
            next.set(key, names)
          }
        }
        setEntriesByBoatKey(next)
      } catch {
        setEntriesByBoatKey(new Map())
      }
    }
    fetchEntries()
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
  const normalizeText = (v: string | null | undefined) => (v ?? '').trim().toUpperCase()
  const boatKeyFromResult = (r: OverallResult) =>
    `${normalizeText(r.sail_number)}|${normalizeText(r.boat_country_code)}|${normalizeText(
      r.boat_name
    )}|${normalizeText(r.class_name)}`
  const boatLooseKeyFromResult = (r: OverallResult) =>
    `${normalizeText(r.sail_number)}|${normalizeText(r.boat_country_code)}|${normalizeText(
      r.class_name
    )}`
  const sailClassKeyFromResult = (r: OverallResult) =>
    `${normalizeText(r.sail_number)}|${normalizeText(r.class_name)}`
  const getCrewForResult = (r: OverallResult) => {
    const crew =
      entriesByBoatKey.get(boatKeyFromResult(r)) ??
      entriesByBoatKey.get(boatLooseKeyFromResult(r)) ??
      entriesByBoatKey.get(sailClassKeyFromResult(r))
    if (crew && crew.length > 0) return crew.join(', ')
    return r.skipper_name || '—'
  }

  if (loading) return <p className="text-gray-500">Loading results…</p>
  if (results.length === 0) return <p className="text-gray-500">No published results yet for this class.</p>

  const raceNames = (() => {
    const set = new Set<string>()
    results.forEach((r) => Object.keys(r.per_race || {}).forEach((k) => set.add(k)))
    return Array.from(set)
  })()

  const isHandicapClass = classType === 'handicap'
  const hasDetailForRace = (raceName: string) =>
    isHandicapClass &&
    results.some((r) => {
      const t = r.per_race_times?.[raceName]
      return t && (t.points != null || t.finish_time || t.elapsed_time || t.corrected_time || t.delta)
    })

  const sortedResults = [...results].sort(
    (a, b) => (a.overall_rank ?? 999) - (b.overall_rank ?? 999)
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
            href={`${getApiBaseUrl()}/results/overall/${regattaId}/pdf?class_name=${encodeURIComponent(selectedClass)}`}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 underline"
          >
            Download PDF
          </a>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <table className="table-auto w-full border-collapse text-sm text-slate-800">
        <thead className="bg-slate-50/95">
          <tr>
            {fixedColumnIds.map((id) => (
              <th
                key={id}
                className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                {RESULTS_OVERALL_COLUMNS.find((c) => c.id === id)?.label ?? id}
              </th>
            ))}
            {raceNames.map((race) => {
              const hasDetail = hasDetailForRace(race)
              const isSelected = selectedRaceForTimes === race
              return (
                <th
                  key={race}
                  className={`border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${
                    hasDetail ? 'cursor-pointer hover:bg-slate-100/90 select-none' : ''
                  } ${isSelected ? 'bg-blue-50 font-semibold text-blue-900' : ''}`}
                  onClick={() => hasDetail && setSelectedRaceForTimes((prev) => (prev === race ? null : race))}
                  title={
                    hasDetail
                      ? isSelected
                        ? 'Click to hide race detail'
                        : 'Click to show race detail'
                      : undefined
                  }
                >
                  {race}
                  {hasDetail && <span className="ml-1 text-xs opacity-70">⏱</span>}
                </th>
              )
            })}
            {visibleColumns.includes('total') && (
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-800">
                Total
              </th>
            )}
            {visibleColumns.includes('net') && (
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-800">
                Net
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedResults.map((r, i) => (
            <tr
              key={`${r.sail_number}-${r.class_name}-${i}`}
              className={i % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-100/60'}
            >
              {fixedColumnIds.map((id) => {
                if (id === 'place') return <td key={id} className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">{r.overall_rank != null ? `${r.overall_rank}º` : i + 1}</td>
                if (id === 'fleet') return <td key={id} className="border-b border-slate-100 px-3 py-2 text-center">{r.finals_fleet ?? '—'}</td>
                if (id === 'sail_no') return <td key={id} className="border-b border-slate-100 px-3 py-2"><SailNumberDisplay countryCode={r.boat_country_code} sailNumber={r.sail_number} /></td>
                if (id === 'boat') return <td key={id} className="border-b border-slate-100 px-3 py-2">{r.boat_name}</td>
                if (id === 'skipper') return <td key={id} className="border-b border-slate-100 px-3 py-2">{getCrewForResult(r)}</td>
                if (id === 'class') return <td key={id} className="border-b border-slate-100 px-3 py-2">{r.class_name}</td>
                if (id === 'model') return <td key={id} className="border-b border-slate-100 px-3 py-2">{r.boat_model ?? '—'}</td>
                if (id === 'bow') return <td key={id} className="border-b border-slate-100 px-3 py-2">{r.bow_number ?? '—'}</td>
                return <td key={id} className="border-b border-slate-100 px-3 py-2">—</td>
              })}
              {raceNames.map((race) => {
                const fleetLabel = r.per_race_fleet?.[race] ?? null
                const fleetColorClass = fleetLabel ? (FLEET_COLOR_CLASSES[fleetLabel] ?? 'bg-gray-400') : ''
                return (
                  <td key={race} className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">
                    <div className="flex items-center justify-center gap-1">
                      {fleetLabel && (
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${fleetColorClass}`}
                          title={fleetLabel}
                        />
                      )}
                      <span>{r.per_race[race] ?? '-'}</span>
                    </div>
                  </td>
                )
              })}
              {visibleColumns.includes('total') && (
                <td className="border-b border-slate-100 px-3 py-2 text-right font-semibold tabular-nums">{Number(r.total_points ?? 0).toFixed(2)}</td>
              )}
              {visibleColumns.includes('net') && (
                <td className="border-b border-slate-100 px-3 py-2 text-right font-bold tabular-nums">{Number(r.net_points ?? r.total_points ?? 0).toFixed(2)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

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
                  {(meta?.race_date || startTime) && (
                    <span className="text-sm text-gray-600">
                      {meta?.race_date
                        ? (() => {
                            try {
                              const [y, m, d] = (meta.race_date as string).split('-').map(Number)
                              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                              return `${d} ${months[(m || 1) - 1]} ${y}`
                            } catch {
                              return meta.race_date as string
                            }
                          })()
                        : ''}
                      {meta?.race_date && startTime ? ', ' : ''}
                      {startTime ? `Start: ${startTime}` : ''}
                    </span>
                  )}
                  {orcMode && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800">
                      Rating: {orcMode.charAt(0).toUpperCase() + orcMode.slice(1)}
                    </span>
                  )}
                  {meta?.race_id && (
                    <a
                      href={`${getApiBaseUrl()}/results/races/${meta.race_id}/results/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-700 hover:text-blue-800 underline ml-auto"
                    >
                      Download race PDF
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedRaceForTimes(null)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Close
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm mt-2">
                <table className="table-auto w-full border-collapse text-sm text-slate-800">
                  <thead>
                    <tr className="bg-slate-50/95">
                      <th className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">#</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Sail #</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Start</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Finish</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Elapsed</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Corrected</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Delta</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map(({ row, times }, di) => (
                      <tr
                        key={`${row.boat_country_code ?? ''}-${row.sail_number}-${selectedRaceForTimes}`}
                        className={di % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-100/60'}
                      >
                        <td className="border-b border-slate-100 px-2 py-2 text-center tabular-nums">{times?.position ?? '—'}</td>
                        <td className="border-b border-slate-100 px-2 py-2">
                          <SailNumberDisplay countryCode={row.boat_country_code} sailNumber={row.sail_number} />
                        </td>
                        <td className="border-b border-slate-100 px-2 py-2 text-center tabular-nums">{startTime ?? '—'}</td>
                        <td className="border-b border-slate-100 px-2 py-2 text-center">{times?.finish_time ?? '—'}</td>
                        <td className="border-b border-slate-100 px-2 py-2 text-center">{times?.elapsed_time ?? '—'}</td>
                        <td className="border-b border-slate-100 px-2 py-2 text-center">{times?.corrected_time ?? '—'}</td>
                        <td className="border-b border-slate-100 px-2 py-2 text-center tabular-nums">{times?.delta ?? '—'}</td>
                        <td className="border-b border-slate-100 px-2 py-2 text-center tabular-nums">
                          {times?.points != null ? times.points.toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
