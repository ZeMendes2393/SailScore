'use client'
import { useEffect, useState } from 'react'

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')

type ClassItem = { class_name: string; class_type?: string; sailors_per_boat?: number }

interface Step1Props {
  data: {
    class_name: string
    class_type?: string
    sailors_per_boat?: number
    regatta_id?: number
  }
  onChange: (data: { class_name?: string; class_type?: string; sailors_per_boat?: number }) => void
  onNext: () => void
}

export default function Step1({ data, onChange, onNext }: Step1Props) {
  const [localData, setLocalData] = useState(data)
  const [classesOD, setClassesOD] = useState<string[]>([])
  const [classesHandicap, setClassesHandicap] = useState<string[]>([])
  const [detailedList, setDetailedList] = useState<ClassItem[]>([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [classesError, setClassesError] = useState<string | null>(null)

  useEffect(() => {
    if (!data.regatta_id) { setClassesOD([]); setClassesHandicap([]); setDetailedList([]); return }
    const fetchClasses = async () => {
      setLoadingClasses(true); setClassesError(null)
      try {
        const res = await fetch(`${API_BASE}/regattas/${data.regatta_id}/classes/detailed`)
        if (!res.ok) {
          const fallback = await fetch(`${API_BASE}/regattas/${data.regatta_id}/classes`)
          if (fallback.ok) {
            const arr = (await fallback.json()) as string[]
            setClassesOD(Array.isArray(arr) ? arr : [])
            setClassesHandicap([])
            setDetailedList((Array.isArray(arr) ? arr : []).map((c) => ({ class_name: c, class_type: 'one_design', sailors_per_boat: 1 })))
          } else {
            setClassesOD([]); setClassesHandicap([]); setDetailedList([]); setClassesError('Could not load classes.')
          }
          return
        }
        const json = (await res.json()) as ClassItem[]
        const arr = Array.isArray(json) ? json : []
        setDetailedList(arr)
        const od = arr.filter((c) => (c.class_type || 'one_design') !== 'handicap').map((c) => c.class_name)
        const h = arr.filter((c) => (c.class_type || '') === 'handicap').map((c) => c.class_name)
        setClassesOD(od)
        setClassesHandicap(h)
        if (!localData.class_name && (od.length > 0 || h.length > 0)) {
          const firstItem = arr.find((c) => c.class_name === (od[0] ?? h[0]))
          const first = od[0] ?? h[0] ?? ''
          const firstType = od[0] ? 'one_design' : 'handicap'
          const sailors = firstItem?.sailors_per_boat ?? 1
          const updated = { ...localData, class_name: first, class_type: firstType, sailors_per_boat: sailors }
          setLocalData(updated)
          onChange(updated)
        }
      } catch (err) {
        console.error('❌ Erro ao carregar classes:', err)
        setClassesOD([]); setClassesHandicap([]); setDetailedList([]); setClassesError('Network error loading classes.')
      } finally { setLoadingClasses(false) }
    }
    fetchClasses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.regatta_id])

  useEffect(() => { setLocalData(data) }, [data.class_name, data.class_type, data.sailors_per_boat, data.regatta_id])

  const allClasses = [...classesOD, ...classesHandicap]
  const getClassType = (cn: string) =>
    classesHandicap.includes(cn) ? 'handicap' : 'one_design'
  const getSailorsPerBoat = (cn: string) =>
    detailedList.find((c) => c.class_name === cn)?.sailors_per_boat ?? 1

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cn = e.target.value
    const ct = cn ? getClassType(cn) : undefined
    const sailors = cn ? getSailorsPerBoat(cn) : undefined
    const updated = { ...localData, class_name: cn, class_type: ct, sailors_per_boat: sailors }
    setLocalData(updated)
    onChange(updated)
  }

  const handleNext = () => {
    if (localData.class_name) onNext()
    else alert('Please select a class.')
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Step 1: Select class</h2>
      <p className="text-sm text-gray-600">Choose the class you will compete in at this regatta.</p>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Competition class</label>
        {loadingClasses && <p className="text-gray-500 text-sm">Loading classes…</p>}
        {!loadingClasses && classesError && <p className="text-red-700 text-sm">{classesError}</p>}
        <select
          name="class_name"
          value={localData.class_name}
          onChange={handleChange}
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={loadingClasses || allClasses.length === 0}
        >
          <option value="">{allClasses.length === 0 ? 'No classes' : 'Select'}</option>
          {classesOD.length > 0 && (
            <optgroup label="One Design">
              {classesOD.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </optgroup>
          )}
          {classesHandicap.length > 0 && (
            <optgroup label="Handicap">
              {classesHandicap.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </optgroup>
          )}
        </select>
        {localData.class_name && localData.class_type === 'one_design' && (localData.sailors_per_boat ?? 1) > 1 && (
          <p className="text-xs text-gray-600 mt-2">
            This boat has <strong>{localData.sailors_per_boat}</strong> sailor(s). You must enter at least the helm; the rest can be added now or later.
          </p>
        )}
      </div>

      <button onClick={handleNext} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium">
        Next
      </button>
    </div>
  )
}
