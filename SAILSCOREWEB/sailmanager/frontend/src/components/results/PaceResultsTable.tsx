'use client'

import { Fragment, useEffect, useState } from 'react'
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay'
import { getApiBaseUrl } from '@/lib/api'

type PaceRow = {
  rank: number
  sail_number?: string | null
  boat_country_code?: string | null
  boat_name?: string | null
  class_name?: string | null
  skipper_name?: string | null
  total_elapsed_time?: string | null
  total_time?: string | null
  total_distance?: number | null
  miles?: number | null
  time_per_mile?: string | null
  races_counted?: number | null
  per_race?: Record<string, {
    race_id?: number | null
    race_name?: string | null
    distance?: number | null
    elapsed_time?: string | null
  }>
}

type PaceRaceColumn = {
  race_id: number
  name: string
  class_name?: string | null
  distance?: number | null
}

type PaceResponse = {
  enabled?: boolean
  table_name?: string | null
  race_columns?: PaceRaceColumn[]
  rows?: PaceRow[]
}

type Props = {
  regattaId: number
  selectedClass: string
  publicResults?: boolean
  className?: string
}

export default function PaceResultsTable({
  regattaId,
  selectedClass,
  publicResults = false,
  className = '',
}: Props) {
  const [data, setData] = useState<PaceResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedClass) {
      setData(null)
      return
    }

    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const url = `${getApiBaseUrl()}/results/pace/${regattaId}?class_name=${encodeURIComponent(
          selectedClass
        )}&public=${publicResults ? '1' : '0'}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to load Time/Mile results')
        const payload: PaceResponse = await res.json()
        if (!cancelled) setData(payload)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [regattaId, selectedClass, publicResults])

  const rows = data?.rows ?? []
  const raceColumns = (data?.race_columns ?? []).filter((race) =>
    rows.some((row) => row.per_race?.[String(race.race_id)])
  )
  if (loading || !data?.enabled || rows.length === 0) return null

  return (
    <section className={`mt-10 ${className}`}>
      <h3 className="text-xl font-bold mb-3">{data.table_name || 'Time per mile'}</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <table className="table-auto w-full border-collapse text-sm text-slate-800">
          <thead className="bg-slate-50/95">
            <tr>
              <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">#</th>
              <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Sail #</th>
              <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Boat</th>
              <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Crew</th>
              <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Class</th>
              {raceColumns.map((race) => (
                <th
                  key={race.race_id}
                  colSpan={2}
                  className="border-b border-l border-slate-200 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  {race.name}
                </th>
              ))}
              <th rowSpan={2} className="border-b border-l border-slate-200 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Distance total</th>
              <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Time total</th>
              <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Time/Mile</th>
              <th rowSpan={2} className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Races</th>
            </tr>
            <tr>
              {raceColumns.map((race) => (
                <Fragment key={race.race_id}>
                  <th key={`${race.race_id}-distance`} className="border-b border-l border-slate-200 px-2 py-2 text-right text-[11px] font-medium text-slate-600">Distance</th>
                  <th key={`${race.race_id}-time`} className="border-b border-slate-200 px-2 py-2 text-right text-[11px] font-medium text-slate-600">Time</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.class_name ?? ''}-${row.boat_country_code ?? ''}-${row.sail_number ?? ''}-${index}`}
                className={index % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-100/60'}
              >
                <td className="border-b border-slate-100 px-3 py-2 text-center tabular-nums">{row.rank}</td>
                <td className="border-b border-slate-100 px-3 py-2">
                  <SailNumberDisplay countryCode={row.boat_country_code} sailNumber={row.sail_number ?? ''} />
                </td>
                <td className="border-b border-slate-100 px-3 py-2">{row.boat_name || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2">{row.skipper_name || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2">{row.class_name || '—'}</td>
                {raceColumns.map((race) => {
                  const detail = row.per_race?.[String(race.race_id)]
                  return (
                    <Fragment key={race.race_id}>
                      <td key={`${race.race_id}-distance`} className="border-b border-l border-slate-100 px-2 py-2 text-right tabular-nums">
                        {detail?.distance != null ? Number(detail.distance).toFixed(2) : '—'}
                      </td>
                      <td key={`${race.race_id}-time`} className="border-b border-slate-100 px-2 py-2 text-right tabular-nums">
                        {detail?.elapsed_time || '—'}
                      </td>
                    </Fragment>
                  )
                })}
                <td className="border-b border-l border-slate-100 px-3 py-2 text-right font-semibold tabular-nums">
                  {row.total_distance != null ? Number(row.total_distance).toFixed(2) : row.miles != null ? Number(row.miles).toFixed(2) : '—'}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-right font-semibold tabular-nums">{row.total_time || row.total_elapsed_time || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-right font-semibold tabular-nums">{row.time_per_mile || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums">{row.races_counted ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
