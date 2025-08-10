'use client'

import { useEffect, useState } from 'react'

interface OverallResult {
  sail_number: string
  boat_name: string
  class_name: string
  skipper_name: string
  total_points: number
  per_race: {
    [raceName: string]: string | number
  }
}

interface ResultsViewerProps {
  regattaId: number
}

export default function ResultsViewer({ regattaId }: ResultsViewerProps) {
  const [results, setResults] = useState<OverallResult[]>([])
  const [loading, setLoading] = useState(true)
  const [raceNamesByClass, setRaceNamesByClass] = useState<{ [className: string]: string[] }>({})

  useEffect(() => {
    const fetchOverallResults = async () => {
      try {
        const res = await fetch(`http://localhost:8000/results/overall/${regattaId}`)
        const data = await res.json()

        setResults(data)

        // Construir lista de nomes de corridas por classe
        const grouped: { [className: string]: string[] } = {}
        data.forEach((r: OverallResult) => {
          const raceList = Object.keys(r.per_race)
          if (!grouped[r.class_name]) {
            grouped[r.class_name] = raceList
          }
        })

        setRaceNamesByClass(grouped)
      } catch (error) {
        console.error('Erro ao carregar os resultados gerais:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchOverallResults()
  }, [regattaId])

  if (loading) return <p className="text-gray-500">A carregar resultados...</p>
  if (results.length === 0) return <p className="text-gray-500">Sem resultados disponíveis.</p>

  // Agrupar resultados por classe
  const groupedResults: { [className: string]: OverallResult[] } = {}
  results.forEach((r) => {
    if (!groupedResults[r.class_name]) {
      groupedResults[r.class_name] = []
    }
    groupedResults[r.class_name].push(r)
  })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Classificação Geral por Classe</h2>

      {Object.entries(groupedResults).map(([className, classResults]) => {
        const raceNames = raceNamesByClass[className] || []

        return (
          <div key={className} className="mb-12">
            <h3 className="text-xl font-semibold mb-3">Classe: {className}</h3>

            <table className="table-auto w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1">#</th>
                  <th className="border px-2 py-1">Nº Vela</th>
                  <th className="border px-2 py-1">Embarcação</th>
                  <th className="border px-2 py-1">Timoneiro</th>
                  {raceNames.map((race) => (
                    <th key={race} className="border px-2 py-1">{race}</th>
                  ))}
                  <th className="border px-2 py-1 font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {classResults
                  .sort((a, b) => a.total_points - b.total_points)
                  .map((r, i) => (
                    <tr key={r.sail_number}>
                      <td className="border px-2 py-1">{i + 1}º</td>
                      <td className="border px-2 py-1">{r.sail_number}</td>
                      <td className="border px-2 py-1">{r.boat_name}</td>
                      <td className="border px-2 py-1">{r.skipper_name}</td>
                      {raceNames.map((race) => (
                        <td key={race} className="border px-2 py-1 text-center">{r.per_race[race] ?? '-'}</td>
                      ))}
                      <td className="border px-2 py-1 font-bold">{r.total_points}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
