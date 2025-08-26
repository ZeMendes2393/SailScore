'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const API_BASE = 'http://localhost:8000'

interface User {
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  loading: boolean
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    console.log('🔐 Recuperando token:', storedToken)
    console.log('🔐 Recuperando user:', storedUser)

    async function hydrate() {
      try {
        if (!storedToken) {
          setLoading(false)
          return
        }
        // Tenta sincronizar com o backend (role/email frescos)
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
        if (!res.ok) throw new Error('Token inválido/expirado')
        const me = await res.json() // { email, role, email_verified_at }
        setToken(storedToken)
        setUser({ email: me.email, role: me.role })
        localStorage.setItem('user', JSON.stringify({ email: me.email, role: me.role }))
      } catch (e) {
        console.warn('⚠️ Sessão inválida. A limpar.', e)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    hydrate()
  }, [])

  const login = (tok: string, usr: User) => {
    console.log('🔐 [AuthContext] login:', usr)
    localStorage.setItem('token', tok)
    localStorage.setItem('user', JSON.stringify(usr))
    setToken(tok)
    setUser(usr)
    setLoading(false)
  }

  const logout = () => {
    console.log('🚪 Logout efetuado.')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export { AuthContext }
