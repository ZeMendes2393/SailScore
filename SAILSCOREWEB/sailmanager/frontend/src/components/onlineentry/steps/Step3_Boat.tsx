'use client'

import { useState, useEffect } from 'react'
import { COUNTRIES_UNIQUE } from '@/utils/countries'

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
      {children}
    </div>
  )
}

interface Step3Props {
  data: any
  onChange: (data: any) => void
  onSubmit: () => void
  onBack: () => void
}

export default function Step3({ data, onChange, onSubmit, onBack }: Step3Props) {
  const [localData, setLocalData] = useState(data || {})
  const isHandicap = (data?.fullForm?.class_type || data?.class_type) === 'handicap'

  useEffect(() => {
    setLocalData(data || {})
  }, [data])

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

  const inputClass = 'w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Passo 3: Dados do barco</h2>
      <p className="text-sm text-gray-600">Informações sobre o barco com que vais competir.</p>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">Identificação do barco</h3>
        <Field label="Nome do barco" required hint="Nome oficial ou como o barco é conhecido">
          <input type="text" name="boat_name" placeholder="ex.: Northern Wind" value={localData.boat_name || ''} onChange={handleChange} className={inputClass} required />
        </Field>
        <Field label="Código do país" required hint="País de registo (obrigatório)">
          <select name="boat_country_code" value={localData.boat_country_code || ''} onChange={handleChange} className={inputClass} required>
            <option value="">Selecionar</option>
            {COUNTRIES_UNIQUE.map((c) => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </Field>
        <Field label="Número de vela" required hint="Número de regata na vela grande (ex.: 47, 123)">
          <input type="text" name="sail_number" placeholder="ex.: 47" value={localData.sail_number || ''} onChange={handleChange} className={inputClass} required />
        </Field>

        {isHandicap && (
          <>
            <Field label="Modelo do barco" hint="Marca e modelo do barco">
              <input
                type="text"
                name="boat_model"
                placeholder="ex.: Beneteau First 36.7"
                value={localData.boat_model || ''}
                onChange={handleChange}
                className={inputClass}
              />
            </Field>
            <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1 mt-4">
              Proprietário do barco
            </h3>
            <p className="text-xs text-gray-600">Dados do proprietário (handicap).</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Primeiro nome do proprietário">
                <input
                  type="text"
                  name="owner_first_name"
                  placeholder="ex.: João"
                  value={localData.owner_first_name || ''}
                  onChange={handleChange}
                  className={inputClass}
                />
              </Field>
              <Field label="Apelido do proprietário">
                <input
                  type="text"
                  name="owner_last_name"
                  placeholder="ex.: Silva"
                  value={localData.owner_last_name || ''}
                  onChange={handleChange}
                  className={inputClass}
                />
              </Field>
              <Field label="Email do proprietário">
                <input
                  type="email"
                  name="owner_email"
                  placeholder="ex.: joao@exemplo.com"
                  value={localData.owner_email || ''}
                  onChange={handleChange}
                  className={inputClass}
                />
              </Field>
            </div>
          </>
        )}

        <Field label="Categoria" hint="ex.: Masculino, Feminino, Misto">
          <input type="text" name="category" placeholder="ex.: Misto" value={localData.category || ''} onChange={handleChange} className={inputClass} />
        </Field>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Voltar</button>
        <button type="submit" className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
          Submeter inscrição
        </button>
      </div>
    </form>
  )
}
