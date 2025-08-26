'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AcceptInvitePage() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle'|'ok'|'error'>('idle')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Token em falta.')
    }
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('idle'); setMessage('')
    try {
      const res = await fetch('http://localhost:8000/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMessage(data.detail || 'Não foi possível aceitar o convite.')
        return
      }
      setStatus('ok')
      setMessage('Convite aceite. Já podes iniciar sessão.')
    } catch {
      setStatus('error')
      setMessage('Erro de rede.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4">Aceitar convite</h1>
        {!token && <p className="text-red-600">Token em falta.</p>}

        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            placeholder="Define a tua palavra-passe (opcional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            disabled={!token}
          >
            Aceitar convite
          </button>
        </form>

        {status !== 'idle' && (
          <div className={`mt-4 text-sm ${status === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
            {message}
          </div>
        )}

        {status === 'ok' && (
          <div className="mt-4">
            <button
              onClick={() => router.replace('/login')}
              className="w-full bg-gray-100 border px-3 py-2 rounded hover:bg-gray-200"
            >
              Ir para login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
