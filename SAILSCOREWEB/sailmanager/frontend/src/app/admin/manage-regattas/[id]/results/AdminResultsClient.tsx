'use client'

import RaceList from '../../../../regattas/[id]/components/results/RaceList'
import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'

interface Entry {
  id: number
  class_name: string
  first_name: string
  last_name: string
  club: string
  sail_number?: string
  boat_name?: string
}

interface Race {
  id: number
  name: string
  regatta_id: number
}

interface Result {
  position: number
  entryId: number
}

interface Props {
  regattaId: number
}

export default function AdminResultsClient({ regattaId }: Props) {
  const [entryList, setEntryList] = useState<Entry[]>([])
  const [races, setRaces] = useState<Race[]>([])
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null)
  const [results, setResults] = useState<Result[]>([])
  const [inputValue, setInputValue] = useState('')
  const [savedResults, setSavedResults] = useState<Result[]>([])
  const { token } = useAuth()
  const [showRaceList, setShowRaceList] = useState(false)

  useEffect(() => {
    const fetchEntries = async () => {
      const res = await fetch(`http://localhost:8000/entries/by_regatta/${regattaId}`)
      const data = await res.json()
      setEntryList(data)
    }

    const fetchRaces = async () => {
      const res = await fetch(`http://localhost:8000/races/by_regatta/${regattaId}`)
      const data = await res.json()
      setRaces(data)
    }

    fetchEntries()
    fetchRaces()
  }, [regattaId])

  useEffect(() => {
    if (!selectedRaceId) return

    const fetchSaved = async () => {
      const res = await fetch(`http://localhost:8000/results/races/${selectedRaceId}/results`)
      const data = await res.json()
      setSavedResults(data)
    }

    fetchSaved()
  }, [selectedRaceId])

  const handleAddBySailNumber = () => {
    const trimmed = inputValue.trim().toLowerCase()
    if (!trimmed) return

    const matched = entryList.find(e => e.sail_number?.toLowerCase() === trimmed)

    if (!matched) {
      alert('Embarcação não encontrada com esse número de vela.')
      return
    }

    const alreadyIn = results.some(r => r.entryId === matched.id)
    if (alreadyIn) {
      alert('Essa embarcação já foi adicionada.')
      return
    }

    const nextPosition = results.length + 1
    setResults([...results, { position: nextPosition, entryId: matched.id }])
    setInputValue('')
  }

  const handleRemove = (entryId: number) => {
    const updated = results.filter(r => r.entryId !== entryId)
    setResults(updated.map((r, i) => ({ ...r, position: i + 1 })))
  }

  const getEntryById = (id: number) => entryList.find(e => e.id === id)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddBySailNumber()
    }
  }

  const handleSaveResults = async () => {
    if (!selectedRaceId) {
      alert('Seleciona uma corrida primeiro.')
      return
    }

    if (results.length === 0) {
      alert('Adiciona pelo menos uma embarcação.')
      return
    }

    if (!token) {
      alert('Token não encontrado. Faz login novamente.')
      return
    }

    const payload = results.map(r => {
      const entry = getEntryById(r.entryId)!
      return {
        regatta_id: regattaId,
        race_id: selectedRaceId,
        sail_number: entry.sail_number,
        boat_name: entry.boat_name,
        boat_class: entry.class_name,
        helm_name: `${entry.first_name} ${entry.last_name}`,
        position: r.position,
        points: r.position
      }
    })

    const res = await fetch(`http://localhost:8000/results/races/${selectedRaceId}/results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      alert('Erro ao guardar resultados.')
      return
    }

    const updated = await res.json()
    setSavedResults(updated)
    setResults([])
    alert('Resultados guardados com sucesso.')
  }

  const createRace = async () => {
    const name = prompt("Nome da nova corrida (ex: Corrida 1):")
    if (!name) return

    const date = new Date().toISOString().split("T")[0]
    const res = await fetch("http://localhost:8000/races", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regatta_id: regattaId, name, date })
    })

    if (!res.ok) {
      alert("Erro ao criar corrida.")
      return
    }

    const newRace = await res.json()
    setRaces([...races, newRace])
    setSelectedRaceId(newRace.id)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Resultados da Corrida</h2>

      {/* Select de corrida */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Seleciona uma corrida:</label>
        <select
          className="border rounded p-2 w-full"
          value={selectedRaceId || ''}
          onChange={(e) => {
            setSelectedRaceId(Number(e.target.value))
            setResults([])
            setSavedResults([])
          }}
        >
          <option value="">-- Escolher corrida --</option>
          {races.map(race => (
            <option key={race.id} value={race.id}>{race.name}</option>
          ))}
        </select>

        {/* Botões adicionais */}
        <div className="mt-4 flex gap-4 flex-wrap">
          <button
            onClick={createRace}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            ➕ Criar Nova Corrida
          </button>

          <button
            onClick={() => setShowRaceList(prev => !prev)}
            className="bg-gray-100 border border-gray-300 px-4 py-2 rounded hover:bg-gray-200"
          >
            {showRaceList ? 'Esconder Corridas Criadas' : 'Ver Corridas Criadas'}
          </button>
        </div>

        {showRaceList && (
          <div className="mt-4">
            <RaceList races={races} regattaId={regattaId} />
          </div>
        )}
      </div>

      {selectedRaceId && (
        <>
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreve o número de vela e carrega em Enter"
              className="border rounded p-2 flex-1"
            />
            <button
              onClick={handleAddBySailNumber}
              className="bg-green-600 text-white px-4 rounded hover:bg-green-700"
            >
              Adicionar
            </button>
          </div>

          {results.length > 0 && (
            <table className="table-auto w-full border mt-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-4 py-2">Posição</th>
                  <th className="border px-4 py-2">Número de Vela</th>
                  <th className="border px-4 py-2">Nome</th>
                  <th className="border px-4 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => {
                  const entry = getEntryById(r.entryId)
                  if (!entry) return null
                  return (
                    <tr key={entry.id}>
                      <td className="border px-4 py-2">{r.position}º</td>
                      <td className="border px-4 py-2">{entry.sail_number}</td>
                      <td className="border px-4 py-2">{entry.first_name} {entry.last_name}</td>
                      <td className="border px-4 py-2 text-center">
                        <button
                          onClick={() => handleRemove(entry.id)}
                          className="text-red-600 hover:underline"
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <button
            onClick={handleSaveResults}
            className="mt-6 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Guardar Resultados
          </button>

          {savedResults.length > 0 && (
            <div className="mt-10">
              <h3 className="text-xl font-semibold mb-2">Resultados Guardados</h3>
              <table className="table-auto w-full border mt-2">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-4 py-2">Posição</th>
                    <th className="border px-4 py-2">Número de Vela</th>
                    <th className="border px-4 py-2">Nome</th>
                  </tr>
                </thead>
                <tbody>
                  {savedResults.map((r: any, index) => (
                    <tr key={index}>
                      <td className="border px-4 py-2">{r.position}º</td>
                      <td className="border px-4 py-2">{r.sail_number}</td>
                      <td className="border px-4 py-2">{r.helm_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <Link
  href={`/regattas/${regattaId}/overall`}
  className="inline-block bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 mt-8"
>
  Ver Resultados Gerais 🏆
</Link>

    </div>
  )
}
