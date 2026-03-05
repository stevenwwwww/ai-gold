import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  username: string
  role: string
  displayName: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  login: (user: AuthUser, token: string, refreshToken: string) => void
  logout: () => void
  setTokens: (token: string, refreshToken: string) => void
  updateUser: (user: Partial<AuthUser>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isAdmin: false,

      login: (user, token, refreshToken) => set({
        user, token, refreshToken,
        isAuthenticated: true,
        isAdmin: user.role === 'admin',
      }),

      logout: () => {
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isAdmin: false })
        window.location.href = '/login'
      },

      setTokens: (token, refreshToken) => set({ token, refreshToken }),

      updateUser: (partial) => {
        const curr = get().user
        if (curr) set({ user: { ...curr, ...partial }, isAdmin: (partial.role || curr.role) === 'admin' })
      },
    }),
    { name: 'report-auth' },
  ),
)
