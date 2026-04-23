import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { setSupabaseAuthState } from '@/lib/supabaseAuthState'
import { logAppAudit } from '@/lib/appAudit'
import { deriveUserRoleFromAccessProfileId, hasRequiredAccessLevel, normalizeAccessLevel, resolveDefaultAccessProfileId } from '@/lib/accessControl'
import { ACCESS_ROLES } from '@/types'
import type { AccessLevel, AccessProfile, AccessRoleId, UserProfile, UserRole, UserStatus } from '@/types'

interface AuthContextType {
  currentUser: AppUser | null
  userProfile: UserProfile | null
  currentTenantId: string | null
  tenantName: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isPlatformAdmin: boolean
  isAdmin: boolean
  isGuest: boolean
  isApproved: boolean
  isPending: boolean
  isBlocked: boolean
  accessProfile: AccessProfile | null
  accessLevels: Partial<Record<AccessRoleId, AccessLevel>>
  hasRole: (role: UserRole) => boolean
  hasAccess: (roleId: AccessRoleId, requiredLevel?: AccessLevel) => boolean
  updateUserRole: (login: string, role: UserRole, accessProfileId?: string | null) => Promise<void>
  updateUserStatus: (login: string, status: UserStatus) => Promise<void>
  updateUserProfile: (login: string, updates: { githubLogin?: string; email?: string; avatarUrl?: string }) => Promise<void>
  renameTenant: (name: string) => Promise<void>
  setSessionTenant: (tenantId: string) => Promise<void>
  createUser: (login: string, email: string, role: UserRole, accessProfileId?: string | null) => Promise<void>
  deleteUser: (login: string) => Promise<void>
  getAllProfiles: () => UserProfile[]
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGitHub: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUp: (orgName: string, name: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>
  updatePassword: (password: string) => Promise<void>
  signInWithDevCredentials: (email: string, userId?: string) => Promise<void>
  signOut: () => Promise<void>
}

type OAuthProvider = 'github' | 'google'

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
    accessProfileId: row.access_profile_id || null,
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

function buildFullWriteAccessLevels(): Partial<Record<AccessRoleId, AccessLevel>> {
  return ACCESS_ROLES.reduce((acc, role) => {
    acc[role.id] = 'write'
    return acc
  }, {} as Partial<Record<AccessRoleId, AccessLevel>>)
}

function buildLegacyAccessLevels(role: UserRole): Partial<Record<AccessRoleId, AccessLevel>> {
  if (role === 'admin') {
    return buildFullWriteAccessLevels()
  }

  return {
    properties: 'read',
    owners: 'read',
    calendar: 'read',
    tasks: 'read',
    reports: 'read',
    guests: 'read',
    contracts: 'read',
    documents: 'read',
    inspections: 'read',
    templates: 'read',
    notifications: 'read',
    providers: 'read',
    appointments: 'read',
  }
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function hasAuthCallbackParams() {
  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

  return (
    searchParams.has('code')
    || searchParams.has('token_hash')
    || searchParams.has('type')
    || searchParams.has('error')
    || hashParams.has('access_token')
    || hashParams.has('refresh_token')
    || hashParams.has('token_hash')
    || hashParams.has('type')
    || hashParams.has('error')
  )
}

async function consumeAuthCallbackSession() {
  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const authCode = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash')
  const otpType = searchParams.get('type') || hashParams.get('type')

  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode)
    if (error) throw error
    return
  }

  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    })
    if (error) throw error
  }
}

function cleanupAuthCallbackUrl() {
  const url = new URL(window.location.href)
  const authSearchKeys = ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description', 'state']
  let changed = false

  for (const key of authSearchKeys) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  }

  if (
    url.hash.includes('access_token')
    || url.hash.includes('refresh_token')
    || url.hash.includes('token_hash=')
    || url.hash.includes('type=')
    || url.hash.includes('error=')
  ) {
    url.hash = ''
    changed = true
  }

  if (changed) {
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [tenantProfiles, setTenantProfiles] = useState<UserProfile[]>([])
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [accessProfile, setAccessProfile] = useState<AccessProfile | null>(null)
  const [accessLevels, setAccessLevels] = useState<Partial<Record<AccessRoleId, AccessLevel>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const loggedLoginSessionRef = useRef<string | null>(null)

  useEffect(() => {
    setSupabaseAuthState({
      userId: currentUser?.id ?? null,
      tenantId: currentTenantId,
      isAuthenticated: !!currentUser,
      isApproved: !!userProfile && userProfile.status !== 'blocked',
      isLoading,
    })
  }, [currentUser, currentTenantId, userProfile, isLoading])

  useEffect(() => {
    if (!currentUser || !currentTenantId || userProfile?.status !== 'approved') return
    const sessionKey = `${currentTenantId}:${currentUser.id}`
    if (loggedLoginSessionRef.current === sessionKey) return

    loggedLoginSessionRef.current = sessionKey
    void logAppAudit({
      entity: 'auth',
      action: 'login',
      tenantId: currentTenantId,
      actorAuthUserId: currentUser.id,
      actorLogin: currentUser.login,
    })
  }, [currentUser, currentTenantId, userProfile?.status])

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

  const loadTenantName = useCallback(async (tenantId: string) => {
    const { data, error } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle()
    if (!error && data?.name) {
      setTenantName(data.name)
    }
  }, [])

  const checkPlatformAdmin = useCallback(async (authUserId?: string) => {
    const lookupId = authUserId || currentUser?.id || ''
    if (!lookupId) {
      setIsPlatformAdmin(false)
      return false
    }
    const { data, error } = await supabase
      .from('platform_admins')
      .select('auth_user_id')
      .eq('auth_user_id', lookupId)
      .maybeSingle()
    if (error) {
      setIsPlatformAdmin(false)
      return false
    }
    const allowed = !!data
    setIsPlatformAdmin(allowed)
    return allowed
  }, [currentUser?.id])

  const applySessionTenant = useCallback(async (tenantId: string) => {
    if (!tenantId) return
    setCurrentTenantId(tenantId)
    await loadTenantName(tenantId)
    await loadTenantProfiles(tenantId)
  }, [loadTenantName, loadTenantProfiles])

  const loadPlatformSessionTenant = useCallback(async (authUserId: string, fallbackTenantId: string) => {
    const localFallback = localStorage.getItem('platform-session-tenant') || fallbackTenantId
    const { data, error } = await supabase
      .from('platform_admin_session_tenants')
      .select('tenant_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (error) {
      return localFallback
    }

    return data?.tenant_id || localFallback
  }, [])

  const recoverTenantAdminAccess = useCallback(async (profileRow: any) => {
    if (!profileRow?.tenant_id || !profileRow?.auth_user_id) return profileRow
    if (profileRow.status === 'blocked') return profileRow

    // Recovery path: if a tenant has no approved admin, allow the first authenticated
    // profile in that tenant to bootstrap admin access and avoid approval deadlocks.
    const { data: approvedAdmins, error: adminsError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('tenant_id', profileRow.tenant_id)
      .eq('role', 'admin')
      .eq('status', 'approved')
      .limit(1)

    if (adminsError) return profileRow
    if ((approvedAdmins || []).length > 0) return profileRow

    const { count: tenantProfilesCount, error: countError } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profileRow.tenant_id)

    if (countError) return profileRow

    // Only bootstrap when this is effectively the first account in the tenant.
    if ((tenantProfilesCount ?? 0) > 1) return profileRow

    const { data: recovered, error: recoverError } = await supabase
      .from('user_profiles')
      .update({
        role: 'admin',
        access_profile_id: resolveDefaultAccessProfileId('admin'),
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
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
    return profileRow
  }, [])

  const loadAccessProfile = useCallback(async (tenantId: string, accessProfileId?: string | null) => {
    if (!tenantId) {
      setAccessProfile(null)
      setAccessLevels({})
      return
    }

    if (isPlatformAdmin) {
      setAccessProfile(null)
      setAccessLevels({})
      return
    }

    const resolvedProfileId = accessProfileId || resolveDefaultAccessProfileId((userProfile?.role || 'guest') as UserRole)

    const [{ data: profileRow, error: profileError }, { data: permissionRows, error: permissionsError }] = await Promise.all([
      supabase
        .from('access_profiles')
        .select('tenant_id, id, name, description, is_system, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('id', resolvedProfileId)
        .maybeSingle(),
      supabase
        .from('access_profile_roles')
        .select('tenant_id, access_profile_id, access_role_id, access_level, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('access_profile_id', resolvedProfileId),
    ])

    const shouldUseLegacyFallback = !!profileError || !!permissionsError

    if (shouldUseLegacyFallback) {
      const fallbackRole = (userProfile?.role || 'guest') as UserRole
      console.warn('Access profile schema unavailable; falling back to legacy role-based access.', {
        profileError: profileError?.message || null,
        permissionsError: permissionsError?.message || null,
        fallbackRole,
      })
      setAccessProfile(null)
      setAccessLevels(buildLegacyAccessLevels(fallbackRole))
      return
    }

    setAccessProfile(profileRow ? {
      tenantId: profileRow.tenant_id,
      id: profileRow.id,
      name: profileRow.name,
      description: profileRow.description || '',
      isSystem: profileRow.is_system,
      createdAt: profileRow.created_at,
      updatedAt: profileRow.updated_at,
    } : null)

    const nextAccessLevels = (permissionRows || []).reduce((acc, row: any) => {
      acc[row.access_role_id as AccessRoleId] = normalizeAccessLevel(row.access_level)
      return acc
    }, {} as Partial<Record<AccessRoleId, AccessLevel>>)

    if (Object.keys(nextAccessLevels).length === 0) {
      setAccessLevels(buildLegacyAccessLevels((userProfile?.role || 'guest') as UserRole))
    } else {
      setAccessLevels(nextAccessLevels)
    }
  }, [isPlatformAdmin, userProfile?.role])

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
      setUserProfile(profileFromRow(unlockedExisting))
      const platformAdmin = await checkPlatformAdmin(supabaseUser.id)
      const tenantForSession = platformAdmin
        ? await loadPlatformSessionTenant(supabaseUser.id, unlockedExisting.tenant_id)
        : unlockedExisting.tenant_id
      await applySessionTenant(tenantForSession)
      await loadAccessProfile(unlockedExisting.tenant_id, unlockedExisting.access_profile_id || null)
      localStorage.setItem('platform-session-tenant', tenantForSession)
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
          setUserProfile(profileFromRow(unlockedClaimed))
          const platformAdmin = await checkPlatformAdmin(supabaseUser.id)
          const tenantForSession = platformAdmin
            ? await loadPlatformSessionTenant(supabaseUser.id, unlockedClaimed.tenant_id)
            : unlockedClaimed.tenant_id
          await applySessionTenant(tenantForSession)
          await loadAccessProfile(unlockedClaimed.tenant_id, unlockedClaimed.access_profile_id || null)
          localStorage.setItem('platform-session-tenant', tenantForSession)
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
          role: 'guest',
          access_profile_id: resolveDefaultAccessProfileId('guest'),
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

    setUserProfile(profileFromRow(newProfile))
    await applySessionTenant(tenant.id)
    await loadAccessProfile(tenant.id, newProfile.access_profile_id || null)
    setTenantName(tenant.name)
  }, [recoverTenantAdminAccess, ensureSelfApprovedAccess, checkPlatformAdmin, applySessionTenant, loadPlatformSessionTenant, loadAccessProfile])

  const clearAuthState = useCallback(() => {
    setCurrentUser(null)
    setUserProfile(null)
    setCurrentTenantId(null)
    setTenantName(null)
    setTenantProfiles([])
    setIsPlatformAdmin(false)
    setAccessProfile(null)
    setAccessLevels({})
  }, [])

  const getOAuthRedirectTo = useCallback(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const baseUrl = isLocalhost
      ? window.location.origin
      : (import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin)

    const redirectUrl = new URL(baseUrl)
    redirectUrl.pathname = '/auth/callback'
    redirectUrl.search = ''
    redirectUrl.hash = ''
    return redirectUrl.toString()
  }, [])

  const signInWithOAuthProvider = useCallback(async (provider: OAuthProvider) => {
    const redirectTo = getOAuthRedirectTo()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    })

    if (error) throw error
  }, [getOAuthRedirectTo])

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
              accessProfileId: resolveDefaultAccessProfileId('admin'),
              email: devUser.email, avatarUrl: devUser.avatarUrl,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            }
            setCurrentUser(devUser)
            setCurrentTenantId(tenantId)
            setTenantName('Dev Organization')
            setUserProfile(mockProfile)
            setTenantProfiles([mockProfile])
            setAccessProfile({
              id: resolveDefaultAccessProfileId('admin'),
              tenantId,
              name: 'Administrador',
              description: 'Acesso completo ao sistema.',
              isSystem: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            setAccessLevels(buildFullWriteAccessLevels())
            setIsLoading(false)
          }
          return
        }

        const startedFromAuthCallback = hasAuthCallbackParams()
        if (startedFromAuthCallback) {
          try {
            await consumeAuthCallbackSession()
          } catch (callbackError) {
            console.error('Failed to consume Supabase auth callback:', callbackError)
          }
        }

        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Failed to restore Supabase session:', error)
        }

        if (data.session?.user && isMounted) {
          await loadOrCreateProfile(data.session.user)
        }

        if (startedFromAuthCallback) {
          cleanupAuthCallbackUrl()
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return

      // Avoid async work directly inside the Supabase auth callback.
      // TOKEN_REFRESHED is frequent and should not trigger a full profile reload.
      window.setTimeout(() => {
        if (!isMounted) return

        if (event === 'SIGNED_OUT') {
          clearAuthState()
          setIsLoading(false)
          return
        }

        if (event === 'TOKEN_REFRESHED') {
          setIsLoading(false)
          return
        }

        if (session?.user) {
          void loadOrCreateProfile(session.user).finally(() => {
            if (isMounted) {
              cleanupAuthCallbackUrl()
              setIsLoading(false)
            }
          })
          return
        }

        clearAuthState()
        setIsLoading(false)
      }, 0)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [loadOrCreateProfile, clearAuthState])

  const hasRole = (role: UserRole) => userProfile?.role === role

  const hasAccess = (roleId: AccessRoleId, requiredLevel: AccessLevel = 'read') => {
    if (isPlatformAdmin) return true
    return hasRequiredAccessLevel(accessLevels[roleId], requiredLevel)
  }

  const updateUserRole = async (login: string, role: UserRole, accessProfileId?: string | null) => {
    if (!currentTenantId) return
    const resolvedAccessProfileId = accessProfileId || resolveDefaultAccessProfileId(role)
    const { error } = await supabase
      .from('user_profiles')
      .update({
        role,
        access_profile_id: resolvedAccessProfileId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', currentTenantId)
      .eq('github_login', login)
    if (error) throw error
    setTenantProfiles(prev => prev.map(p => p.githubLogin === login ? { ...p, role } : p))
    await logAppAudit({ entity: 'user_profiles', action: 'update', recordId: login, tenantId: currentTenantId, actorAuthUserId: currentUser?.id, actorLogin: currentUser?.login })
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
    await logAppAudit({ entity: 'user_profiles', action: 'update', recordId: login, tenantId: currentTenantId, actorAuthUserId: currentUser?.id, actorLogin: currentUser?.login })
  }

  const updateUserProfile = async (
    login: string,
    updates: { githubLogin?: string; email?: string; avatarUrl?: string }
  ) => {
    if (!currentTenantId) return
    const payload: Record<string, string> = {
      updated_at: new Date().toISOString(),
    }
    if (typeof updates.githubLogin === 'string') payload.github_login = updates.githubLogin
    if (typeof updates.email === 'string') payload.email = updates.email
    if (typeof updates.avatarUrl === 'string') payload.avatar_url = updates.avatarUrl

    const { data, error } = await supabase
      .from('user_profiles')
      .update(payload)
      .eq('tenant_id', currentTenantId)
      .eq('github_login', login)
      .select()
      .single()

    if (error) throw error
    const updatedProfile = profileFromRow(data)
    setTenantProfiles(prev => prev.map(p => p.githubLogin === login ? updatedProfile : p))

    if (userProfile?.githubLogin === login) {
      setUserProfile(updatedProfile)
    }
    if (currentUser?.login === login) {
      setCurrentUser(prev => prev ? {
        ...prev,
        login: updatedProfile.githubLogin,
        email: updatedProfile.email,
        avatarUrl: updatedProfile.avatarUrl,
      } : prev)
    }
    await logAppAudit({ entity: 'user_profiles', action: 'update', recordId: updatedProfile.githubLogin, tenantId: currentTenantId, actorAuthUserId: currentUser?.id, actorLogin: currentUser?.login })
  }

  const renameTenant = async (name: string) => {
    if (!currentTenantId) return
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Tenant name cannot be empty')

    const { error } = await supabase
      .from('tenants')
      .update({ name: trimmed })
      .eq('id', currentTenantId)

    if (error) throw error
    setTenantName(trimmed)
    await logAppAudit({ entity: 'tenants', action: 'update', recordId: currentTenantId, tenantId: currentTenantId, actorAuthUserId: currentUser?.id, actorLogin: currentUser?.login })
  }

  const setSessionTenant = async (tenantId: string) => {
    if (!isPlatformAdmin) {
      throw new Error('Only platform admins can change session tenant.')
    }
    if (!currentUser?.id || !isUuid(currentUser.id)) {
      throw new Error('Current user id is not a valid UUID for session tenant update.')
    }

    const { error: rpcError } = await supabase.rpc('set_platform_session_tenant', {
      p_tenant_id: tenantId,
    })

    if (rpcError) {
      // Backward-compatible fallback while migration with RPC is not applied.
      const { error: upsertError } = await supabase
        .from('platform_admin_session_tenants')
        .upsert({
          auth_user_id: currentUser.id,
          tenant_id: tenantId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'auth_user_id' })
      if (upsertError) {
        throw upsertError
      }
    }

    await applySessionTenant(tenantId)
    localStorage.setItem('platform-session-tenant', tenantId)
  }

  const createUser = async (login: string, email: string, role: UserRole, accessProfileId?: string | null) => {
    if (!currentTenantId) {
      throw new Error('Tenant context is not loaded. Please sign in again and retry.')
    }
    const resolvedRole = accessProfileId ? deriveUserRoleFromAccessProfileId(accessProfileId) : role
    const resolvedAccessProfileId = accessProfileId || resolveDefaultAccessProfileId(resolvedRole)
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        tenant_id: currentTenantId,
        github_login: login,
        role: resolvedRole,
        access_profile_id: resolvedAccessProfileId,
        status: 'approved',
        email,
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(login)}&background=random`,
      })
      .select()
      .single()
    if (error) throw error
    const created = profileFromRow(data)
    setTenantProfiles(prev => [...prev, created])
    await logAppAudit({ entity: 'user_profiles', action: 'create', recordId: created.githubLogin, tenantId: currentTenantId, actorAuthUserId: currentUser?.id, actorLogin: currentUser?.login })
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
    await logAppAudit({ entity: 'user_profiles', action: 'delete', recordId: login, tenantId: currentTenantId, actorAuthUserId: currentUser?.id, actorLogin: currentUser?.login })
  }

  const getAllProfiles = () => tenantProfiles

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signInWithGitHub = async () => {
    await signInWithOAuthProvider('github')
  }

  const signInWithGoogle = async () => {
    await signInWithOAuthProvider('google')
  }

  const signUp = async (orgName: string, name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, user_name: name, org_name: orgName } },
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

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  const signInWithDevCredentials = async (email: string, userId?: string) => {
    const tenantId = import.meta.env.VITE_DEV_TENANT_ID || 'dev-tenant'
    const mockUser = buildDevUser(email, userId)
    const mockProfile: UserProfile = {
      githubLogin: mockUser.login, role: 'admin', status: 'approved',
      accessProfileId: resolveDefaultAccessProfileId('admin'),
      email, avatarUrl: mockUser.avatarUrl,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    setCurrentUser(mockUser)
    setCurrentTenantId(tenantId)
    setTenantName('Dev Organization')
    setUserProfile(mockProfile)
    setTenantProfiles([mockProfile])
    setAccessProfile({
      id: resolveDefaultAccessProfileId('admin'),
      tenantId,
      name: 'Administrador',
      description: 'Acesso completo ao sistema.',
      isSystem: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setAccessLevels(buildFullWriteAccessLevels())
    localStorage.setItem('dev-mode-user', JSON.stringify(mockUser))
  }

  const signOut = async () => {
    const logoutUser = currentUser
    const logoutTenantId = currentTenantId
    if (logoutUser && logoutTenantId) {
      await logAppAudit({
        entity: 'auth',
        action: 'logout',
        tenantId: logoutTenantId,
        actorAuthUserId: logoutUser.id,
        actorLogin: logoutUser.login,
      })
    }
    loggedLoginSessionRef.current = null
    setCurrentUser(null)
    setUserProfile(null)
    setCurrentTenantId(null)
    setTenantName(null)
    setTenantProfiles([])
    setIsPlatformAdmin(false)
    localStorage.removeItem('dev-mode-user')
    localStorage.removeItem('platform-session-tenant')
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
    isPlatformAdmin,
    accessProfile,
    accessLevels,
    hasRole,
    hasAccess,
    isAdmin: userProfile?.role === 'admin',
    isGuest: userProfile?.role === 'guest',
    isApproved: !!userProfile && userProfile.status !== 'blocked',
    isPending: userProfile?.status === 'pending',
    isBlocked: userProfile?.status === 'blocked',
    updateUserRole,
    updateUserStatus,
    updateUserProfile,
    renameTenant,
    setSessionTenant,
    createUser,
    deleteUser,
    getAllProfiles,
    signInWithEmail,
    signInWithGitHub,
    signInWithGoogle,
    signUp,
    updatePassword,
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
