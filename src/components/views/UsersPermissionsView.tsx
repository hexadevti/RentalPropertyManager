import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import helpContent from '@/docs/users-permissions.md?raw'
import { HelpButton } from '@/components/HelpButton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/lib/LanguageContext'
import { supabase } from '@/lib/supabase'
import { logAppAudit } from '@/lib/appAudit'
import type { UserRole, UserStatus } from '@/types'
import { Brain, BuildingOffice, ChartBar, Circle, CurrencyDollar, PencilSimpleLine, ShieldCheck, User, UsersThree } from '@phosphor-icons/react'
import { toast } from 'sonner'

type TenantOption = {
  id: string
  name: string
}

type AiUsageRow = {
  user_login: string
  model: string
  total_tokens: number
  estimated_cost_usd: number
  created_at: string
}

type TenantUsageSummary = {
  tenantId: string
  tenantName: string
  totalQueries: number
  totalTokens: number
  totalCostUsd: number
  lastQueryAt: string | null
}

type TenantProfile = {
  id: string
  authUserId: string | null
  githubLogin: string
  role: UserRole
  status: UserStatus
  email: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
}

type UserPresenceRow = {
  session_id: string
  auth_user_id: string | null
  user_login: string
  user_email: string | null
  avatar_url: string | null
  current_tab: string
  current_tab_label: string
  activity: string
  ip_address: string | null
  browser: string | null
  hostname: string | null
  last_seen_at: string
}

export default function UsersPermissionsView() {
  const { isAdmin, isPlatformAdmin, setSessionTenant, currentUser, currentTenantId } = useAuth()
  const { t } = useLanguage()

  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [profiles, setProfiles] = useState<TenantProfile[]>([])
  const [tenantDraft, setTenantDraft] = useState('')
  const [isLoadingTenants, setIsLoadingTenants] = useState(false)
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false)
  const [isSavingTenant, setIsSavingTenant] = useState(false)
  const [editingLogin, setEditingLogin] = useState<string | null>(null)
  const [draftLogin, setDraftLogin] = useState('')
  const [draftEmail, setDraftEmail] = useState('')
  const [draftAvatar, setDraftAvatar] = useState('')
  const [draftRole, setDraftRole] = useState<UserRole>('guest')
  const [draftStatus, setDraftStatus] = useState<UserStatus>('pending')
  const [moveTenantId, setMoveTenantId] = useState<string>('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isMoveConfirmOpen, setIsMoveConfirmOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all')
  const [onlineUsers, setOnlineUsers] = useState<UserPresenceRow[]>([])
  const [isLoadingOnlineUsers, setIsLoadingOnlineUsers] = useState(false)
  const [aiUsageLogs, setAiUsageLogs] = useState<AiUsageRow[]>([])
  const [allTenantsUsage, setAllTenantsUsage] = useState<TenantUsageSummary[]>([])
  const [isLoadingAiUsage, setIsLoadingAiUsage] = useState(false)

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) || null,
    [tenants, selectedTenantId]
  )

  useEffect(() => {
    setTenantDraft(selectedTenant?.name || '')
  }, [selectedTenant])

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.githubLogin === editingLogin) || null,
    [profiles, editingLogin]
  )

  const filteredProfiles = useMemo(() => {
    const term = search.trim().toLowerCase()
    return profiles.filter((profile) => {
      if (roleFilter !== 'all' && profile.role !== roleFilter) return false
      if (statusFilter !== 'all' && profile.status !== statusFilter) return false
      if (!term) return true
      return (
        profile.githubLogin.toLowerCase().includes(term)
        || profile.email.toLowerCase().includes(term)
      )
    })
  }, [profiles, search, roleFilter, statusFilter])

  const loadAllTenantsUsage = useCallback(async (tenantList: TenantOption[]) => {
    if (!tenantList.length) return
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('tenant_id, total_tokens, estimated_cost_usd, created_at')
      .gte('created_at', since)
    if (error || !data) return
    const map = new Map<string, { queries: number; tokens: number; cost: number; lastAt: string | null }>()
    for (const row of data as { tenant_id: string; total_tokens: number; estimated_cost_usd: number; created_at: string }[]) {
      const curr = map.get(row.tenant_id) ?? { queries: 0, tokens: 0, cost: 0, lastAt: null }
      map.set(row.tenant_id, {
        queries: curr.queries + 1,
        tokens: curr.tokens + row.total_tokens,
        cost: curr.cost + Number(row.estimated_cost_usd),
        lastAt: curr.lastAt && curr.lastAt > row.created_at ? curr.lastAt : row.created_at,
      })
    }
    setAllTenantsUsage(
      Array.from(map.entries())
        .map(([tenantId, stats]) => ({
          tenantId,
          tenantName: tenantList.find((t) => t.id === tenantId)?.name ?? tenantId,
          totalQueries: stats.queries,
          totalTokens: stats.tokens,
          totalCostUsd: stats.cost,
          lastQueryAt: stats.lastAt,
        }))
        .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    )
  }, [])

  const loadTenants = useCallback(async () => {
    setIsLoadingTenants(true)
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name')
      .order('created_at', { ascending: true })
    if (error) {
      toast.error(t.users_permissions_view.tenants_load_error)
      setTenants([])
    } else {
      const loaded = (data || []) as TenantOption[]
      setTenants(loaded)
      if (!selectedTenantId) {
        setSelectedTenantId(currentTenantId || loaded[0]?.id || '')
      }
      if (isPlatformAdmin) void loadAllTenantsUsage(loaded)
    }
    setIsLoadingTenants(false)
  }, [currentTenantId, selectedTenantId, isPlatformAdmin, loadAllTenantsUsage])

  const loadProfilesByTenant = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setProfiles([])
      return
    }
    setIsLoadingProfiles(true)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
    if (error) {
      toast.error(t.users_permissions_view.users_load_error)
      setProfiles([])
    } else {
      setProfiles((data || []).map((row: any) => ({
        id: row.id,
        authUserId: row.auth_user_id || null,
        githubLogin: row.github_login,
        role: row.role,
        status: row.status,
        email: row.email,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })))
    }
    setIsLoadingProfiles(false)
  }, [])

  const loadOnlineUsers = useCallback(async (tenantId?: string) => {
    const scopedTenantId = tenantId || selectedTenantId
    if (!scopedTenantId) {
      setOnlineUsers([])
      return
    }

    setIsLoadingOnlineUsers(true)
    const cutoff = new Date(Date.now() - 90_000).toISOString()
    const { data, error } = await supabase
      .from('user_presence')
      .select('session_id, auth_user_id, user_login, user_email, avatar_url, current_tab, current_tab_label, activity, ip_address, browser, hostname, last_seen_at')
      .eq('tenant_id', scopedTenantId)
      .gte('last_seen_at', cutoff)
      .order('last_seen_at', { ascending: false })

    if (error) {
      console.warn('Failed to load online users:', error)
      setOnlineUsers([])
    } else {
      setOnlineUsers((data || []) as UserPresenceRow[])
    }
    setIsLoadingOnlineUsers(false)
  }, [selectedTenantId])

  const loadAiUsage = useCallback(async (tenantId: string) => {
    if (!tenantId) return
    setIsLoadingAiUsage(true)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('user_login, model, total_tokens, estimated_cost_usd, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)
    if (!error) setAiUsageLogs((data || []) as AiUsageRow[])
    setIsLoadingAiUsage(false)
  }, [])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  useEffect(() => {
    if (!selectedTenantId) return
    void loadProfilesByTenant(selectedTenantId)
    void loadOnlineUsers(selectedTenantId)
    void loadAiUsage(selectedTenantId)
  }, [selectedTenantId, loadProfilesByTenant, loadOnlineUsers, loadAiUsage])

  useEffect(() => {
    if (!selectedTenantId) return
    const interval = window.setInterval(() => {
      void loadOnlineUsers(selectedTenantId)
    }, 15000)
    return () => window.clearInterval(interval)
  }, [selectedTenantId, loadOnlineUsers])

  const onlineProfiles = useMemo(() => {
    return onlineUsers.map((presence) => ({
      presence,
      profile: profiles.find((profile) => (
        (presence.auth_user_id && profile.authUserId === presence.auth_user_id)
        || profile.githubLogin === presence.user_login
      )) || null,
    }))
  }, [onlineUsers, profiles])

  const aiUsageByUser = useMemo(() => {
    const map = new Map<string, { queries: number; tokens: number; cost: number }>()
    for (const row of aiUsageLogs) {
      const key = row.user_login || 'unknown'
      const curr = map.get(key) ?? { queries: 0, tokens: 0, cost: 0 }
      map.set(key, { queries: curr.queries + 1, tokens: curr.tokens + row.total_tokens, cost: curr.cost + Number(row.estimated_cost_usd) })
    }
    return Array.from(map.entries())
      .map(([login, s]) => ({ login, ...s }))
      .sort((a, b) => b.cost - a.cost)
  }, [aiUsageLogs])

  const aiTotals = useMemo(() => ({
    queries: aiUsageLogs.length,
    tokens: aiUsageLogs.reduce((s, r) => s + r.total_tokens, 0),
    cost: aiUsageLogs.reduce((s, r) => s + Number(r.estimated_cost_usd), 0),
  }), [aiUsageLogs])

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={20} weight="duotone" />
            {t.users_permissions_view.restricted_access}
          </CardTitle>
          <CardDescription>
            {t.users_permissions_view.restricted_access_description}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const openEditDialog = (login: string) => {
    const profile = profiles.find((item) => item.githubLogin === login)
    if (!profile) return
    setEditingLogin(login)
    setDraftLogin(profile.githubLogin)
    setDraftEmail(profile.email)
    setDraftAvatar(profile.avatarUrl)
    setDraftRole(profile.role)
    setDraftStatus(profile.status)
    setMoveTenantId(selectedTenantId)
  }

  const handleSaveTenant = async () => {
    if (!selectedTenantId) return
    setIsSavingTenant(true)
    try {
      const trimmed = tenantDraft.trim()
      if (!trimmed) {
        toast.error(t.users_permissions_view.tenant_name_required)
        return
      }
      const { error } = await supabase
        .from('tenants')
        .update({ name: trimmed })
        .eq('id', selectedTenantId)
      if (error) throw error

      setTenants(prev => prev.map((tenant) => (
        tenant.id === selectedTenantId ? { ...tenant, name: trimmed } : tenant
      )))
      await logAppAudit({
        entity: 'tenants',
        action: 'update',
        recordId: selectedTenantId,
        tenantId: selectedTenantId,
        actorAuthUserId: currentUser?.id,
        actorLogin: currentUser?.login,
      })
      toast.success(t.users_permissions_view.tenant_updated_success)
    } catch (error: any) {
      toast.error(error?.message || t.users_permissions_view.tenant_update_error)
    } finally {
      setIsSavingTenant(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!editingLogin || !selectedProfile) return
    if (!draftLogin.trim()) {
      toast.error(t.users_permissions_view.profile_login_required)
      return
    }
    if (!draftEmail.trim()) {
      toast.error(t.users_permissions_view.profile_email_required)
      return
    }

    if (moveTenantId !== selectedTenantId) {
      setIsMoveConfirmOpen(true)
      return
    }

    await executeSaveProfile()
  }

  const executeSaveProfile = async () => {
    if (!editingLogin || !selectedProfile) return

    setIsSavingProfile(true)
    try {
      const movingTenant = moveTenantId !== selectedTenantId
      if (movingTenant) {
        if (!isPlatformAdmin) {
          throw new Error(t.users_permissions_view.only_master_can_move)
        }
        if (selectedProfile.authUserId && selectedProfile.authUserId === currentUser?.id) {
          throw new Error(t.users_permissions_view.cannot_move_self)
        }
      }

      const updatePayload: Record<string, any> = {
        role: draftRole,
        status: draftStatus,
        github_login: draftLogin.trim(),
        email: draftEmail.trim(),
        avatar_url: draftAvatar.trim(),
        updated_at: new Date().toISOString(),
      }

      if (movingTenant) {
        updatePayload.tenant_id = moveTenantId
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', selectedProfile.id)
        .eq('tenant_id', selectedTenantId)

      if (updateError) throw updateError

      await logAppAudit({
        entity: 'user_profiles',
        action: 'update',
        recordId: selectedProfile.id,
        tenantId: selectedTenantId,
        actorAuthUserId: currentUser?.id,
        actorLogin: currentUser?.login,
      })
      toast.success(t.success.roleUpdated)
      await loadProfilesByTenant(selectedTenantId)
      setEditingLogin(null)
    } catch (error: any) {
      toast.error(error?.message || t.errors.updateFailed)
    } finally {
      setIsSavingProfile(false)
      setIsMoveConfirmOpen(false)
    }
  }

  const sourceTenantName = selectedTenant?.name || selectedTenantId || '-'
  const destinationTenantName = tenants.find((tenant) => tenant.id === moveTenantId)?.name || moveTenantId || '-'

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-1">
          <h2 className="text-3xl font-bold tracking-tight">{t.tabs['users-permissions']}</h2>
          <HelpButton content={helpContent} title={t.users_permissions_view.help_title} />
        </div>
        <p className="text-muted-foreground mt-1">
          {t.users_permissions_view.subtitle}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BuildingOffice size={20} weight="duotone" />
            {t.users_permissions_view.tenant_control_title}
          </CardTitle>
          <CardDescription>
            {t.users_permissions_view.tenant_control_description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tenant-selector">{t.users_permissions_view.tenant_in_focus}</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId} disabled={isLoadingTenants || tenants.length === 0 || !isPlatformAdmin}>
                <SelectTrigger id="tenant-selector">
                  <SelectValue placeholder={t.users_permissions_view.select_tenant} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-name">{t.users_permissions_view.tenant_name}</Label>
              <Input
                id="tenant-name"
                value={tenantDraft}
                onChange={(event) => setTenantDraft(event.target.value)}
                placeholder={t.users_permissions_view.organization_name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-id">{t.users_permissions_view.tenant_id}</Label>
              <Input id="tenant-id" value={selectedTenantId || ''} disabled />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.users_permissions_view.logged_user_tenant}: {currentTenantId || '-'}
          </p>
          {!isPlatformAdmin && (
            <p className="text-xs text-muted-foreground">
              {t.users_permissions_view.only_master_session_and_move}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            {isPlatformAdmin && (
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!selectedTenantId) return
                  try {
                    await setSessionTenant(selectedTenantId)
                    toast.success(t.users_permissions_view.session_tenant_updated)
                  } catch (error: any) {
                    toast.error(error?.message || t.users_permissions_view.session_tenant_update_error)
                  }
                }}
                disabled={!selectedTenantId}
              >
                {t.users_permissions_view.use_selected_tenant}
              </Button>
            )}
            <Button onClick={handleSaveTenant} disabled={isSavingTenant || !tenantDraft.trim()}>
              {isSavingTenant ? t.users_permissions_view.saving : t.users_permissions_view.save_tenant}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UsersThree size={20} weight="duotone" />
              {t.users_permissions_view.online_users_title}
            </CardTitle>
            <CardDescription>
              {t.users_permissions_view.online_users_description}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadOnlineUsers(selectedTenantId)} disabled={isLoadingOnlineUsers || !selectedTenantId}>
            {isLoadingOnlineUsers ? t.users_permissions_view.refreshing : t.common.refresh}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {onlineProfiles.map(({ presence, profile }) => (
            <div key={presence.session_id} className="flex flex-col gap-3 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={presence.avatar_url || profile?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(presence.user_login)}&background=random`}
                  alt={presence.user_login}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">{profile?.githubLogin || presence.user_login}</p>
                    <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                      <Circle size={8} weight="fill" />
                      {t.users_permissions_view.online}
                    </Badge>
                    {profile && <Badge variant="secondary">{t.roles[profile.role]}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{presence.user_email || profile?.email || '-'}</p>
                </div>
              </div>
              <div className="grid gap-2 text-sm lg:min-w-0 lg:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.users_permissions_view.screen}</p>
                  <p className="font-medium">{presence.current_tab_label}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.users_permissions_view.current_activity}</p>
                  <p className="font-medium">{presence.activity}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.users_permissions_view.last_seen}</p>
                  <p className="font-medium">{new Date(presence.last_seen_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.users_permissions_view.ip}</p>
                  <p className="font-medium">{presence.ip_address || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.users_permissions_view.browser}</p>
                  <p className="font-medium">{presence.browser || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.users_permissions_view.hostname}</p>
                  <p className="font-medium">{presence.hostname || '-'}</p>
                </div>
              </div>
            </div>
          ))}
          {!isLoadingOnlineUsers && onlineUsers.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t.users_permissions_view.no_online_users}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PencilSimpleLine size={20} weight="duotone" />
            {t.users_permissions_view.user_edit_title}
          </CardTitle>
          <CardDescription>
            {t.users_permissions_view.user_edit_description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="user-search">{t.users_permissions_view.search_user}</Label>
              <Input
                id="user-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.users_permissions_view.search_user_placeholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-filter">{t.users_permissions_view.role}</Label>
              <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as 'all' | UserRole)}>
                <SelectTrigger id="role-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.users_permissions_view.all}</SelectItem>
                  <SelectItem value="admin">{t.roles.admin}</SelectItem>
                  <SelectItem value="guest">{t.roles.guest}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-filter">{t.users_permissions_view.status}</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | UserStatus)}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.users_permissions_view.all}</SelectItem>
                  <SelectItem value="pending">{t.userManagement.pending}</SelectItem>
                  <SelectItem value="approved">{t.userManagement.approved}</SelectItem>
                  <SelectItem value="rejected">{t.userManagement.rejected}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingProfiles && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t.users_permissions_view.loading_users}
            </div>
          )}
          {!isLoadingProfiles && filteredProfiles.map((profile) => (
            <div key={profile.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-medium truncate">{profile.githubLogin}</p>
                <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                <p className="text-xs text-muted-foreground">{t.users_permissions_view.role}: {t.roles[profile.role]} • {t.users_permissions_view.status}: {profile.status === 'pending' ? t.userManagement.pending : profile.status === 'approved' ? t.userManagement.approved : t.userManagement.rejected}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEditDialog(profile.githubLogin)}>
                <User size={16} weight="duotone" className="mr-2" />
                {t.users_permissions_view.edit_profile}
              </Button>
            </div>
          ))}
          {!isLoadingProfiles && filteredProfiles.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t.users_permissions_view.no_users_with_filters}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingLogin} onOpenChange={(open) => !open && setEditingLogin(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.users_permissions_view.edit_profile_title}</DialogTitle>
            <DialogDescription>
              {t.users_permissions_view.edit_profile_description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="profile-login">{t.users_permissions_view.login}</Label>
              <Input
                id="profile-login"
                value={draftLogin}
                onChange={(event) => setDraftLogin(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">{t.users_permissions_view.email}</Label>
              <Input
                id="profile-email"
                type="email"
                value={draftEmail}
                onChange={(event) => setDraftEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-avatar">{t.users_permissions_view.avatar_url}</Label>
              <Input
                id="profile-avatar"
                value={draftAvatar}
                onChange={(event) => setDraftAvatar(event.target.value)}
                placeholder={t.users_permissions_view.avatar_url_placeholder}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-role">{t.users_permissions_view.role}</Label>
                <Select value={draftRole} onValueChange={(value) => setDraftRole(value as UserRole)}>
                  <SelectTrigger id="profile-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t.roles.admin}</SelectItem>
                    <SelectItem value="guest">{t.roles.guest}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-status">{t.users_permissions_view.status}</Label>
                <Select value={draftStatus} onValueChange={(value) => setDraftStatus(value as UserStatus)}>
                  <SelectTrigger id="profile-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t.userManagement.pending}</SelectItem>
                    <SelectItem value="approved">{t.userManagement.approved}</SelectItem>
                    <SelectItem value="rejected">{t.userManagement.rejected}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-move-tenant">{t.users_permissions_view.destination_tenant}</Label>
              <Select value={moveTenantId} onValueChange={setMoveTenantId} disabled={!isPlatformAdmin}>
                <SelectTrigger id="profile-move-tenant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isPlatformAdmin
                  ? t.users_permissions_view.change_to_move_user
                  : t.users_permissions_view.only_master_can_move_user}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLogin(null)} disabled={isSavingProfile}>
              {t.properties_view.delete_confirm_cancel}
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? t.users_permissions_view.saving : t.users_permissions_view.save_changes}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI usage – current tenant (last 30 days) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain size={20} weight="duotone" />
            {t.users_permissions_view.ai_usage_title}
          </CardTitle>
          <CardDescription>
            {t.users_permissions_view.ai_usage_description_prefix} <strong>{selectedTenant?.name ?? selectedTenantId}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingAiUsage ? (
            <p className="text-sm text-muted-foreground">{t.users_permissions_view.loading}</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.users_permissions_view.queries}</p>
                  <p className="text-2xl font-bold">{aiTotals.queries}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.users_permissions_view.total_tokens}</p>
                  <p className="text-2xl font-bold">{aiTotals.tokens.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CurrencyDollar size={13} />{t.users_permissions_view.estimated_cost_usd}
                  </p>
                  <p className="text-2xl font-bold">${aiTotals.cost.toFixed(6)}</p>
                </div>
              </div>

              {aiUsageByUser.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2">{t.users_permissions_view.user}</th>
                        <th className="px-4 py-2 text-right">{t.users_permissions_view.queries}</th>
                        <th className="px-4 py-2 text-right">{t.users_permissions_view.tokens}</th>
                        <th className="px-4 py-2 text-right">{t.users_permissions_view.cost_usd}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiUsageByUser.map((row) => (
                        <tr key={row.login} className="border-t border-border">
                          <td className="px-4 py-2 font-medium">{row.login}</td>
                          <td className="px-4 py-2 text-right">{row.queries}</td>
                          <td className="px-4 py-2 text-right">{row.tokens.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right">${row.cost.toFixed(6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {aiUsageLogs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t.users_permissions_view.no_usage_last_30_days}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Cross-tenant usage (platform admin only) ── */}
      {isPlatformAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBar size={20} weight="duotone" />
              {t.users_permissions_view.tenant_spend_title}
            </CardTitle>
            <CardDescription>
              {t.users_permissions_view.tenant_spend_description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allTenantsUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t.users_permissions_view.no_usage_last_30_days}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2">{t.users_permissions_view.tenant}</th>
                      <th className="px-4 py-2 text-right">{t.users_permissions_view.queries}</th>
                      <th className="px-4 py-2 text-right">{t.users_permissions_view.tokens}</th>
                      <th className="px-4 py-2 text-right">{t.users_permissions_view.cost_usd}</th>
                      <th className="px-4 py-2 text-right">{t.users_permissions_view.last_query}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTenantsUsage.map((row) => (
                      <tr key={row.tenantId} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">{row.tenantName}</td>
                        <td className="px-4 py-2 text-right">{row.totalQueries}</td>
                        <td className="px-4 py-2 text-right">{row.totalTokens.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">${row.totalCostUsd.toFixed(6)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {row.lastQueryAt ? new Date(row.lastQueryAt).toLocaleDateString() : t.users_permissions_view.not_available}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-4 py-2">{t.users_permissions_view.total}</td>
                      <td className="px-4 py-2 text-right">{allTenantsUsage.reduce((s, r) => s + r.totalQueries, 0)}</td>
                      <td className="px-4 py-2 text-right">{allTenantsUsage.reduce((s, r) => s + r.totalTokens, 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">${allTenantsUsage.reduce((s, r) => s + r.totalCostUsd, 0).toFixed(6)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={isMoveConfirmOpen} onOpenChange={setIsMoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.users_permissions_view.confirm_tenant_move_title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.users_permissions_view.confirm_tenant_move_prefix} <strong>{draftLogin || editingLogin || '-'}</strong> {t.users_permissions_view.confirm_tenant_move_from} <strong>{sourceTenantName}</strong> {t.users_permissions_view.confirm_tenant_move_to} <strong>{destinationTenantName}</strong>. {t.users_permissions_view.confirm_tenant_move_suffix}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingProfile}>{t.properties_view.delete_confirm_cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void executeSaveProfile()} disabled={isSavingProfile}>
              {isSavingProfile ? t.users_permissions_view.moving : t.users_permissions_view.confirm_move}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
