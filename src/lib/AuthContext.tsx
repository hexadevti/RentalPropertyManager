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
  currentUser: any | null
  userProfile: UserProfile | null
  isLoading: boolean
  hasRole: (role: UserRole) => boolean
  isAdmin: boolean
  isGuest: boolean
  isApproved: boolean
  isPending: boolean
  isRejected: boolean
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

    async function loadUser() {
      try {
        const user = await spark.user()
        if (!isMounted) return

        setCurrentUser(user)
        const existingProfile = (profiles || []).find(
          (p) => p.githubLogin === user.login
        )
        
        if (existingProfile) {
          const newProfile: UserProfile =
            role
            email: user.email,
            createdAt: new Date().to
          }
          setUserProfile(newProfile)
      } catch (error) {
      } finally {
          setIsLoading(false)
      }

    
      isMounted = false
  }, [])
  useEffect(() => {
    
      (p) => p.gi






















































































































