'use client'

import { useEffect, useState } from 'react'
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
  miles?: number | null
  time_per_mile?: string | null
  races_counted?: number | null
}

type PaceResponse = {
  enabled?: boolean
  table_name?: string | null
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
  if (loading || !data?.enabled || rows.length === 0) return null

  return (
    <section className={`mt-10 ${className}`}>
      <h3 className="text-xl font-bold mb-3">{data.table_name || 'Time per mile'}</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <table className="table-auto w-full border-collapse text-sm text-slate-800">
          <thead className="bg-slate-50/95">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">#</th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Sail #</th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Boat</th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Crew</th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Class</th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Total elapsed</th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Miles</th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Time/Mile</th>
              <th className="border-b border-slate-200 px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Races</th>
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
                <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums">{row.total_elapsed_time || '—'}</td>
                <td className="border-b border-slate-100 px-3 py-2 text-right tabular-nums">
                  {row.miles != null ? Number(row.miles).toFixed(2) : '—'}
                </td>
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
