'use client'

import { useState } from 'react'
import RaceCreator from './components/RaceCreator'
import RaceResultsManager from './components/RaceResultsManager'
import Link from 'next/link'

interface Props {
  regattaId: number
}

export default function AdminResultsClient({ regattaId }: Props) {
  const [newlyCreatedRace, setNewlyCreatedRace] = useState<{
    id: number
    name: string
    regatta_id: number
    class_name: string
  } | null>(null)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Gestão de Resultados da Regata</h2>

      <RaceCreator
        regattaId={regattaId}
        onRaceCreated={(race) => {
          setNewlyCreatedRace(race)
        }}
      />

<RaceResultsManager
  regattaId={regattaId}
  newlyCreatedRace={newlyCreatedRace}
/>

      <div className="mt-10">
        <Link
          href={`/regattas/${regattaId}/overall`}
          className="inline-block bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
        >
          Ver Resultados Gerais 🏆
        </Link>
      </div>
    </div>
  )
}
