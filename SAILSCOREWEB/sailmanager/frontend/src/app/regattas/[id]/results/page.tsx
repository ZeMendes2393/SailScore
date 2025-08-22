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

export default function ResultsPage() {
  const params = useParams()
  const id = Number(params.id as string)

  const [regatta, setRegatta] = useState<Regatta | null>(null)

  // classes agora são strings (ex.: ["ILCA 6", "420", ...])
  const [availableClasses, setAvailableClasses] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [classesError, setClassesError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRegatta = async () => {
      const res = await fetch(`http://localhost:8000/regattas/${id}`)
      if (!res.ok) {
        console.error("❌ Falha ao obter regata:", res.status, await res.text())
        return
      }
      const data = await res.json()
      setRegatta(data)
    }

    const fetchClasses = async () => {
      setLoadingClasses(true)
      setClassesError(null)
      try {
        const res = await fetch(`http://localhost:8000/regattas/${id}/classes`)
        if (!res.ok) {
          const txt = await res.text()
          console.error("❌ Erro ao carregar classes:", res.status, txt)
          setAvailableClasses([])
          setClassesError("Não foi possível carregar as classes desta regata.")
          return
        }
        const data: unknown = await res.json()
        const arr = Array.isArray(data) ? (data as string[]) : []
        setAvailableClasses(arr)
        // pré-seleciona a 1ª classe se não houver ainda uma escolhida
        setSelectedClass(prev => prev ?? arr[0] ?? null)
      } catch (err) {
        console.error("❌ Erro de rede ao carregar classes:", err)
        setAvailableClasses([])
        setClassesError("Erro de rede ao carregar classes.")
      } finally {
        setLoadingClasses(false)
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

      {/* Seletor de classes */}
      <div className="mb-6">
        {loadingClasses && <p className="text-gray-500">A carregar classes…</p>}
        {!loadingClasses && classesError && (
          <p className="text-red-700">{classesError}</p>
        )}
        {!loadingClasses && !classesError && availableClasses.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {availableClasses.map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1 rounded font-semibold border ${
                  selectedClass === cls
                    ? "bg-blue-600 text-white"
                    : "bg-white text-blue-600 border-blue-600"
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded p-6">
        {regatta && selectedClass ? (
          // Se o teu ResultsViewer aceitar a classe, podes passar como prop:
          // <ResultsViewer regattaId={id} classNameFilter={selectedClass} />
          <ResultsViewer regattaId={id} />
        ) : (
          <p className="text-gray-500">Selecione uma classe para ver os resultados.</p>
        )}
      </div>
    </main>
  )
}
