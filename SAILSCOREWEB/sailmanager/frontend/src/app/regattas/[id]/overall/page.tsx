'use client'

import { useEffect, useState } from 'react'
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
  const [results, setResults] = useState<OverallResult[]>([])
  const [raceNames, setRaceNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOverallResults = async () => {
      try {
        const res = await fetch(`http://localhost:8000/results/overall/${regattaId}`)
        const data = await res.json()

        if (!Array.isArray(data)) {
          throw new Error("Formato inesperado da resposta")
        }

        setResults(data)

        // Extrair nomes únicos das regatas
        const uniqueNames = new Set<string>()
        data.forEach(r => {
          Object.keys(r.per_race).forEach(name => uniqueNames.add(name))
        })
        setRaceNames(Array.from(uniqueNames))
      } catch (error) {
        console.error('Erro ao carregar os resultados gerais:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchOverallResults()
  }, [regattaId])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">🏆 Classificação Geral</h2>

      {loading ? (
        <p className="text-gray-500">A carregar...</p>
      ) : results.length === 0 ? (
        <p className="text-gray-500">Ainda não há resultados.</p>
      ) : (
        <table className="table-auto w-full border mt-4 border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2">#</th>
              <th className="border px-4 py-2">Número de Vela</th>
              <th className="border px-4 py-2">Embarcação</th>
              <th className="border px-4 py-2">Classe</th>
              <th className="border px-4 py-2">Timoneiro</th>
              <th className="border px-4 py-2">Total de Pontos</th>
              {raceNames.map(name => (
                <th key={name} className="border px-4 py-2">{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.sail_number}>
                <td className="border px-4 py-2 font-bold">{i + 1}º</td>
                <td className="border px-4 py-2">{r.sail_number}</td>
                <td className="border px-4 py-2">{r.boat_name}</td>
                <td className="border px-4 py-2">{r.class_name}</td>
                <td className="border px-4 py-2">{r.skipper_name}</td>
                <td className="border px-4 py-2 font-semibold">{r.total_points}</td>
                {raceNames.map(name => (
                  <td key={name} className="border px-4 py-2 text-center">
                    {r.per_race[name] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
