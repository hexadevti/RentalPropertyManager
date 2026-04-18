import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { setSupabaseAuthState } from '@/lib/supabaseAuthState'
import type { UserProfile, UserRole, UserStatus } from '@/types'

interface AuthContextType {
  currentUser: AppUser | null
  userProfile: UserProfile | null
  currentTenantId: string | null
  tenantName: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  isGuest: boolean
  isApproved: boolean
  isPending: boolean
  isRejected: boolean
  hasRole: (role: UserRole) => boolean
  updateUserRole: (login: string, role: UserRole) => Promise<void>
  updateUserStatus: (login: string, status: UserStatus) => Promise<void>
  createUser: (login: string, email: string, role: UserRole) => Promise<void>
  deleteUser: (login: string) => Promise<void>
  getAllProfiles: () => UserProfile[]
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGitHub: () => Promise<void>
  signUp: (orgName: string, name: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>
  signInWithDevCredentials: (email: string, userId?: string) => Promise<void>
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

  return { id: String(user?.id || login), login, email, avatarUrl, isOwner: false }
}

function profileFromRow(row: any): UserProfile {
  return {
    githubLogin: row.github_login,
    role: row.role,
    status: row.status,
    email: row.email,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildDevUser(email: string, userId?: string): AppUser {
  const login = email.split('@')[0] || 'dev-user'
  const resolvedUserId = userId?.trim() || `dev-${login}`

  return {
    id: resolvedUserId,
    login,
    email,
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(login)}&background=random`,
    isOwner: false,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [tenantProfiles, setTenantProfiles] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setSupabaseAuthState({
      userId: currentUser?.id ?? null,
      tenantId: currentTenantId,
      isAuthenticated: !!currentUser,
      isApproved: userProfile?.status === 'approved',
      isLoading,
    })
  }, [currentUser, currentTenantId, userProfile, isLoading])

  const loadTenantProfiles = useCallback(async (tenantId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
    if (!error) {
      setTenantProfiles((data || []).map(profileFromRow))
    }
  }, [])

  const recoverTenantAdminAccess = useCallback(async (profileRow: any) => {
    if (!profileRow?.tenant_id || !profileRow?.auth_user_id) return profileRow

    // Recovery path: if a tenant has no approved admin, promote the current authenticated user.
    const { data: approvedAdmins, error: adminsError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('tenant_id', profileRow.tenant_id)
      .eq('role', 'admin')
      .eq('status', 'approved')
      .limit(1)

    if (adminsError) return profileRow
    if ((approvedAdmins || []).length > 0) return profileRow

    const { data: recovered, error: recoverError } = await supabase
      .from('user_profiles')
      .update({ role: 'admin', status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', profileRow.id)
      .eq('auth_user_id', profileRow.auth_user_id)
      .select()
      .single()

    if (recoverError || !recovered) return profileRow
    return recovered
  }, [])

  const ensureSelfApprovedAccess = useCallback(async (profileRow: any, authUserId: string) => {
    if (!profileRow?.id || !authUserId) return profileRow
    if (profileRow.auth_user_id !== authUserId) return profileRow
    if (profileRow.status === 'approved') return profileRow

    // Final fallback to prevent approval deadlocks for the currently authenticated user.
    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update({ role: 'admin', status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', profileRow.id)
      .eq('auth_user_id', authUserId)
      .select()
      .single()

    if (error || !updated) return profileRow
    return updated
  }, [])

  const loadOrCreateProfile = useCallback(async (supabaseUser: any) => {
    const appUser = toAppUser(supabaseUser)
    setCurrentUser(appUser)

    // Find by auth_user_id
    const { data: existing, error: existingError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', supabaseUser.id)
      .maybeSingle()

    if (existingError) {
      console.error('Failed to query user profile by auth_user_id:', existingError)
      return
    }

    if (existing) {
      const recoveredExisting = await recoverTenantAdminAccess(existing)
      const unlockedExisting = await ensureSelfApprovedAccess(recoveredExisting, supabaseUser.id)
      setCurrentTenantId(unlockedExisting.tenant_id)
      setUserProfile(profileFromRow(unlockedExisting))
      await loadTenantProfiles(unlockedExisting.tenant_id)
      return
    }

    // Find pre-invited profile by email
    if (supabaseUser.email) {
      const { data: invited, error: invitedError } = await supabase
        .from('user_profiles')
        .select('*')
        .is('auth_user_id', null)
        .eq('email', supabaseUser.email)
        .maybeSingle()

      if (invitedError) {
        console.error('Failed to query invited profile by email:', invitedError)
        return
      }

      if (invited) {
        const { data: claimed } = await supabase
          .from('user_profiles')
          .update({ auth_user_id: supabaseUser.id, updated_at: new Date().toISOString() })
          .eq('id', invited.id)
          .select()
          .single()

        if (claimed) {
          const recoveredClaimed = await recoverTenantAdminAccess(claimed)
          const unlockedClaimed = await ensureSelfApprovedAccess(recoveredClaimed, supabaseUser.id)
          setCurrentTenantId(unlockedClaimed.tenant_id)
          setUserProfile(profileFromRow(unlockedClaimed))
          await loadTenantProfiles(unlockedClaimed.tenant_id)
          return
        }
      }
    }

    // New user: create tenant + profile
    const orgName = supabaseUser.user_metadata?.org_name || `${appUser.login}'s Organization`

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ name: orgName })
      .select()
      .single()

    if (tenantError) {
      console.error('Failed to create tenant:', tenantError)
      return
    }

    // Derive a clean login handle; sanitise to [a-z0-9._-] and handle UNIQUE conflicts.
    const loginBase = appUser.login.toLowerCase().replace(/[^a-z0-9._-]/g, '') ||
      `user-${appUser.id.slice(0, 8)}`
    const now = new Date().toISOString()
    let newProfile = null
    for (let attempt = 0; attempt <= 9; attempt++) {
      const loginAttempt = attempt === 0 ? loginBase : `${loginBase}-${attempt}`
      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          auth_user_id: supabaseUser.id,
          tenant_id: tenant.id,
          github_login: loginAttempt,
          role: 'admin',
          status: 'approved',
          email: supabaseUser.email || appUser.email,
          avatar_url: appUser.avatarUrl,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single()
      if (!error) { newProfile = data; break }
      if (error.code !== '23505') { // not a unique-constraint violation
        console.error('Failed to create profile:', error)
        return
      }
    }

    if (!newProfile) {
      console.error('Failed to create profile: could not generate unique login for', loginBase)
      return
    }

    setCurrentTenantId(tenant.id)
    setTenantName(tenant.name)
    setUserProfile(profileFromRow(newProfile))
    setTenantProfiles([profileFromRow(newProfile)])
  }, [loadTenantProfiles, recoverTenantAdminAccess, ensureSelfApprovedAccess])

  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        if (import.meta.env.VITE_DEV_MODE === 'true') {
          const email = import.meta.env.VITE_DEV_USER_EMAIL || 'dev@dev.com'
          const password = import.meta.env.VITE_DEV_USER_PASSWORD
          const userId = import.meta.env.VITE_DEV_USER_ID || 'dev-user'
          const tenantId = import.meta.env.VITE_DEV_TENANT_ID || 'dev-tenant'

          const { data: existingSession } = await supabase.auth.getSession()
          if (existingSession.session?.user && isMounted) {
            await loadOrCreateProfile(existingSession.session.user)
            return
          }

          if (password) {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            })

            if (signInError) {
              console.error('Failed to sign in with development credentials:', signInError)
            } else if (signInData.user && isMounted) {
              await loadOrCreateProfile(signInData.user)
              return
            }
          }

          let devUserJson = localStorage.getItem('dev-mode-user')
          if (!devUserJson) {
            const mockUser = buildDevUser(email, userId)
            localStorage.setItem('dev-mode-user', JSON.stringify(mockUser))
            devUserJson = JSON.stringify(mockUser)
          }

          if (isMounted) {
            const devUser = JSON.parse(devUserJson)
            const mockProfile: UserProfile = {
              githubLogin: devUser.login, role: 'admin', status: 'approved',
              email: devUser.email, avatarUrl: devUser.avatarUrl,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            }
            setCurrentUser(devUser)
            setCurrentTenantId(tenantId)
            setTenantName('Dev Organization')
            setUserProfile(mockProfile)
            setTenantProfiles([mockProfile])
            setIsLoading(false)
          }
          return
        }

        const { data } = await supabase.auth.getSession()
        if (data.session?.user && isMounted) {
          await loadOrCreateProfile(data.session.user)
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      if (session?.user) {
        await loadOrCreateProfile(session.user)
      } else {
        setCurrentUser(null)
        setUserProfile(null)
        setCurrentTenantId(null)
        setTenantName(null)
        setTenantProfiles([])
      }
      if (isMounted) setIsLoading(false)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [loadOrCreateProfile])

  const hasRole = (role: UserRole) => userProfile?.role === role

  const updateUserRole = async (login: string, role: UserRole) => {
    if (!currentTenantId) return
    const { error } = await supabase
      .from('user_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('tenant_id', currentTenantId)
      .eq('github_login', login)
    if (error) throw error
    setTenantProfiles(prev => prev.map(p => p.githubLogin === login ? { ...p, role } : p))
  }

  const updateUserStatus = async (login: string, status: UserStatus) => {
    if (!currentTenantId) return
    const { error } = await supabase
      .from('user_profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tenant_id', currentTenantId)
      .eq('github_login', login)
    if (error) throw error
    setTenantProfiles(prev => prev.map(p => p.githubLogin === login ? { ...p, status } : p))
  }

  const createUser = async (login: string, email: string, role: UserRole) => {
    if (!currentTenantId) {
      throw new Error('Tenant context is not loaded. Please sign in again and retry.')
    }
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        tenant_id: currentTenantId,
        github_login: login,
        role,
        status: 'pending',
        email,
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(login)}&background=random`,
      })
      .select()
      .single()
    if (error) throw error
    setTenantProfiles(prev => [...prev, profileFromRow(data)])
  }

  const deleteUser = async (login: string) => {
    if (!currentTenantId) return
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('tenant_id', currentTenantId)
      .eq('github_login', login)
    if (error) throw error
    setTenantProfiles(prev => prev.filter(p => p.githubLogin !== login))
  }

  const getAllProfiles = () => tenantProfiles

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signInWithGitHub = async () => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const redirectTo = isLocalhost
      ? `${window.location.origin}/`
      : (import.meta.env.VITE_AUTH_REDIRECT_URL || `${window.location.origin}/`)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo },
    })
    if (error) throw error
  }

  const signUp = async (orgName: string, name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, org_name: orgName } },
    })
    if (error) throw error
    if (!data.user) {
      throw new Error('Falha ao criar usuário no Supabase Auth. Verifique Email Auth e configurações do projeto.')
    }
    // Supabase may return an obfuscated user for existing accounts when email confirmation is enabled.
    if (!data.session && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('User already registered')
    }
    // Session present → email confirmation disabled; create profile immediately.
    if (data.session && data.user) {
      await loadOrCreateProfile(data.user)
      return { needsEmailConfirmation: false }
    }
    // No session → user was created in auth.users but must confirm email first.
    // The trigger (116_create_profile_on_auth_signup.sql) will create the profile
    // when the user clicks the confirmation link and a session is established.
    return { needsEmailConfirmation: true }
  }

  const signInWithDevCredentials = async (email: string, userId?: string) => {
    const tenantId = import.meta.env.VITE_DEV_TENANT_ID || 'dev-tenant'
    const mockUser = buildDevUser(email, userId)
    const mockProfile: UserProfile = {
      githubLogin: mockUser.login, role: 'admin', status: 'approved',
      email, avatarUrl: mockUser.avatarUrl,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    setCurrentUser(mockUser)
    setCurrentTenantId(tenantId)
    setTenantName('Dev Organization')
    setUserProfile(mockProfile)
    setTenantProfiles([mockProfile])
    localStorage.setItem('dev-mode-user', JSON.stringify(mockUser))
  }

  const signOut = async () => {
    setCurrentUser(null)
    setUserProfile(null)
    setCurrentTenantId(null)
    setTenantName(null)
    setTenantProfiles([])
    localStorage.removeItem('dev-mode-user')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value: AuthContextType = {
    currentUser,
    userProfile,
    currentTenantId,
    tenantName,
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
    signInWithGitHub,
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
