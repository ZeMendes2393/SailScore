'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

interface Props {
  regattaId: number
  newlyCreatedRace?: {
    id: number
    name: string
    regatta_id: number
    class_name: string
  } | null
}

interface Entry {
  id: number
  class_name: string
  first_name: string
  last_name: string
  club: string
  sail_number?: string
  boat_name?: string
  regatta_id?: number
}

interface Race {
  id: number
  name: string
  regatta_id: number
  class_name: string
}

interface DraftResult {
  position: number
  entryId: number
}

interface ApiResult {
  id: number
  regatta_id: number
  race_id: number
  sail_number: string | null
  boat_name: string | null
  class_name: string
  skipper_name: string | null
  position: number
  points: number
}

export default function RaceResultsManager({ regattaId, newlyCreatedRace }: Props) {
  const { token } = useAuth()

  const [entryList, setEntryList] = useState<Entry[]>([])
  const [races, setRaces] = useState<Race[]>([])
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  // rascunho (bulk)
  const [draftResults, setDraftResults] = useState<DraftResult[]>([])
  const [inputValue, setInputValue] = useState('')

  // existentes (API)
  const [existingResults, setExistingResults] = useState<ApiResult[]>([])
  const [loadingExisting, setLoadingExisting] = useState(false)

  // adicionar 1 em falta
  const [singleSail, setSingleSail] = useState('')
  const [singlePos, setSinglePos] = useState<number | ''>('')

  // helper p/ headers tipados
  const buildHeaders = (tok?: string): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(tok ? { Authorization: `Bearer ${tok}` } : {})
  })

  const refreshExisting = async (raceId: number) => {
    setLoadingExisting(true)
    try {
      const res = await fetch(`http://localhost:8000/results/races/${raceId}/results`)
      if (!res.ok) {
        const txt = await res.text()
        console.error('GET resultados falhou:', res.status, txt)
        setExistingResults([])
        return
      }
      const data: ApiResult[] = await res.json()
      setExistingResults(data)
    } catch (e) {
      console.error('GET resultados erro:', e)
      setExistingResults([])
    } finally {
      setLoadingExisting(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      const [entriesRes, racesRes] = await Promise.all([
        fetch(`http://localhost:8000/entries/by_regatta/${regattaId}`),
        fetch(`http://localhost:8000/races/by_regatta/${regattaId}`)
      ])
      setEntryList(await entriesRes.json())
      const r = await racesRes.json()
      setRaces(r)
    })()
  }, [regattaId])

  useEffect(() => {
    if (!newlyCreatedRace) return
    setRaces(prev => [...prev, newlyCreatedRace])
    setSelectedRaceId(newlyCreatedRace.id)
    setSelectedClass(newlyCreatedRace.class_name)
    setDraftResults([])
    setExistingResults([])
  }, [newlyCreatedRace])

  useEffect(() => {
    if (!selectedRaceId) return
    refreshExisting(selectedRaceId)
  }, [selectedRaceId])

  const getEntryById = (id: number) => entryList.find(e => e.id === id)

  const availableEntries = useMemo(
    () =>
      entryList.filter(
        e =>
          e.class_name === selectedClass &&
          !draftResults.some(r => r.entryId === e.id)
      ),
    [entryList, selectedClass, draftResults]
  )

  // ---------- DRAFT (bulk) ----------
  const handleAddBySailNumber = () => {
    const trimmed = inputValue.trim().toLowerCase()
    if (!trimmed) return

    const matched = entryList.find(e => (e.sail_number || '').toLowerCase() === trimmed)

    if (!matched) {
      alert('Embarcação não encontrada com esse número de vela.')
      return
    }
    if (selectedClass && matched.class_name !== selectedClass) {
      alert(`Esta embarcação não pertence à classe ${selectedClass}.`)
      return
    }
    if (draftResults.some(r => r.entryId === matched.id)) {
      alert('Essa embarcação já foi adicionada (em rascunho).')
      return
    }

    const nextPosition = draftResults.length + 1
    setDraftResults([...draftResults, { position: nextPosition, entryId: matched.id }])
    setInputValue('')
  }

  const handleRemoveDraft = (entryId: number) => {
    const updated = draftResults.filter(r => r.entryId !== entryId)
    setDraftResults(updated.map((r, i) => ({ ...r, position: i + 1 })))
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newResults = [...draftResults]
    ;[newResults[index - 1], newResults[index]] = [newResults[index], newResults[index - 1]]
    setDraftResults(newResults.map((r, i) => ({ ...r, position: i + 1 })))
  }

  const handleMoveDown = (index: number) => {
    if (index === draftResults.length - 1) return
    const newResults = [...draftResults]
    ;[newResults[index + 1], newResults[index]] = [newResults[index], newResults[index + 1]]
    setDraftResults(newResults.map((r, i) => ({ ...r, position: i + 1 })))
  }

  const handleSaveResults = async () => {
    if (!selectedRaceId) return
    if (!token) {
      alert('Token em falta. Faz login novamente.')
      return
    }

    const payload = draftResults.map(r => {
      const entry = getEntryById(r.entryId)!
      return {
        regatta_id: regattaId,
        race_id: selectedRaceId,
        sail_number: entry.sail_number,
        boat_name: entry.boat_name,
        // boat_class removido: backend força pela Race
        helm_name: `${entry.first_name} ${entry.last_name}`,
        position: r.position,
        points: r.position
      }
    })

    const res = await fetch(`http://localhost:8000/results/races/${selectedRaceId}/results`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      alert('Resultados guardados com sucesso.')
      setDraftResults([])
      await refreshExisting(selectedRaceId)
    } else {
      const txt = await res.text()
      console.error('POST bulk falhou:', res.status, txt)
      alert('Erro ao guardar resultados.')
    }
  }

  // ---------- EXISTING (edição / mover / reordenar) ----------
  const moveRow = async (rowId: number, delta: -1 | 1) => {
    if (!selectedRaceId || !token || loadingExisting) return

    const sorted = existingResults.slice().sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex(r => r.id === rowId)
    if (idx < 0) return

    const targetIdx = idx + delta
    if (targetIdx < 0 || targetIdx >= sorted.length) return

    const newPos = sorted[targetIdx].position
    const res = await fetch(`http://localhost:8000/results/${rowId}/position`, {
      method: 'PATCH',
      headers: buildHeaders(token),
      body: JSON.stringify({ new_position: newPos })
    })

    if (res.ok) {
      await refreshExisting(selectedRaceId)
    } else {
      const txt = await res.text()
      console.error('PATCH mover falhou:', res.status, txt)
      alert(`Não foi possível mover. (${res.status})`)
    }
  }

  const savePosition = async (rowId: number, newPos: number) => {
    if (!selectedRaceId || !token || newPos <= 0) return

    const res = await fetch(`http://localhost:8000/results/${rowId}/position`, {
      method: 'PATCH',
      headers: buildHeaders(token),
      body: JSON.stringify({ new_position: newPos })
    })

    if (res.ok) {
      await refreshExisting(selectedRaceId)
    } else {
      const txt = await res.text()
      console.error('PATCH posição falhou:', res.status, txt)
      alert('Não foi possível atualizar a posição.')
    }
  }

  const saveOrder = async () => {
    if (!selectedRaceId || !token) return
    const ordered = existingResults.slice().sort((a, b) => a.position - b.position).map(r => r.id)

    const res = await fetch(`http://localhost:8000/results/races/${selectedRaceId}/reorder`, {
      method: 'PUT',
      headers: buildHeaders(token),
      body: JSON.stringify({ ordered_ids: ordered })
    })

    if (res.ok) {
      await refreshExisting(selectedRaceId)
      alert('Ordem guardada.')
    } else {
      const txt = await res.text()
      console.error('PUT reorder falhou:', res.status, txt)
      alert('Falha ao guardar a ordem.')
    }
  }

  // ---------- Adicionar 1 em falta ----------
  const addSingleMissing = async () => {
    if (!selectedRaceId || !token) return
    const sail = singleSail.trim().toLowerCase()
    const pos = Number(singlePos)
    if (!sail || !pos) {
      alert('Preenche Nº de vela e posição.')
      return
    }

    const entry = entryList.find(
      e => (e.sail_number || '').toLowerCase() === sail && e.class_name === selectedClass
    )
    if (!entry) {
      alert('Entrada não encontrada para esta classe.')
      return
    }

    const payload = {
      regatta_id: regattaId,
      sail_number: entry.sail_number ?? null,
      boat_name: entry.boat_name ?? null,
      helm_name: `${entry.first_name} ${entry.last_name}`,
      points: pos,
      desired_position: pos
    }

    const res = await fetch(`http://localhost:8000/results/races/${selectedRaceId}/result`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      setSingleSail('')
      setSinglePos('')
      await refreshExisting(selectedRaceId)
    } else {
      const txt = await res.text()
      console.error('POST add-single falhou:', res.status, txt)
      alert('Não foi possível adicionar.')
    }
  }

  return (
    <div className="p-4 border rounded bg-gray-50">
      <h3 className="text-lg font-bold mb-2">Gerir Resultados</h3>

      <label className="block mb-2 text-sm font-medium text-gray-700">
        Seleciona uma corrida:
      </label>
      <select
        className="border rounded p-2 w-full mb-4"
        value={selectedRaceId || ''}
        onChange={(e) => {
          const raceId = Number(e.target.value)
          setSelectedRaceId(raceId)
          setDraftResults([])
          const selected = races.find(r => r.id === raceId)
          setSelectedClass(selected?.class_name || null)
          // sinalizar carregamento enquanto busca resultados da nova corrida
          setExistingResults([])
          setLoadingExisting(true)
        }}
      >
        <option value="">-- Escolher corrida --</option>
        {races.map(race => (
          <option key={race.id} value={race.id}>
            {race.name} ({race.class_name})
          </option>
        ))}
      </select>

      {/* EXISTENTES */}
      {selectedRaceId && (
        <div className="mb-6">
          <h4 className="text-md font-semibold mb-2">Resultados existentes</h4>
          {loadingExisting ? (
            <p className="text-gray-500">A carregar…</p>
          ) : existingResults.length === 0 ? (
            <p className="text-gray-500">Sem resultados guardados para esta corrida.</p>
          ) : (
            <>
              <table className="w-full text-sm border border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1">Vela</th>
                    <th className="border px-2 py-1">Timoneiro</th>
                    <th className="border px-2 py-1 text-center">Posição</th>
                    <th className="border px-2 py-1 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {existingResults
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((row) => (
                      <tr key={row.id}>
                        <td className="border px-2 py-1">{row.sail_number}</td>
                        <td className="border px-2 py-1">{row.skipper_name}</td>
                        <td className="border px-2 py-1 text-center">
                          <input
                            type="number"
                            min={1}
                            className="w-24 border rounded px-2 py-1 text-center"
                            value={row.position}
                            disabled={loadingExisting}
                            onChange={(e) => {
                              const v = Number(e.target.value)
                              setExistingResults(prev =>
                                prev.map(p => (p.id === row.id ? { ...p, position: v } : p))
                              )
                            }}
                            onBlur={(e) => {
                              const v = Number(e.target.value)
                              if (v >= 1) {
                                savePosition(row.id, v)  // chama sempre
                              }
                            }}
                          />
                        </td>
                        <td className="border px-2 py-1 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              disabled={loadingExisting}
                              onClick={() => moveRow(row.id, -1)}
                              className="px-2 py-1 rounded border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Subir"
                            >
                              ↑
                            </button>
                            <button
                              disabled={loadingExisting}
                              onClick={() => moveRow(row.id, +1)}
                              className="px-2 py-1 rounded border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Descer"
                            >
                              ↓
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              <div className="mt-3 text-right">
                <button
                  disabled={loadingExisting}
                  onClick={saveOrder}
                  className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Guardar ordem
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ADICIONAR 1 EM FALTA */}
      {selectedRaceId && (
        <div className="mb-6 p-3 border rounded bg-white">
          <h4 className="text-md font-semibold mb-2">Adicionar resultado em falta</h4>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Nº vela (ex: POR123)"
              value={singleSail}
              onChange={(e) => setSingleSail(e.target.value)}
              className="border rounded px-3 py-2 w-60"
            />
            <input
              type="number"
              min={1}
              placeholder="Posição"
              value={singlePos}
              onChange={(e) => setSinglePos(e.target.value ? Number(e.target.value) : '')}
              className="border rounded px-3 py-2 w-32"
            />
            <button
              onClick={addSingleMissing}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Adicionar
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Esta ação insere na posição indicada e ajusta automaticamente as restantes posições.
          </p>
        </div>
      )}

      {/* RASCUNHO / BULK */}
      {selectedRaceId && (
        <div>
          <label className="block mb-2 text-sm">Adicionar por nº de vela (rascunho):</label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBySailNumber()}
            className="border rounded p-2 w-full mb-2"
            placeholder="Ex: POR123"
          />
          <button
            onClick={handleAddBySailNumber}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            ➕ Adicionar ao rascunho
          </button>

          {availableEntries.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">
                Inscritos disponíveis ({availableEntries.length}):
              </h4>
              <ul className="space-y-1">
                {availableEntries.map(entry => (
                  <li
                    key={entry.id}
                    className="flex justify-between items-center p-2 border rounded bg-white hover:bg-gray-50"
                  >
                    <span>
                      {entry.sail_number} — {entry.first_name} {entry.last_name} ({entry.club})
                    </span>
                    <button
                      onClick={() => {
                        const nextPosition = draftResults.length + 1
                        setDraftResults([...draftResults, { position: nextPosition, entryId: entry.id }])
                      }}
                      className="text-sm text-green-600 hover:underline"
                    >
                      Adicionar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draftResults.length > 0 && (
            <>
              <ul className="mt-6 space-y-2">
                {draftResults.map((r, i) => {
                  const entry = getEntryById(r.entryId)
                  return (
                    <li key={r.entryId} className="flex justify-between items-center border p-2 rounded">
                      <span>
                        <strong>{r.position}º</strong> – {entry?.sail_number} ({entry?.first_name} {entry?.last_name})
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => handleMoveUp(i)} className="text-blue-600 hover:underline">↑</button>
                        <button onClick={() => handleMoveDown(i)} className="text-blue-600 hover:underline">↓</button>
                        <button onClick={() => handleRemoveDraft(r.entryId)} className="text-red-600 hover:underline">Remover</button>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <button
                onClick={handleSaveResults}
                className="mt-4 bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800"
              >
                💾 Guardar Resultados (em massa)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
