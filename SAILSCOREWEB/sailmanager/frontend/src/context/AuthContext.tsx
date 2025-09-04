// src/context/AuthContext.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const API_BASE = 'http://localhost:8000'

/** Tipos: só o regatista exige id */
type BaseUser = {
  email: string
  role: string
  name?: string | null
  current_regatta_id?: number | null
  id?: number | null // opcional por defeito
}
type SailorUser = BaseUser & { role: 'regatista'; id: number } // <- obrigatório
export type User = SailorUser | BaseUser

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User | null) => void
  switchRegatta: (regattaId: number) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = async (tok: string) => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
    if (!res.ok) throw new Error('Sessão inválida')
    const me = (await res.json()) as User
    setUser(me)
    localStorage.setItem('user', JSON.stringify(me))
    return me
  }

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    setLoading(true)
    ;(async () => {
      try {
        if (!storedToken) {
          setLoading(false)
          return
        }
        setToken(storedToken)
        await refreshMe(storedToken)
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const login = (tok: string, usr: User) => {
    localStorage.setItem('token', tok)
    localStorage.setItem('user', JSON.stringify(usr))
    setToken(tok)
    setUser(usr)
    setLoading(false)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const switchRegatta = async (regattaId: number) => {
    const t = localStorage.getItem('token') || ''
    if (!t) throw new Error('Sem sessão')

    const res = await fetch(`${API_BASE}/auth/switch-regatta?regatta_id=${regattaId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
    })
    if (!res.ok) throw new Error(await res.text())
    const { access_token } = (await res.json()) as { access_token: string }

    localStorage.setItem('token', access_token)
    setToken(access_token)
    await refreshMe(access_token)
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, logout, setUser, switchRegatta }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export { AuthContext }
