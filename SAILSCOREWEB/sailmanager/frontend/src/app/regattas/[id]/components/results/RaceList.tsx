'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Race {
  id: number
  name: string
}

interface Props {
  races: Race[]
  regattaId: number
}

export default function RaceList({ races, regattaId }: Props) {
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null)
  const router = useRouter()

  if (races.length === 0) {
    return (
      <p className="text-gray-500">
        Nenhuma corrida ainda foi criada para esta regata.
      </p>
    )
  }

  const handleGoToResults = () => {
    if (selectedRaceId) {
      router.push(`/regattas/${regattaId}/races/${selectedRaceId}/results`)
    } else {
      alert('Seleciona uma corrida primeiro.')
    }
  }

  return (
    <div>
      <select
        className="border rounded p-2 w-full"
        value={selectedRaceId ?? ''}
        onChange={(e) => setSelectedRaceId(Number(e.target.value))}
      >
        <option value="">-- Escolher corrida --</option>
        {races.map((race) => (
          <option key={race.id} value={race.id}>
            {race.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleGoToResults}
        className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Ver Resultados
      </button>
    </div>
  )
}
