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
      toast.error('Falha ao carregar tenants. Verifique permissões de acesso.')
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
      toast.error('Falha ao carregar usuários do tenant selecionado.')
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
            Acesso restrito
          </CardTitle>
          <CardDescription>
            Somente administradores podem acessar a tela de Usuários e Permissões.
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
        toast.error('Nome do tenant é obrigatório')
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
      toast.success('Tenant atualizado com sucesso')
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao atualizar tenant')
    } finally {
      setIsSavingTenant(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!editingLogin || !selectedProfile) return
    if (!draftLogin.trim()) {
      toast.error('Login do perfil é obrigatório')
      return
    }
    if (!draftEmail.trim()) {
      toast.error('E-mail do perfil é obrigatório')
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
          throw new Error('Somente perfil master pode alterar tenant de usuário.')
        }
        if (selectedProfile.authUserId && selectedProfile.authUserId === currentUser?.id) {
          throw new Error('Você não pode mover seu próprio usuário para outro tenant.')
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
      toast.success('Perfil atualizado com sucesso')
      await loadProfilesByTenant(selectedTenantId)
      setEditingLogin(null)
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao atualizar perfil')
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
          <h2 className="text-3xl font-bold tracking-tight">Usuários e Permissões</h2>
          <HelpButton content={helpContent} title="Ajuda — Usuários e Permissões" />
        </div>
        <p className="text-muted-foreground mt-1">
          Gerencie permissões de usuários, tenant atual e edição de perfis.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BuildingOffice size={20} weight="duotone" />
            Controle de Tenant
          </CardTitle>
          <CardDescription>
            Visualize o tenant atual e altere o tenant para gerenciar usuários de outros tenants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tenant-selector">Tenant em foco</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId} disabled={isLoadingTenants || tenants.length === 0 || !isPlatformAdmin}>
                <SelectTrigger id="tenant-selector">
                  <SelectValue placeholder="Selecione um tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Nome do Tenant</Label>
              <Input
                id="tenant-name"
                value={tenantDraft}
                onChange={(event) => setTenantDraft(event.target.value)}
                placeholder="Nome da organização"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-id">Tenant ID</Label>
              <Input id="tenant-id" value={selectedTenantId || ''} disabled />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Tenant do usuário logado: {currentTenantId || '-'}
          </p>
          {!isPlatformAdmin && (
            <p className="text-xs text-muted-foreground">
              Apenas perfil master pode trocar tenant da sessão e mover usuários entre tenants.
            </p>
          )}
          {isPlatformAdmin && (
            <Button
              variant="secondary"
              onClick={async () => {
                if (!selectedTenantId) return
                try {
                  await setSessionTenant(selectedTenantId)
                  toast.success('Tenant da sessão atualizado')
                } catch (error: any) {
                  toast.error(error?.message || 'Falha ao trocar tenant da sessão')
                }
              }}
              disabled={!selectedTenantId}
            >
              Usar tenant selecionado na sessão
            </Button>
          )}
          <Button onClick={handleSaveTenant} disabled={isSavingTenant || !tenantDraft.trim()}>
            {isSavingTenant ? 'Salvando...' : 'Salvar Tenant'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UsersThree size={20} weight="duotone" />
              Usuários online agora
            </CardTitle>
            <CardDescription>
              Sessões ativas no tenant selecionado, considerando atividade nos últimos 90 segundos.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadOnlineUsers(selectedTenantId)} disabled={isLoadingOnlineUsers || !selectedTenantId}>
            {isLoadingOnlineUsers ? 'Atualizando...' : 'Atualizar'}
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
                      online
                    </Badge>
                    {profile && <Badge variant="secondary">{profile.role}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{presence.user_email || profile?.email || '-'}</p>
                </div>
              </div>
              <div className="grid gap-2 text-sm lg:min-w-[680px] lg:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Tela</p>
                  <p className="font-medium">{presence.current_tab_label}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">O que está fazendo</p>
                  <p className="font-medium">{presence.activity}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Último sinal</p>
                  <p className="font-medium">{new Date(presence.last_seen_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">IP</p>
                  <p className="font-medium">{presence.ip_address || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Browser</p>
                  <p className="font-medium">{presence.browser || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Hostname</p>
                  <p className="font-medium">{presence.hostname || '-'}</p>
                </div>
              </div>
            </div>
          ))}
          {!isLoadingOnlineUsers && onlineUsers.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum usuário online no tenant selecionado neste momento.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PencilSimpleLine size={20} weight="duotone" />
            Edição de Usuários e Perfis
          </CardTitle>
          <CardDescription>
            Edite login, e-mail, avatar, papel e status de cada usuário do tenant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="user-search">Buscar usuário</Label>
              <Input
                id="user-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar por login ou email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-filter">Papel</Label>
              <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as 'all' | UserRole)}>
                <SelectTrigger id="role-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="guest">guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | UserStatus)}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">pending</SelectItem>
                  <SelectItem value="approved">approved</SelectItem>
                  <SelectItem value="rejected">rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingProfiles && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Carregando usuários do tenant selecionado...
            </div>
          )}
          {!isLoadingProfiles && filteredProfiles.map((profile) => (
            <div key={profile.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-medium truncate">{profile.githubLogin}</p>
                <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                <p className="text-xs text-muted-foreground">Papel: {profile.role} • Status: {profile.status}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEditDialog(profile.githubLogin)}>
                <User size={16} weight="duotone" className="mr-2" />
                Editar Perfil
              </Button>
            </div>
          ))}
          {!isLoadingProfiles && filteredProfiles.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum usuário encontrado com os filtros atuais.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingLogin} onOpenChange={(open) => !open && setEditingLogin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar perfil de usuário</DialogTitle>
            <DialogDescription>
              Atualize os campos abaixo para manter dados e permissões consistentes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="profile-login">Login</Label>
              <Input
                id="profile-login"
                value={draftLogin}
                onChange={(event) => setDraftLogin(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">E-mail</Label>
              <Input
                id="profile-email"
                type="email"
                value={draftEmail}
                onChange={(event) => setDraftEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-avatar">URL do avatar</Label>
              <Input
                id="profile-avatar"
                value={draftAvatar}
                onChange={(event) => setDraftAvatar(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-role">Papel</Label>
                <Select value={draftRole} onValueChange={(value) => setDraftRole(value as UserRole)}>
                  <SelectTrigger id="profile-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="guest">guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-status">Status</Label>
                <Select value={draftStatus} onValueChange={(value) => setDraftStatus(value as UserStatus)}>
                  <SelectTrigger id="profile-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="approved">approved</SelectItem>
                    <SelectItem value="rejected">rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-move-tenant">Tenant de destino</Label>
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
                  ? 'Altere para mover o usuário para outro tenant.'
                  : 'Apenas perfil master pode mover usuário entre tenants.'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLogin(null)} disabled={isSavingProfile}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI usage – current tenant (last 30 days) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain size={20} weight="duotone" />
            Uso do Assistente IA — últimos 30 dias
          </CardTitle>
          <CardDescription>
            Consultas, tokens consumidos e custo estimado para o tenant <strong>{selectedTenant?.name ?? selectedTenantId}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingAiUsage ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Consultas</p>
                  <p className="text-2xl font-bold">{aiTotals.queries}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tokens totais</p>
                  <p className="text-2xl font-bold">{aiTotals.tokens.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CurrencyDollar size={13} />Custo estimado (USD)
                  </p>
                  <p className="text-2xl font-bold">${aiTotals.cost.toFixed(6)}</p>
                </div>
              </div>

              {aiUsageByUser.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2">Usuário</th>
                        <th className="px-4 py-2 text-right">Consultas</th>
                        <th className="px-4 py-2 text-right">Tokens</th>
                        <th className="px-4 py-2 text-right">Custo (USD)</th>
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
                  Nenhum uso registrado nos últimos 30 dias.
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
              Gastos por Tenant — últimos 30 dias
            </CardTitle>
            <CardDescription>
              Visão consolidada do uso do assistente de IA em todos os tenants da plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allTenantsUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum uso registrado nos últimos 30 dias.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2">Tenant</th>
                      <th className="px-4 py-2 text-right">Consultas</th>
                      <th className="px-4 py-2 text-right">Tokens</th>
                      <th className="px-4 py-2 text-right">Custo (USD)</th>
                      <th className="px-4 py-2 text-right">Última consulta</th>
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
                          {row.lastQueryAt ? new Date(row.lastQueryAt).toLocaleDateString('pt-BR') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-4 py-2">Total</td>
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
            <AlertDialogTitle>Confirmar movimentação de tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Você está movendo o usuário <strong>{draftLogin || editingLogin || '-'}</strong> do tenant <strong>{sourceTenantName}</strong> para <strong>{destinationTenantName}</strong>.
              Essa alteração pode afetar o acesso do usuário e o escopo dos dados visíveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingProfile}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void executeSaveProfile()} disabled={isSavingProfile}>
              {isSavingProfile ? 'Movendo...' : 'Confirmar movimentação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
