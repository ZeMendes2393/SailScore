'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

interface Result {
  id: number
  position: number
  sail_number: string
  skipper_name: string
}

export default function RaceResultsPage() {
  const { user, token } = useAuth()
  const params = useParams<{ id: string; raceId: string }>()
  const raceId = params.raceId

  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`http://localhost:8000/results/races/${raceId}/results`, {
          cache: 'no-store',
          credentials: 'include',
        })

        if (!res.ok) {
          setResults([])
        } else {
          const data = await res.json()
          setResults(data)
        }
      } catch (err) {
        console.error('Erro ao carregar resultados:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [raceId])

  const handleDelete = async (resultId: number) => {
    const confirm = window.confirm('Tens a certeza que queres apagar este resultado?')
    if (!confirm) return

    try {
      const res = await fetch(`http://localhost:8000/results/${resultId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 204) {
        setResults((prev) => prev.filter((r) => r.id !== resultId))
      } else {
        alert('Erro ao apagar resultado.')
      }
    } catch (error) {
      console.error('Erro ao apagar resultado:', error)
      alert('Erro ao apagar resultado.')
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">
        Resultados da Corrida #{raceId}
      </h2>

      {loading ? (
        <p className="text-gray-500">A carregar...</p>
      ) : results.length === 0 ? (
        <p className="text-gray-500">Sem resultados para esta corrida.</p>
      ) : (
        <table className="table-auto w-full border mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2">Posição</th>
              <th className="border px-4 py-2">Número de Vela</th>
              <th className="border px-4 py-2">Nome</th>
              {user?.role === 'admin' && <th className="border px-4 py-2">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <td className="border px-4 py-2">{r.position}º</td>
                <td className="border px-4 py-2">{r.sail_number}</td>
                <td className="border px-4 py-2">{r.skipper_name}</td>
                {user?.role === 'admin' && (
                  <td className="border px-4 py-2 text-center">
                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(r.id)}
                    >
                      Remover
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
