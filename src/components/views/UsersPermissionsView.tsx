import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import type { UserRole, UserStatus } from '@/types'
import { BuildingOffice, ClockCounterClockwise, User, PencilSimpleLine, ShieldCheck } from '@phosphor-icons/react'
import { toast } from 'sonner'

type TenantOption = {
  id: string
  name: string
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

type AuditLogRow = {
  id: string
  actor_login: string | null
  target_login: string | null
  action: string
  details: Record<string, any>
  created_at: string
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
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([])
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false)

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
    }
    setIsLoadingTenants(false)
  }, [currentTenantId, selectedTenantId])

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

  const loadAuditLogs = useCallback(async (tenantId?: string) => {
    const scopedTenantId = tenantId || selectedTenantId
    if (!scopedTenantId) return
    setIsLoadingAuditLogs(true)
    const { data, error } = await supabase
      .from('tenant_audit_logs')
      .select('id, actor_login, target_login, action, details, created_at')
      .eq('tenant_id', scopedTenantId)
      .order('created_at', { ascending: false })
      .limit(40)
    if (error) {
      console.warn('Failed to load audit logs:', error)
      setAuditLogs([])
    } else {
      setAuditLogs((data || []) as AuditLogRow[])
    }
    setIsLoadingAuditLogs(false)
  }, [selectedTenantId])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  useEffect(() => {
    if (!selectedTenantId) return
    void loadProfilesByTenant(selectedTenantId)
    void loadAuditLogs(selectedTenantId)
  }, [selectedTenantId, loadProfilesByTenant, loadAuditLogs])

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
      toast.success('Tenant atualizado com sucesso')
      await loadAuditLogs(selectedTenantId)
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

      toast.success('Perfil atualizado com sucesso')
      await loadProfilesByTenant(selectedTenantId)
      await loadAuditLogs(selectedTenantId)
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
        <h2 className="text-3xl font-bold tracking-tight">Usuários e Permissões</h2>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClockCounterClockwise size={20} weight="duotone" />
              Trilha de Auditoria
            </CardTitle>
            <CardDescription>
              Histórico das alterações administrativas de usuários, permissões e tenant.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadAuditLogs(selectedTenantId)} disabled={isLoadingAuditLogs || !selectedTenantId}>
            {isLoadingAuditLogs ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditLogs.map((log) => (
            <div key={log.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{log.action}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm">
                <strong>Ator:</strong> {log.actor_login || 'sistema'}
                {' • '}
                <strong>Alvo:</strong> {log.target_login || '-'}
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                {JSON.stringify(log.details || {}, null, 2)}
              </pre>
            </div>
          ))}
          {!isLoadingAuditLogs && auditLogs.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Sem eventos de auditoria para este tenant.
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
