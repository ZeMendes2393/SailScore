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
      <h2 className="text-xl font-bold text-gray-900">Step 3: Boat details</h2>
      <p className="text-sm text-gray-600">Information about the boat you will compete with.</p>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">Boat identification</h3>
        <Field label="Boat name" required hint="Official name or how the boat is known">
          <input type="text" name="boat_name" placeholder="e.g. Northern Wind" value={localData.boat_name || ''} onChange={handleChange} className={inputClass} required />
        </Field>
        <Field label="Country code" required hint="Country of registration (required)">
          <select name="boat_country_code" value={localData.boat_country_code || ''} onChange={handleChange} className={inputClass} required>
            <option value="">Select</option>
            {COUNTRIES_UNIQUE.map((c) => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </Field>
        <Field label="Sail number" required hint="Regatta number on the mainsail (e.g. 47, 123) – obrigatório">
          <input type="text" name="sail_number" placeholder="e.g. 47" value={localData.sail_number || ''} onChange={handleChange} className={inputClass} required />
        </Field>

        {isHandicap && (
          <>
            <Field label="Rating (handicap)" hint="Handicap coefficient (e.g. ORC, IRC)">
              <input
                type="number"
                step="0.001"
                name="rating"
                placeholder="e.g. 1.012"
                value={localData.rating ?? ''}
                onChange={handleChange}
                className={inputClass}
              />
            </Field>
            <Field label="Boat model" hint="Make and model of the boat">
              <input
                type="text"
                name="boat_model"
                placeholder="e.g. Beneteau First 36.7"
                value={localData.boat_model || ''}
                onChange={handleChange}
                className={inputClass}
              />
            </Field>
            <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1 mt-4">
              Boat owner
            </h3>
            <p className="text-xs text-gray-600">Owner details (handicap).</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Owner first name">
                <input
                  type="text"
                  name="owner_first_name"
                  placeholder="e.g. John"
                  value={localData.owner_first_name || ''}
                  onChange={handleChange}
                  className={inputClass}
                />
              </Field>
              <Field label="Owner last name">
                <input
                  type="text"
                  name="owner_last_name"
                  placeholder="e.g. Smith"
                  value={localData.owner_last_name || ''}
                  onChange={handleChange}
                  className={inputClass}
                />
              </Field>
              <Field label="Owner email">
                <input
                  type="email"
                  name="owner_email"
                  placeholder="e.g. john@example.com"
                  value={localData.owner_email || ''}
                  onChange={handleChange}
                  className={inputClass}
                />
              </Field>
            </div>
          </>
        )}

        <Field label="Category" hint="e.g. Male, Female, Mixed">
          <input type="text" name="category" placeholder="e.g. Mixed" value={localData.category || ''} onChange={handleChange} className={inputClass} />
        </Field>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Back</button>
        <button type="submit" className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
          Submit entry
        </button>
      </div>
    </form>
  )
}
