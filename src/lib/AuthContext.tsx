import { createContext, useContext, useState, useEffect, ReactNode, useCallback }


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
  updateUserStatus: 
  deleteUser: (github
}
const AuthContext = createContext<AuthContextType | undefined>(undefi
export function AuthProvider({ children }: { children: Reac
  const [currentUser, setCurrentUser] = use
  const [isLoading, setIsLoading] = u
 

      try {

        setCurrentUser(user)
        const existingProfile = (profiles || []).find(
        )
        if (existingProfile) {
        } else {

            status:
            avatarUrl: user.avatar
           
          setProfiles((current) => {
            if (exists) retu
          })
        }
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
        console.error('Failed to load user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [profiles, setProfiles])

  useEffect(() => {
    if (currentUser) {
      const updatedProfile = (profiles || []).find(
        (p) => p.githubLogin === currentUser.login
      )
      if (updatedProfile && JSON.stringify(updatedProfile) !== JSON.stringify(userProfile)) {
        setUserProfile(updatedProfile)
      }
    }
  }, [profiles, currentUser])

  const updateUserRole = (githubLogin: string, role: UserRole) => {
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

  const updateUserStatus = (githubLogin: string, status: UserStatus) => {
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

  const createUser = (githubLogin: string, role: UserRole) => {
    const newProfile: UserProfile = {
      githubLogin,
      role,
      status: 'pending',
      email: '',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setProfiles((current) => [...(current || []), newProfile])
  }

  const deleteUser = (githubLogin: string) => {
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
  const isRejected = userProfile?.status === 'rejected'

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
        isRejected,
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
    if (!currentUser || isLoading) return
    
    const updatedProfile = (profiles || []).find(
      (p) => p.githubLogin === currentUser.login
    )
    
    if (updatedProfile) {
      setUserProfile(updatedProfile)
    }
  }, [profiles, currentUser?.login, isLoading])

  const updateUserRole = (githubLogin: string, role: UserRole) => {
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

  const updateUserStatus = (githubLogin: string, status: UserStatus) => {
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

  const createUser = (githubLogin: string, role: UserRole) => {
    const newProfile: UserProfile = {
      githubLogin,
      role,
      status: 'pending',
      email: '',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setProfiles((current) => [...(current || []), newProfile])
  }

  const deleteUser = (githubLogin: string) => {
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
  const isRejected = userProfile?.status === 'rejected'

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
        isRejected,
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
