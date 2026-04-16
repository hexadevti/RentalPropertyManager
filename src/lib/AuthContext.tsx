import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useKV } from '@github/spark/hooks'

type UserRole = 'admin' | 'guest'

interface UserProfile {
  githubLogin: string
  role: UserRole
  email: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
}

interface AuthContextType {
  currentUser: {
    login: string
    email: string
    avatarUrl: string
    id: string
    isOwner: boolean
  } | null
  userProfile: UserProfile | null
  isLoading: boolean
  hasRole: (role: UserRole) => boolean
  isAdmin: boolean
  isGuest: boolean
  updateUserRole: (githubLogin: string, role: UserRole) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {

  const [currentUser, setCurrentUser] = useState<AuthContextType['currentUser']>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profiles, setProfiles] = useKV<UserProfile[]>('user-profiles', [])

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await spark.user()
        setCurrentUser(user)

        const existingProfile = (profiles || []).find(
          (p) => p.githubLogin === user.login
        )

        if (existingProfile) {
          setUserProfile(existingProfile)
        } else {
          const newProfile: UserProfile = {
            githubLogin: user.login,
            role: user.isOwner ? 'admin' : 'guest',
            email: user.email,
            avatarUrl: user.avatarUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          
          setProfiles((current) => [...(current || []), newProfile])
          setUserProfile(newProfile)
        }
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  const updateUserRole = async (githubLogin: string, role: UserRole) => {
    setProfiles((current) =>
      (current || []).map((p) =>
        p.githubLogin === githubLogin
          ? { ...p, role, updatedAt: new Date().toISOString() }
          : p
      )
    )

    if (userProfile?.githubLogin === githubLogin) {
      setUserProfile((prev) =>
        prev ? { ...prev, role, updatedAt: new Date().toISOString() } : null
      )
    }
  }

  const hasRole = (role: UserRole) => {
    return userProfile?.role === role
  }

  const isAdmin = userProfile?.role === 'admin'
  const isGuest = userProfile?.role === 'guest'

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isLoading,
        hasRole,
        isAdmin,
        isGuest,
        updateUserRole,
      }}
    >
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
