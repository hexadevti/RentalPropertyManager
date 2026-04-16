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
    login: strin
    avatarUrl: st
    isOwner: bool
  userProfile: UserPr
  hasRole: (ro
  isGuest: boolean
  isPendin
  updateUserRole: (githubLogin: s
  createUser: (githu
  getAllProfiles: () => UserProfile[]


  const [currentUser,
  const [isLoading, 
  isRejected: boolean
  useEffect(() => {
      try {
        setCurrentUser(user)
        const existingProfile = (profiles || []).fin
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
            updated
          
          s
      } catch (error) {
      } finally {


  }, [])
  useEffe

      )
        setUserProfile(updatedProfile)
    }

    setProfiles((current) =>
        p.githubLogin === githubLogin
          : p
    )
    if (userProfile?.githubLogin === g
        prev ? { ...prev, role, updatedAt: new D
    }

    setPro
        p.githubLogin === githubLogin
          : p
    )
    if (userProfile?.gi
        prev ? { ...prev, status, updatedAt: new Da
    }

    con
     

      createdA
    }

  useEffect(() => {
    if (currentUser) {
      const updatedProfile = (profiles || []).find(
        (p) => p.githubLogin === currentUser.login
      )
      if (updatedProfile && JSON.stringify(updatedProfile) !== JSON.stringify(userProfile)) {
        setUserProfile(updatedProfile)
      }
    }
  }, [profiles, currentUser])> {
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
