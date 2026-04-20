import { useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

const HEARTBEAT_INTERVAL_MS = 30000

function getSessionId() {
  const storageKey = 'rpm-user-presence-session-id'
  const existing = window.sessionStorage.getItem(storageKey)
  if (existing) return existing

  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  window.sessionStorage.setItem(storageKey, generated)
  return generated
}

function isUuid(value: string | null | undefined) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function useUserPresence(activeTab: string, activeTabLabel: string) {
  const { currentUser, currentTenantId, isAuthenticated, isApproved } = useAuth()

  const sessionId = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return getSessionId()
  }, [])

  useEffect(() => {
    if (!sessionId || !currentTenantId || !currentUser || !isAuthenticated || !isApproved) return

    let isMounted = true

    const writePresence = async () => {
      const now = new Date().toISOString()
      const activity = `Visualizando tela: ${activeTabLabel}`

      const { error } = await supabase
        .from('user_presence')
        .upsert({
          tenant_id: currentTenantId,
          session_id: sessionId,
          auth_user_id: isUuid(currentUser.id) ? currentUser.id : null,
          user_login: currentUser.login,
          user_email: currentUser.email,
          avatar_url: currentUser.avatarUrl,
          current_tab: activeTab,
          current_tab_label: activeTabLabel,
          activity,
          last_seen_at: now,
          updated_at: now,
        }, { onConflict: 'tenant_id,session_id' })

      if (error && isMounted) {
        console.warn('Failed to update user presence:', error)
      }
    }

    void writePresence()
    const interval = window.setInterval(() => void writePresence(), HEARTBEAT_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void writePresence()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      isMounted = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeTab, activeTabLabel, currentTenantId, currentUser, isAuthenticated, isApproved, sessionId])
}
