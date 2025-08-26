'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const params = useSearchParams()
  const reason = params.get('reason') // "expired"
  const { login } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.detail || 'Erro ao fazer login.')
        setLoading(false)
        return
      }

      login(data.access_token, { email, role: data.role })

      setLoading(false)

      const next = sessionStorage.getItem('postLoginRedirect')
      sessionStorage.removeItem('postLoginRedirect')

      if (next) {
        router.replace(next)
      } else {
        router.replace(data.role === 'admin' ? '/admin' : '/sailor')
      }
    } catch {
      setError('Erro de rede ou inesperado.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Iniciar Sessão</h2>

        {reason === 'expired' && (
          <div className="mb-4 rounded border border-yellow-200 bg-yellow-50 text-yellow-900 px-3 py-2 text-sm">
            A tua sessão expirou. Inicia sessão novamente.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded"
            required
          />
          <input
            type="password"
            placeholder="Palavra-passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded"
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <a href="/accept-invite" className="text-blue-600 hover:underline font-medium">
            Aceitar convite
          </a>
          <span className="mx-2 text-gray-400">•</span>
          <a href="/forgot-password" className="text-gray-600 hover:underline">
            Esqueci a palavra-passe
          </a>
        </div>
      </div>
    </div>
  )
}
