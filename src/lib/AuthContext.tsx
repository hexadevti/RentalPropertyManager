import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useKV } from '@github/spark/hooks'

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
  isAdmin: boolean
  isGuest: boolean
  isApproved: boolean
  isPending: boolean
  isRejected: boolean
  hasRole: (role: UserRole) => boolean
  updateUserRole: (githubLogin: string, role: UserRole) => void
  updateUserStatus: (githubLogin: string, status: UserStatus) => void
  createUser: (githubLogin: string, role: UserRole) => void
  deleteUser: (githubLogin: string) => void
  getAllProfiles: () => UserProfile[]
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profiles, setProfiles] = useKV<UserProfile[]>('user-profiles', [])

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      try {
        const user = await spark.user()
        
        if (!isMounted) return
        
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
            email: user.email || '',
            avatarUrl: user.avatarUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          
          setProfiles((currentProfiles) => [...currentProfiles, newProfile])
          setUserProfile(newProfile)
        }
      } catch (error) {
        console.error('Failed to load user:', error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadUser()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (currentUser && profiles.length > 0) {
      const updatedProfile = profiles.find(
        (p) => p.githubLogin === currentUser.login
      )
      if (updatedProfile) {
        setUserProfile(updatedProfile)
      }
    }
  }, [profiles, currentUser])

  const hasRole = (role: UserRole) => {
    return userProfile?.role === role
  }

  const updateUserRole = (githubLogin: string, role: UserRole) => {
    setProfiles((currentProfiles) =>
      currentProfiles.map((p) =>
        p.githubLogin === githubLogin
          ? { ...p, role, updatedAt: new Date().toISOString() }
          : p
      )
    )
  }

  const updateUserStatus = (githubLogin: string, status: UserStatus) => {
    setProfiles((currentProfiles) =>
      currentProfiles.map((p) =>
        p.githubLogin === githubLogin
          ? { ...p, status, updatedAt: new Date().toISOString() }
          : p
      )
    )
  }

  const createUser = (githubLogin: string, role: UserRole) => {
    const newProfile: UserProfile = {
      githubLogin,
      role,
      status: 'pending',
      email: '',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setProfiles((currentProfiles) => [...currentProfiles, newProfile])
  }

  const deleteUser = (githubLogin: string) => {
    setProfiles((currentProfiles) =>
      currentProfiles.filter((p) => p.githubLogin !== githubLogin)
    )
  }

  const getAllProfiles = () => {
    return profiles || []
  }

  const value: AuthContextType = {
    currentUser,
    userProfile,
    isLoading,
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
    getAllProfiles
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
