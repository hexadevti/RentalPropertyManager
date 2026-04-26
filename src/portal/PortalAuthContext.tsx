import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { portalGuestSignIn, portalGuestSignUp, portalGuestResetPassword } from './portalApi'
import type { PortalUser, PortalTenant } from './types'

interface PortalAuthContextValue {
  portalUser: PortalUser | null
  isLoading: boolean
  isAuthenticated: boolean
  tenant: PortalTenant | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (name: string, email: string, password: string, phone: string) => Promise<{ error: string | null }>
  resetGuestPassword: (email: string, phone: string, newPassword: string) => Promise<{ error: string | null }>
  signInWithGoogle: (registration?: { name?: string; phone?: string }) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null)

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext)
  if (!ctx) throw new Error('usePortalAuth must be used inside PortalAuthProvider')
  return ctx
}

interface PortalAuthProviderProps {
  tenant: PortalTenant
  children: ReactNode
}

export function PortalAuthProvider({ tenant, children }: PortalAuthProviderProps) {
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const guestSessionKey = `portal_guest_session_${tenant.slug}`

  const saveGuestSession = (user: PortalUser) => {
    sessionStorage.setItem(guestSessionKey, JSON.stringify({
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
    }))
  }

  const clearGuestSession = () => {
    sessionStorage.removeItem(guestSessionKey)
  }

  useEffect(() => {
    const guestSessionRaw = sessionStorage.getItem(guestSessionKey)
    if (guestSessionRaw) {
      try {
        const sessionUser = JSON.parse(guestSessionRaw) as {
          id: string
          tenantId: string
          name: string
          email: string
          phone: string | null
          createdAt: string
        }
        if (sessionUser.tenantId === tenant.id) {
          setPortalUser({
            id: sessionUser.id,
            authUserId: null,
            tenantId: sessionUser.tenantId,
            name: sessionUser.name,
            email: sessionUser.email,
            phone: sessionUser.phone,
            status: 'active',
            createdAt: sessionUser.createdAt,
          })
        } else {
          clearGuestSession()
          setPortalUser(null)
        }
      } catch {
        clearGuestSession()
        setPortalUser(null)
      }
    } else {
      setPortalUser(null)
    }

    setIsLoading(false)

    return () => {
      // no-op cleanup
    }
  }, [tenant.id, tenant.slug])

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const guestUser = await portalGuestSignIn({
        tenantId: tenant.id,
        email,
        password,
      })
      if (guestUser) {
        setPortalUser(guestUser)
        saveGuestSession(guestUser)
        return { error: null }
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Falha ao entrar.' }
    }

    return { error: 'Usuario nao existe no portal de reservas. Cadastre-se ou recupere sua senha.' }
  }

  const signUp = async (
    name: string,
    email: string,
    password: string,
    phone: string,
  ): Promise<{ error: string | null }> => {
    if (!phone.trim()) {
      return { error: 'Informe seu telefone para contato.' }
    }

    try {
      const guestUser = await portalGuestSignUp({
        tenantId: tenant.id,
        name,
        email,
        phone,
        password,
      })

      if (guestUser) {
        setPortalUser(guestUser)
        saveGuestSession(guestUser)
        return { error: null }
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Falha ao cadastrar.' }
    }

    return { error: 'Não foi possível concluir o cadastro. Verifique os dados e tente novamente.' }
  }

  const signInWithGoogle = async (registration?: { name?: string; phone?: string }): Promise<{ error: string | null }> => {
    void registration
    return { error: 'Login com Google desativado neste portal. Use e-mail e senha de hospede.' }
  }

  const resetGuestPassword = async (email: string, phone: string, newPassword: string): Promise<{ error: string | null }> => {
    try {
      const ok = await portalGuestResetPassword({
        tenantId: tenant.id,
        email,
        phone,
        newPassword,
      })

      if (!ok) {
        return { error: 'Nao foi possivel redefinir a senha. Verifique e-mail e telefone.' }
      }

      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Falha ao redefinir senha.' }
    }
  }

  const signOut = async () => {
    clearGuestSession()
    setPortalUser(null)
  }

  return (
    <PortalAuthContext.Provider
      value={{
        portalUser,
        isLoading,
        isAuthenticated: portalUser !== null,
        tenant,
        signIn,
        signUp,
        resetGuestPassword,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </PortalAuthContext.Provider>
  )
}
