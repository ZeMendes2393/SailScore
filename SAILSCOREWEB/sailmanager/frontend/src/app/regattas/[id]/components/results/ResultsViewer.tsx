'use client'

import { useEffect, useMemo, useState } from 'react'
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay'
import { BASE_URL } from '@/lib/api'
import {
  getVisibleResultsOverallColumnsForClass,
  RESULTS_OVERALL_COLUMNS,
  type ResultsOverallColumnId,
} from '@/lib/resultsOverallColumns'

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
  const [loading, setLoading] = useState(true)
  const [resultsOverallColumns, setResultsOverallColumns] = useState<string[] | Record<string, string[]> | null>(null)

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
        setResults(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Error loading overall results:', error)
        setResults([])
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

  const fixedColumnIds = visibleColumns.filter((id) => id !== 'total' && id !== 'net')

  if (loading) return <p className="text-gray-500">Loading results…</p>
  if (results.length === 0) return <p className="text-gray-500">No published results yet for this class.</p>

  const raceNames = (() => {
    const set = new Set<string>()
    results.forEach((r) => Object.keys(r.per_race || {}).forEach((k) => set.add(k)))
    return Array.from(set)
  })()

  const sortedResults = [...results].sort(
    (a, b) => (a.net_points ?? a.total_points) - (b.net_points ?? b.total_points) || a.total_points - b.total_points
  )

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Overall — {selectedClass}</h2>

      <table className="table-auto w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            {fixedColumnIds.map((id) => (
              <th key={id} className="border px-2 py-1">
                {RESULTS_OVERALL_COLUMNS.find((c) => c.id === id)?.label ?? id}
              </th>
            ))}
            {raceNames.map((race) => (
              <th key={race} className="border px-2 py-1">{race}</th>
            ))}
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
    </div>
  )
}
