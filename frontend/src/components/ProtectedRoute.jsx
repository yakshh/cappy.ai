import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const token = localStorage.getItem('token')

  if (!user || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}
