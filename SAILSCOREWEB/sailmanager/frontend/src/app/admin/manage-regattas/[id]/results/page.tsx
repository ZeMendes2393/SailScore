'use client'

import { useEffect, useState } from 'react'

interface Entry {
  id: string
  sailor_name: string
  sail_number: string
}

interface Result {
  position: number
  entryId: string | null
}

export default function ResultsPage({ params }: { params: { id: string } }) {
  const [entryList, setEntryList] = useState<Entry[]>([])
  const [results, setResults] = useState<Result[]>([])

  // Simulação de fetch da entry list
  useEffect(() => {
    // Aqui deves fazer fetch real à API da entry list com o ID da regata
    const fakeEntries: Entry[] = [
      { id: '1', sailor_name: 'José Mendes', sail_number: 'POR 123' },
      { id: '2', sailor_name: 'João Santos', sail_number: 'POR 456' },
      { id: '3', sailor_name: 'Maria Silva', sail_number: 'POR 789' }
    ]
    setEntryList(fakeEntries)

    // Inicializar posições
    const initialResults = Array.from({ length: fakeEntries.length }, (_, i) => ({
      position: i + 1,
      entryId: null
    }))
    setResults(initialResults)
  }, [])

  // Handler para atualizar resultados
  const handleChange = (index: number, entryId: string) => {
    const updated = [...results]
    updated[index].entryId = entryId
    setResults(updated)
  }

  // Handler para guardar (ex: POST para API)
  const handleSaveResults = () => {
    const filled = results.every(r => r.entryId !== null)
    if (!filled) {
      alert('Preenche todas as posições antes de guardar.')
      return
    }

    // Aqui envias para o backend
    console.log('Resultados prontos para guardar:', results)
    // Ex: await fetch(`/api/regattas/${params.id}/races/...`, { method: 'POST', ... })
  }

  // Entradas disponíveis por dropdown (exclui as já escolhidas)
  const availableEntries = (currentIndex: number) =>
    entryList.filter(e => !results.some((r, i) => r.entryId === e.id && i !== currentIndex))

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Atribuir Resultados</h1>

      <table className="table-auto w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2">Posição</th>
            <th className="border px-4 py-2">Embarcação</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, index) => (
            <tr key={index}>
              <td className="border px-4 py-2">{result.position}º</td>
              <td className="border px-4 py-2">
                <select
                  className="w-full p-1 border rounded"
                  value={result.entryId || ''}
                  onChange={(e) => handleChange(index, e.target.value)}
                >
                  <option value="">-- Selecionar --</option>
                  {availableEntries(index).map(entry => (
                    <option key={entry.id} value={entry.id}>
                      {entry.sail_number} - {entry.sailor_name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={handleSaveResults}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Guardar Resultados
      </button>
    </div>
  )
}
