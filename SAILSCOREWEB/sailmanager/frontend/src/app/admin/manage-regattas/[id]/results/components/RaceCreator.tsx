'use client'

import { useEffect, useState } from 'react'

interface Props {
  regattaId: number
  onRaceCreated: (newRace: Race) => void
}

interface Race {
  id: number
  name: string
  regatta_id: number
  class_name: string
}

export default function RaceCreator({ regattaId, onRaceCreated }: Props) {
  const [name, setName] = useState('')
  const [className, setClassName] = useState('')
  const [classOptions, setClassOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
  const fetchClasses = async () => {
    const res = await fetch(`http://localhost:8000/regatta-classes/by_regatta/${regattaId}`)
    if (!res.ok) {
      console.error("Falha a obter classes:", res.status, await res.text())
      return
    }
    const data = await res.json()
    // data é [{ id, regatta_id, class_name }, ...]
    setClassOptions(Array.isArray(data) ? data.map((c: any) => c.class_name) : [])
  }
  fetchClasses()
}, [regattaId])


  const handleCreateRace = async () => {
    if (!name.trim() || !className) {
      alert('Preenche todos os campos.')
      return
    }

    setLoading(true)
    const res = await fetch('http://localhost:8000/races', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regatta_id: regattaId,
        name,
        class_name: className,
        date: new Date().toISOString().split('T')[0]
      })
    })

    setLoading(false)

    if (!res.ok) {
      alert('Erro ao criar corrida.')
      return
    }

    const newRace = await res.json()
    onRaceCreated(newRace)
    setName('')
    setClassName('')
    alert('Corrida criada com sucesso!')
  }

  return (
    <div className="mb-6 p-4 border rounded bg-gray-50">
      <h3 className="text-lg font-bold mb-2">Criar Nova Corrida</h3>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700">Nome da corrida</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2 w-full"
          placeholder="Ex: Corrida 1"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700">Classe da corrida</label>
        <select
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="">-- Selecionar Classe --</option>
          {classOptions.map((cls) => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleCreateRace}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {loading ? 'A criar...' : '➕ Criar Corrida'}
      </button>
    </div>
  )
}
