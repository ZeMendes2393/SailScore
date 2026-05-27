'use client'

import { useState, useEffect } from 'react'
import { COUNTRIES_UNIQUE } from '@/utils/countries'
import { sanitizeSailNumberInput } from '@/lib/sailNumberInput'

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
  isSubmitting?: boolean
  isRequired: (fieldId: string) => boolean
}

export default function Step3({ data, onChange, onSubmit, onBack, isSubmitting = false, isRequired }: Step3Props) {
  const [localData, setLocalData] = useState(data || {})
  const isHandicap = (data?.fullForm?.class_type || data?.class_type) === 'handicap'

  useEffect(() => {
    setLocalData(data || {})
  }, [data])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const nextValue = name === 'sail_number' ? sanitizeSailNumberInput(value) : value
    const updated = { ...localData, [name]: nextValue }
    setLocalData(updated)
    onChange(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    onSubmit()
  }

  const inputClass = 'w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Step 3: Boat details</h2>
      <p className="text-sm text-gray-600">Information about the boat you will compete with.</p>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">Boat identification</h3>
        <Field label="Boat name" required={isRequired('boat_name')} hint="Official name or how the boat is known">
          <input type="text" name="boat_name" placeholder="e.g. Northern Wind" value={localData.boat_name || ''} onChange={handleChange} className={inputClass} required={isRequired('boat_name')} />
        </Field>
        <Field label="Country code" required={isRequired('boat_country_code')} hint="Country of registration (required)">
          <select name="boat_country_code" value={localData.boat_country_code || ''} onChange={handleChange} className={inputClass} required={isRequired('boat_country_code')}>
            <option value="">Select</option>
            {COUNTRIES_UNIQUE.map((c) => (
              <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
            ))}
          </select>
        </Field>
        <Field label="Sail number" required={isRequired('sail_number')} hint="Digits only — country is selected above (e.g. 30275)">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            name="sail_number"
            placeholder="e.g. 30275"
            value={localData.sail_number || ''}
            onChange={handleChange}
            className={inputClass}
            required={isRequired('sail_number')}
          />
        </Field>

        {isHandicap && (
          <>
            <Field label="Boat model" hint="Boat brand and model" required={isRequired('boat_model')}>
              <input
                type="text"
                name="boat_model"
                placeholder="e.g. Beneteau First 36.7"
                value={localData.boat_model || ''}
                onChange={handleChange}
                className={inputClass}
                required={isRequired('boat_model')}
              />
            </Field>
            <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1 mt-4">
              Boat owner
            </h3>
            <p className="text-xs text-gray-600">Owner details (handicap).</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Owner first name" required={isRequired('owner_first_name')}>
                <input
                  type="text"
                  name="owner_first_name"
                  placeholder="e.g. John"
                  value={localData.owner_first_name || ''}
                  onChange={handleChange}
                  className={inputClass}
                  required={isRequired('owner_first_name')}
                />
              </Field>
              <Field label="Owner last name" required={isRequired('owner_last_name')}>
                <input
                  type="text"
                  name="owner_last_name"
                  placeholder="e.g. Smith"
                  value={localData.owner_last_name || ''}
                  onChange={handleChange}
                  className={inputClass}
                  required={isRequired('owner_last_name')}
                />
              </Field>
              <Field label="Owner email" required={isRequired('owner_email')}>
                <input
                  type="email"
                  name="owner_email"
                  placeholder="e.g. john@example.com"
                  value={localData.owner_email || ''}
                  onChange={handleChange}
                  className={inputClass}
                  required={isRequired('owner_email')}
                />
              </Field>
            </div>
          </>
        )}

        {!isHandicap && (
          <Field label="Category" hint="e.g. Men, Women, Mixed" required={isRequired('category')}>
            <input type="text" name="category" placeholder="e.g. Mixed" value={localData.category || ''} onChange={handleChange} className={inputClass} required={isRequired('category')} />
          </Field>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting…' : 'Submit entry'}
        </button>
      </div>
    </form>
  )
}
