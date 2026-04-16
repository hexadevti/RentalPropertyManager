import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useKV } from '@github/spark/hooks'

type UserRole = 'admin' | 'guest'
type UserStatus = 'approved' | 'pending' | 'rejected'

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
  isApproved: boolean
  isPending: boolean
  updateUserRole: (githubLogin: string, role: UserRole) => Promise<void>
  updateUserStatus: (githubLogin: string, status: UserStatus) => Promise<void>
  createUser: (githubLogin: string, email: string, role: UserRole) => Promise<void>
  deleteUser: (githubLogin: string) => Promise<void>
  getAllProfiles: () => UserProfile[]
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
            status: user.isOwner ? 'approved' : 'pending',
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

  const updateUserStatus = async (githubLogin: string, status: UserStatus) => {
    setProfiles((current) =>
      (current || []).map((p) =>
        p.githubLogin === githubLogin
          ? { ...p, status, updatedAt: new Date().toISOString() }
          : p
      )
    )

    if (userProfile?.githubLogin === githubLogin) {
      setUserProfile((prev) =>
        prev ? { ...prev, status, updatedAt: new Date().toISOString() } : null
      )
    }
  }

  const createUser = async (githubLogin: string, email: string, role: UserRole) => {
    const newProfile: UserProfile = {
      githubLogin,
      role,
      status: 'approved',
      email,
      avatarUrl: `https://github.com/${githubLogin}.png`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setProfiles((current) => [...(current || []), newProfile])
  }

  const deleteUser = async (githubLogin: string) => {
    setProfiles((current) =>
      (current || []).filter((p) => p.githubLogin !== githubLogin)
    )
  }

  const getAllProfiles = () => {
    return profiles || []
  }

  const hasRole = (role: UserRole) => {
    return userProfile?.role === role
  }

  const isAdmin = userProfile?.role === 'admin'
  const isGuest = userProfile?.role === 'guest'
  const isApproved = userProfile?.status === 'approved'
  const isPending = userProfile?.status === 'pending'

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isLoading,
        hasRole,
        isAdmin,
        isGuest,
        isApproved,
        isPending,
        updateUserRole,
        updateUserStatus,
        createUser,
        deleteUser,
        getAllProfiles,
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
