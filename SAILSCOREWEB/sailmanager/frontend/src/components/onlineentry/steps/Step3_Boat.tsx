'use client'

import { useState } from 'react'

interface Step3Props {
  data: any
  onChange: (data: any) => void
  onSubmit: () => void
  onBack: () => void
}

export default function Step3({ data, onChange, onSubmit, onBack }: Step3Props) {
  const [localData, setLocalData] = useState(data || {})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const updated = { ...localData, [name]: value }
    setLocalData(updated)
    onChange(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-bold">Passo 3: Dados do Barco</h2>

      <input type="text" name="boat_name" placeholder="Nome do Barco" value={localData.boat_name || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
      <input type="text" name="sail_number" placeholder="Número da Vela" value={localData.sail_number || ''} onChange={handleChange} className="w-full p-2 border rounded" />
      <input type="text" name="boat_country" placeholder="País do Barco" value={localData.boat_country || ''} onChange={handleChange} className="w-full p-2 border rounded" />
      <input type="text" name="category" placeholder="Categoria" value={localData.category || ''} onChange={handleChange} className="w-full p-2 border rounded" />

      <div className="flex justify-between mt-4">
        <button type="button" onClick={onBack} className="px-4 py-2 bg-gray-200 rounded">Voltar</button>
        <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          Submeter Inscrição
        </button>
      </div>
    </form>
  )
}
