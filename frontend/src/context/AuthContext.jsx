import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import { authService, loadProfile } from '../services'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true) // true until Firebase reports the saved session
  const [loading, setLoading] = useState(false)
  const signingIn = useRef(false) // login/register set the user themselves

  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (signingIn.current) return
      try {
        setUser(fbUser ? await loadProfile(fbUser) : null)
      } catch {
        setUser(null)
      } finally {
        setInitializing(false)
      }
    })
  }, [])

  const authenticate = useCallback(async (request, failureMessage) => {
    setLoading(true)
    signingIn.current = true
    try {
      const { data } = await request()
      setUser(data.user)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || failureMessage }
    } finally {
      signingIn.current = false
      setLoading(false)
    }
  }, [])

  const login = useCallback(
    (email, password) => authenticate(() => authService.login({ email, password }), 'Login failed'),
    [authenticate]
  )

  const register = useCallback(
    (fullName, email, password, field) =>
      authenticate(
        () => authService.register({ full_name: fullName, email, password, field }),
        'Registration failed'
      ),
    [authenticate]
  )

  const logout = useCallback(() => authService.logout(), [])

  const updateUser = useCallback((changes) => setUser((prev) => ({ ...prev, ...changes })), [])

  return (
    <AuthContext.Provider value={{ user, initializing, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
