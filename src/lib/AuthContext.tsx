import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useKV } from '@github/spark/hooks'


  githubLogin: string

  avatarUrl: string
  updatedAt: string

  currentUser: any |
  isLoading: bo
  isAdmin: boolean
  isApproved: boole
  isRejected: boole
 

}
const AuthContext = creat
export function AuthProvider({ ch
  const [userProfile
  const [profiles, setProfiles] = useK
  useEffect(() => 

      try {
        if (!isMount
        setCurrentUse
          (p) => p.githubLogin === user.login
        
          setUserProfile(existingProfile)
          const newProfile: UserProfile = {
            role: user.isOwner ? 'adm
 

          }

      } catch (error) {
      } finally {
      }



  }, [])
  useEffect(() => {

      )
        set
    }



    setProfiles((currentProfiles) =>
        p.githubLogin === githubLogin
         
    )

          setUserProfile(existingProfile)
        } else {
          const newProfile: UserProfile = {
            githubLogin: user.login,
            role: user.isOwner ? 'admin' : 'guest',
            status: user.isOwner ? 'approved' : 'pending',

            avatarUrl: user.avatarUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
      email
          setProfiles((currentProfiles) => [...currentProfiles, newProfile])
      updatedAt: new Date().toISOStr
        }
  }
        console.error('Failed to load user:', error)
    setProfiles((
        setIsLoading(false)

    }

    loadUser()

    return () => {
    hasRole,
    }
    isAp

    updateUserRole,
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
