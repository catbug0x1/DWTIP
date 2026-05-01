import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import api from '../utils/api'

interface User {
  id: number
  email: string
  username: string
  full_name?: string
  role: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<boolean>
  register: (email: string, username: string, password: string) => Promise<boolean>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        const response = await api.get('/v1/auth/me')
        setUser(response.data)
        console.log('User loaded:', response.data)
      }
    } catch (error: any) {
      console.error('Failed to fetch user:', error)
      if (error?.response?.status === 401) {
        localStorage.removeItem('token')
        delete api.defaults.headers.common['Authorization']
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      console.log('Attempting login for:', username)
      
      const formData = new URLSearchParams()
      formData.append('username', username)
      formData.append('password', password)
      
      const response = await api.post('/v1/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      
      console.log('Login response:', response.data)
      
      if (response.data.access_token) {
        const token = response.data.access_token
        localStorage.setItem('token', token)
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        
        // Fetch user immediately after login
        try {
          const userResponse = await api.get('/v1/auth/me')
          console.log('User after login:', userResponse.data)
          setUser(userResponse.data)
        } catch (e) {
          console.error('Failed to fetch user after login:', e)
          // Still return true if token was received
        }
        
        return true
      }
      return false
    } catch (error: any) {
      console.error('Login failed:', error)
      console.error('Error response:', error?.response?.data)
      return false
    }
  }

  const register = async (email: string, username: string, password: string): Promise<boolean> => {
    try {
      await api.post('/v1/auth/register', {
        email,
        username,
        password,
        role: 'viewer'
      })
      return await login(username, password)
    } catch (error) {
      console.error('Registration failed:', error)
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
