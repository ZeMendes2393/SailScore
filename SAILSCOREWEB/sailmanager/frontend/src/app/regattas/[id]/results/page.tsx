"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import RegattaHeader from "../components/RegattaHeader"
import ResultsViewer from "../components/results/ResultsViewer"

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000'

type HomeImage = { url: string; position_x?: number; position_y?: number }

interface Regatta {
  id: number
  name: string
  location: string
  start_date: string
  end_date: string
  poster_url?: string | null
  home_images?: HomeImage[] | null
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
      const res = await fetch(`${API_BASE}/regattas/${id}`)
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
        const res = await fetch(`${API_BASE}/regattas/${id}/classes`)
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

  const hi = regatta?.home_images?.[0]
  const heroImageUrl = (regatta?.poster_url?.trim() || hi?.url)?.trim()
  const heroPos = hi ? { x: hi.position_x ?? 50, y: hi.position_y ?? 50 } : { x: 50, y: 50 }
  const heroBgStyle = heroImageUrl
    ? {
        backgroundImage: `url(${heroImageUrl.startsWith('http') ? heroImageUrl : `${API_BASE}${heroImageUrl}`})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: `${heroPos.x}% ${heroPos.y}%`,
      }
    : undefined

  const formatDateRange = (start: string, end: string) => {
    try {
      const s = new Date(start)
      const e = new Date(end)
      const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
      if (s.getTime() === e.getTime()) return s.toLocaleDateString('pt-PT', opts)
      return `${s.toLocaleDateString('pt-PT', opts)} – ${e.toLocaleDateString('pt-PT', opts)}`
    } catch {
      return `${start} – ${end}`
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <RegattaHeader regattaId={id} />

      {/* Hero */}
      {regatta && (
        <section
          className="relative w-screen text-center py-20 md:py-28"
          style={{
            marginLeft: 'calc(50% - 50vw)',
            marginRight: 'calc(50% - 50vw)',
            ...(heroBgStyle ?? { background: 'linear-gradient(135deg, #1e40af 0%, #0ea5e9 100%)' }),
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-white">
            <Link href={`/regattas/${id}`} className="text-sm opacity-90 hover:opacity-100 mb-4 inline-block">← Back to regatta</Link>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3 drop-shadow-lg">{regatta.name}</h1>
            <p className="text-lg md:text-xl font-medium opacity-95 drop-shadow">{regatta.location}</p>
            <p className="text-base md:text-lg mt-1 opacity-90 drop-shadow">{formatDateRange(regatta.start_date, regatta.end_date)}</p>
          </div>
        </section>
      )}

      <div className="container-page py-8">
      {!regatta && <p className="py-8">A carregar regata...</p>}

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
          <ResultsViewer regattaId={id} selectedClass={selectedClass} />
        ) : (
          <p className="text-gray-500">Select a class to see results.</p>
        )}
      </div>
      </div>
    </main>
  )
}
