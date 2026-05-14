'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getApiBaseUrl } from '@/lib/api'

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
      setMessage('Missing token.')
    }
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('idle'); setMessage('')
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMessage(data.detail || 'Could not accept the invite.')
        return
      }
      setStatus('ok')
      setMessage('Invite accepted. You can sign in now.')
    } catch {
      setStatus('error')
      setMessage('Network error.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4">Accept invite</h1>
        {!token && <p className="text-red-600">Missing token.</p>}

        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            placeholder="Set your password (optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            disabled={!token}
          >
            Accept invite
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
              Go to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
