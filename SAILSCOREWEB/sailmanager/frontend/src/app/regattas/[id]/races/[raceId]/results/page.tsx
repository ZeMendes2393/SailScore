'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { SailNumberDisplay } from '@/components/ui/SailNumberDisplay'
import { getApiBaseUrl } from '@/lib/api'
import { isAdminRole } from '@/lib/roles'
import notify from '@/lib/notify'
import { useConfirm } from '@/components/ConfirmDialog'

interface Result {
  id: number
  position: number
  sail_number: string
  boat_country_code?: string | null
  skipper_name: string
}

export default function RaceResultsPage() {
  const { user, token } = useAuth()
  const params = useParams<{ id: string; raceId: string }>()
  const raceId = params.raceId
  const confirm = useConfirm()

  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/results/races/${raceId}/results`, {
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
    const ok = await confirm({
      title: 'Delete this race result?',
      description: 'This action cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
    })
    if (!ok) return

    try {
      const res = await fetch(`${getApiBaseUrl()}/results/${resultId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (res.status === 204) {
        setResults((prev) => prev.filter((r) => r.id !== resultId))
        notify.success('Result deleted.')
      } else {
        notify.error('Failed to delete result.')
      }
    } catch (error) {
      console.error('Erro ao apagar resultado:', error)
      notify.error('Failed to delete result.')
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-2xl font-bold">
          Resultados da Corrida #{raceId}
        </h2>
        <a
          href={`${getApiBaseUrl()}/results/races/${raceId}/results/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-700 hover:text-blue-800 underline"
        >
          Download PDF
        </a>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : results.length === 0 ? (
        <p className="text-gray-500">No results for this race yet.</p>
      ) : (
        <table className="table-auto w-full border mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2">Pos</th>
              <th className="border px-4 py-2">Sail number</th>
              <th className="border px-4 py-2">Name</th>
              {isAdminRole(user?.role) && <th className="border px-4 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <td className="border px-4 py-2">{r.position}</td>
                <td className="border px-4 py-2"><SailNumberDisplay countryCode={r.boat_country_code} sailNumber={r.sail_number} /></td>
                <td className="border px-4 py-2">{r.skipper_name}</td>
                {isAdminRole(user?.role) && (
                  <td className="border px-4 py-2 text-center">
                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(r.id)}
                    >
                      Remove
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
