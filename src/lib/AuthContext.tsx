import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { supabase } from '@/lib/supabase'

type UserRole = 'admin' | 'guest'
type UserStatus = 'pending' | 'approved' | 'rejected'

interface UserProfile {
  githubLogin: string
  role: UserRole
  status: UserStatus
  email: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
}

interface AuthContextType {
  currentUser: any | null
  userProfile: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isGuest: boolean
  isApproved: boolean
  isPending: boolean
  isRejected: boolean
  hasRole: (role: UserRole) => boolean
  updateUserRole: (login: string, role: UserRole) => void
  updateUserStatus: (login: string, status: UserStatus) => void
  createUser: (login: string, email: string, role: UserRole) => void
  deleteUser: (login: string) => void
  getAllProfiles: () => UserProfile[]
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signInWithDevCredentials: (email: string, userId: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

type AppUser = {
  id: string
  login: string
  email: string
  avatarUrl: string
  isOwner: boolean
}

function toAppUser(user: any): AppUser {
  const metadata = user?.user_metadata || {}
  const email = user?.email || ''
  const nameFromMetadata = metadata.full_name || metadata.name || metadata.user_name || metadata.username
  const loginFromEmail = email ? email.split('@')[0] : ''
  const login = nameFromMetadata || loginFromEmail || `user-${String(user?.id || 'anon').slice(0, 8)}`
  const avatarUrl =
    metadata.avatar_url ||
    metadata.picture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(login)}&background=random`

  return {
    id: String(user?.id || login),
    login,
    email,
    avatarUrl,
    isOwner: false,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profiles, setProfiles] = useKV<UserProfile[]>('user-profiles', [])

  useEffect(() => {
    let isMounted = true

    const setFromSupabaseUser = (supabaseUser: any | null) => {
      if (!isMounted) return
      setCurrentUser(supabaseUser ? toAppUser(supabaseUser) : null)
    }

    const initAuth = async () => {
      try {
        if (import.meta.env.VITE_DEV_MODE === 'true') {
          let devUser = localStorage.getItem('dev-mode-user')
          if (!devUser) {
            const email = import.meta.env.VITE_DEV_USER_EMAIL || 'dev@dev.com'
            const userId = import.meta.env.VITE_DEV_USER_ID || 'dev-user'
            const login = email.split('@')[0]
            const mockUser = {
              id: userId,
              login,
              email,
              avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(login)}&background=random`,
              isOwner: false,
            }
            localStorage.setItem('dev-mode-user', JSON.stringify(mockUser))
            devUser = JSON.stringify(mockUser)
          }
          if (isMounted) {
            setCurrentUser(JSON.parse(devUser))
            setIsLoading(false)
          }
          return
        }

        const { data, error } = await supabase.auth.getSession()
        if (error) console.error('Failed to read Supabase session:', error)
        setFromSupabaseUser(data.session?.user ?? null)
      } catch (error) {
        console.error('Failed to initialize auth:', error)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void setFromSupabaseUser(session?.user ?? null)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null)
      return
    }

    const safeProfiles = profiles || []
    const existingProfile = safeProfiles.find(
      (p) => p.githubLogin === currentUser.login || p.email === currentUser.email
    )

    if (existingProfile) {
      const nextEmail = currentUser.email || existingProfile.email
      const nextAvatarUrl = currentUser.avatarUrl || existingProfile.avatarUrl

      if (existingProfile.email !== nextEmail || existingProfile.avatarUrl !== nextAvatarUrl) {
        const updatedProfile: UserProfile = {
          ...existingProfile,
          email: nextEmail,
          avatarUrl: nextAvatarUrl,
          updatedAt: new Date().toISOString(),
        }
        setProfiles((current) =>
          (current || []).map((p) => (p.githubLogin === existingProfile.githubLogin ? updatedProfile : p))
        )
        setUserProfile(updatedProfile)
        return
      }

      setUserProfile(existingProfile)
      return
    }

    const firstUser = safeProfiles.length === 0
    const now = new Date().toISOString()
    const newProfile: UserProfile = {
      githubLogin: currentUser.login,
      role: firstUser ? 'admin' : 'guest',
      status: firstUser ? 'approved' : 'pending',
      email: currentUser.email || '',
      avatarUrl: currentUser.avatarUrl,
      createdAt: now,
      updatedAt: now,
    }

    setProfiles((current) => {
      const arr = current || []
      const alreadyExists = arr.some((p) => p.githubLogin === newProfile.githubLogin)
      return alreadyExists ? arr : [...arr, newProfile]
    })
    setUserProfile(newProfile)
  }, [currentUser, profiles, setProfiles])

  const hasRole = (role: UserRole) => userProfile?.role === role

  const updateUserRole = (login: string, role: UserRole) => {
    setProfiles((current) =>
      (current || []).map((p) =>
        p.githubLogin === login ? { ...p, role, updatedAt: new Date().toISOString() } : p
      )
    )
  }

  const updateUserStatus = (login: string, status: UserStatus) => {
    setProfiles((current) =>
      (current || []).map((p) =>
        p.githubLogin === login ? { ...p, status, updatedAt: new Date().toISOString() } : p
      )
    )
  }

  const createUser = (login: string, email: string, role: UserRole) => {
    const newProfile: UserProfile = {
      githubLogin: login,
      role,
      status: 'approved',
      email,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(login)}&background=random`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setProfiles((current) => [...(current || []), newProfile])
  }

  const deleteUser = (login: string) => {
    setProfiles((current) => (current || []).filter((p) => p.githubLogin !== login))
  }

  const getAllProfiles = () => profiles || []

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signInWithGoogle = async () => {
    const redirectTo = import.meta.env.VITE_AUTH_REDIRECT_URL || `${window.location.origin}/`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
  }

  const signUp = async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })
    if (error) throw error
  }

  const signInWithDevCredentials = async (email: string, userId: string) => {
    const login = email.split('@')[0]
    const mockUser = {
      id: userId,
      login,
      email,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(login)}&background=random`,
      isOwner: false,
    }
    setCurrentUser(mockUser)
    localStorage.setItem('dev-mode-user', JSON.stringify(mockUser))
  }

  const signOut = async () => {
    setCurrentUser(null)
    setUserProfile(null)
    localStorage.removeItem('dev-mode-user')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value: AuthContextType = {
    currentUser,
    userProfile,
    isLoading,
    isAuthenticated: !!currentUser,
    hasRole,
    isAdmin: userProfile?.role === 'admin',
    isGuest: userProfile?.role === 'guest',
    isApproved: userProfile?.status === 'approved',
    isPending: userProfile?.status === 'pending',
    isRejected: userProfile?.status === 'rejected',
    updateUserRole,
    updateUserStatus,
    createUser,
    deleteUser,
    getAllProfiles,
    signInWithEmail,
    signInWithGoogle,
    signUp,
    signInWithDevCredentials,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
