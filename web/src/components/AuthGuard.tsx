import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuthenticated)
  const loc = useLocation()
  if (!isAuth) return <Navigate to="/login" state={{ from: loc }} replace />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin)
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
