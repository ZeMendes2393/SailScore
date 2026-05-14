'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import notify from '@/lib/notify'

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
        No races have been created for this regatta yet.
      </p>
    )
  }

  const handleGoToResults = () => {
    if (selectedRaceId) {
      router.push(`/regattas/${regattaId}/races/${selectedRaceId}/results`)
    } else {
      notify.warning('Please select a race first.')
    }
  }

  return (
    <div>
      <select
        className="border rounded p-2 w-full"
        value={selectedRaceId ?? ''}
        onChange={(e) => setSelectedRaceId(Number(e.target.value))}
      >
        <option value="">-- Choose a race --</option>
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
