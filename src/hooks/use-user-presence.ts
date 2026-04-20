import { useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

const HEARTBEAT_INTERVAL_MS = 30000
const IP_LOOKUP_STORAGE_KEY = 'rpm-user-presence-ip-address'

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

function getBrowserLabel() {
  const userAgent = window.navigator.userAgent
  if (/Edg\//.test(userAgent)) return 'Microsoft Edge'
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return 'Google Chrome'
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  return userAgent.slice(0, 120)
}

async function getPublicIpAddress() {
  const cached = window.sessionStorage.getItem(IP_LOOKUP_STORAGE_KEY)
  if (cached) return cached

  try {
    const response = await fetch('https://api.ipify.org?format=json')
    if (!response.ok) return null
    const data = await response.json() as { ip?: string }
    if (!data.ip) return null
    window.sessionStorage.setItem(IP_LOOKUP_STORAGE_KEY, data.ip)
    return data.ip
  } catch {
    return null
  }
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
      const ipAddress = await getPublicIpAddress()

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
          ip_address: ipAddress,
          browser: getBrowserLabel(),
          hostname: window.location.hostname,
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
