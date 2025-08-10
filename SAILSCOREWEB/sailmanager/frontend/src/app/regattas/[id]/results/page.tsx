"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import ResultsViewer from "../components/results/ResultsViewer"

interface Regatta {
  id: number
  name: string
  location: string
  start_date: string
  end_date: string
  status?: string
}

interface RegattaClass {
  id: number
  regatta_id: number
  class_name: string
}

export default function ResultsPage() {
  const params = useParams()
  const id = parseInt(params.id as string)
  const [regatta, setRegatta] = useState<Regatta | null>(null)
  const [availableClasses, setAvailableClasses] = useState<RegattaClass[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  useEffect(() => {
    const fetchRegatta = async () => {
      const res = await fetch(`http://localhost:8000/regattas/${id}`)
      const data = await res.json()
      setRegatta(data)
    }

    const fetchClasses = async () => {
      const res = await fetch(`http://localhost:8000/regatta-classes/by_regatta/${id}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setAvailableClasses(data)
        setSelectedClass((prev) => prev || data[0]?.class_name || null)
      } else {
        console.warn("❌ Erro ao carregar classes:", data)
      }
    }

    fetchRegatta()
    fetchClasses()
  }, [id])

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="bg-white shadow rounded p-6 mb-6">
        {regatta ? (
          <>
            <h1 className="text-3xl font-bold mb-2">{regatta.name}</h1>
            <p className="text-gray-600">
              {regatta.location} | {regatta.start_date} – {regatta.end_date}
            </p>
            <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs mt-2 inline-block">
              {regatta.status || "Scheduled"}
            </span>
          </>
        ) : (
          <p>A carregar regata...</p>
        )}
      </div>

      {availableClasses.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {availableClasses.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls.class_name)}
              className={`px-3 py-1 rounded font-semibold border ${
                selectedClass === cls.class_name
                  ? "bg-blue-600 text-white"
                  : "bg-white text-blue-600 border-blue-600"
              }`}
            >
              {cls.class_name}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white shadow rounded p-6">
        {regatta && selectedClass ? (
<ResultsViewer regattaId={id} />
        ) : (
          <p className="text-gray-500">Selecione uma classe para ver os resultados.</p>
        )}
      </div>
    </main>
  )
}
