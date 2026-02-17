'use client'

import { useState } from 'react'
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

interface Step2Props {
  data: any
  onChange: (data: any) => void
  onNext: () => void
  onBack: () => void
}

export default function Step2({ data, onChange, onNext, onBack }: Step2Props) {
  const [localData, setLocalData] = useState(data || {})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const updated = { ...localData, [name]: value }
    setLocalData(updated)
    onChange(updated)
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  const inputClass = 'w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <form onSubmit={handleNext} className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Step 2: Helm / Skipper details</h2>
      <p className="text-sm text-gray-600">Enter the helm/skipper athlete details (required).</p>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">Identification</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Position" hint="Skipper or Crew">
            <select name="position" value={localData.position || 'Skipper'} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="Skipper">Skipper</option>
              <option value="Crew">Crew</option>
            </select>
          </Field>
          <Field label="First name" required>
            <input type="text" name="first_name" placeholder="e.g. John" value={localData.first_name || ''} onChange={handleChange} className={inputClass} required />
          </Field>
          <Field label="Last name" required>
            <input type="text" name="last_name" placeholder="e.g. Smith" value={localData.last_name || ''} onChange={handleChange} className={inputClass} required />
          </Field>
          <Field label="Date of birth" hint="Format: year-month-day">
            <input type="date" name="date_of_birth" value={localData.date_of_birth || ''} onChange={handleChange} className={inputClass} />
          </Field>
          <Field label="Gender" required>
            <select name="gender" value={localData.gender || ''} onChange={handleChange} className={inputClass} required>
              <option value="">Selecionar</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </Field>
          <Field label="Federation license" hint="Federation license number/code (optional)">
            <input type="text" name="federation_license" placeholder="e.g. 12345" value={localData.federation_license || ''} onChange={handleChange} className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">Contact</h3>
        <Field label="Email" required>
          <input type="email" name="email" placeholder="e.g. john@example.com" value={localData.email || ''} onChange={handleChange} className={inputClass} required />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Primary phone">
            <input type="text" name="contact_phone_1" placeholder="e.g. +44 7123 456789" value={localData.contact_phone_1 || ''} onChange={handleChange} className={inputClass} />
          </Field>
          <Field label="Secondary phone">
            <input type="text" name="contact_phone_2" placeholder="e.g. +44 20 7123 4567" value={localData.contact_phone_2 || ''} onChange={handleChange} className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">Club and country</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Club">
            <input type="text" name="club" placeholder="e.g. Royal Yacht Club" value={localData.club || ''} onChange={handleChange} className={inputClass} />
          </Field>
          <Field label="Country">
            <select name="helm_country" value={localData.helm_country || ''} onChange={handleChange} className={inputClass}>
              <option value="">—</option>
              {COUNTRIES_UNIQUE.map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>
          </Field>
          <Field label="Second country (optional)" hint="For athletes with dual nationality">
            <select name="helm_country_secondary" value={localData.helm_country_secondary || ''} onChange={handleChange} className={inputClass}>
              <option value="">—</option>
              {COUNTRIES_UNIQUE.map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>
          </Field>
          <Field label="Territory / Federation">
            <input type="text" name="territory" placeholder="e.g. RYA" value={localData.territory || ''} onChange={handleChange} className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">Address</h3>
        <Field label="Full address">
          <input type="text" name="address" placeholder="e.g. 123 Example Street" value={localData.address || ''} onChange={handleChange} className={inputClass} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Postcode">
            <input type="text" name="zip_code" placeholder="e.g. SW1A 1AA" value={localData.zip_code || ''} onChange={handleChange} className={inputClass} />
          </Field>
          <Field label="Town / City">
            <input type="text" name="town" placeholder="e.g. London" value={localData.town || ''} onChange={handleChange} className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Back</button>
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Next</button>
      </div>
    </form>
  )
}
