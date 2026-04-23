import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { supabase } from '@/lib/supabase'
import { deriveUserRoleFromAccessProfileId } from '@/lib/accessControl'
import type { AccessProfile } from '@/types'
import { User, Shield, ShieldCheck, Clock, CheckCircle, XCircle, Plus, UserPlus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

type UserRole = 'admin' | 'guest'
type UserStatus = 'pending' | 'approved' | 'blocked'

export function UserManagement() {
  const { isAdmin, currentUser, updateUserRole, updateUserStatus, getAllProfiles, createUser, deleteUser, currentTenantId } = useAuth()
  const { t } = useLanguage()
  const profiles = getAllProfiles()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [accessProfiles, setAccessProfiles] = useState<AccessProfile[]>([])
  const [newUserAccessProfileId, setNewUserAccessProfileId] = useState('system-guest')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!currentTenantId) return

    let cancelled = false
    const loadAccessProfiles = async () => {
      const { data, error } = await supabase
        .from('access_profiles')
        .select('tenant_id, id, name, description, is_system, created_at, updated_at')
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (error) {
        setAccessProfiles([])
        return
      }

      setAccessProfiles((data || []).map((row: any) => ({
        tenantId: row.tenant_id,
        id: row.id,
        name: row.name,
        description: row.description || '',
        isSystem: !!row.is_system,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })))
    }

    void loadAccessProfiles()
    return () => { cancelled = true }
  }, [currentTenantId])

  const accessProfileNameById = useMemo(() => (
    new Map(accessProfiles.map((profile) => [profile.id, profile.name]))
  ), [accessProfiles])

  const pendingUsers = profiles.filter((profile) => profile.status === 'pending')
  const approvedUsers = profiles.filter((profile) => profile.status === 'approved')
  const blockedUsers = profiles.filter((profile) => profile.status === 'blocked')

  const handleAccessProfileChange = async (githubLogin: string, accessProfileId: string) => {
    if (!isAdmin) {
      toast.error(t.errors?.unauthorized || 'Nao autorizado')
      return
    }

    if (currentUser?.login === githubLogin) {
      toast.error(t.errors?.cannotChangeOwnRole || 'Voce nao pode alterar seu proprio perfil')
      return
    }

    try {
      await updateUserRole(githubLogin, deriveUserRoleFromAccessProfileId(accessProfileId), accessProfileId)
      toast.success(t.success?.roleUpdated || 'Perfil atualizado com sucesso')
    } catch {
      toast.error(t.errors?.updateFailed || 'Erro ao atualizar perfil')
    }
  }

  const handleStatusChange = async (githubLogin: string, newStatus: UserStatus) => {
    if (!isAdmin) {
      toast.error(t.errors?.unauthorized || 'Nao autorizado')
      return
    }

    try {
      await updateUserStatus(githubLogin, newStatus)
      const statusMessages = {
        approved: t.success?.userApproved || 'Usuario aprovado com sucesso',
        blocked: t.success?.userBlocked || 'Usuario bloqueado',
        pending: t.success?.userPending || 'Status atualizado',
      }
      toast.success(statusMessages[newStatus])
    } catch {
      toast.error(t.errors?.updateFailed || 'Erro ao atualizar status')
    }
  }

  const handleCreateUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error('Por favor, insira um email valido')
      return
    }

    const githubLogin = newUserEmail.split('@')[0]
    const existingUser = profiles.find((profile) => profile.email === newUserEmail || profile.githubLogin === githubLogin)
    if (existingUser) {
      toast.error('Ja existe um usuario com este email')
      return
    }

    setIsCreating(true)
    try {
      await createUser(githubLogin, newUserEmail, deriveUserRoleFromAccessProfileId(newUserAccessProfileId), newUserAccessProfileId)
      toast.success('Usuario criado com sucesso')
      setIsCreateDialogOpen(false)
      setNewUserEmail('')
      setNewUserAccessProfileId('system-guest')
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao criar usuario')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteUser = async (githubLogin: string) => {
    if (!isAdmin) {
      toast.error(t.errors?.unauthorized || 'Nao autorizado')
      return
    }

    if (currentUser?.login === githubLogin) {
      toast.error('Voce nao pode apagar seu proprio usuario')
      return
    }

    if (!window.confirm('Tem certeza que deseja excluir este registro?')) {
      return
    }

    try {
      await deleteUser(githubLogin)
      toast.success('Usuario removido com sucesso')
    } catch {
      toast.error('Erro ao remover usuario')
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield weight="duotone" size={24} />
            {t.userManagement?.title || 'Gerenciamento de Usuarios'}
          </CardTitle>
          <CardDescription>
            {t.userManagement?.adminOnly || 'Apenas administradores podem gerenciar usuarios'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const renderUserCard = (profile: typeof profiles[0], showActions = false) => (
    <div
      key={profile.githubLogin}
      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card/50 p-4"
    >
      <div className="flex flex-1 items-center gap-4">
        <Avatar className="h-12 w-12 border-2 border-border">
          <AvatarImage src={profile.avatarUrl} alt={profile.githubLogin} />
          <AvatarFallback>
            <User weight="duotone" size={24} />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {profile.githubLogin}
            </span>
            {currentUser?.login === profile.githubLogin && (
              <Badge variant="outline" className="text-xs">
                {t.userManagement?.you || 'Voce'}
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {profile.email}
          </span>
        </div>
      </div>

      {showActions && profile.status === 'pending' ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleStatusChange(profile.githubLogin, 'approved')}
            className="gap-2"
          >
            <CheckCircle size={16} weight="duotone" />
            {t.userManagement?.approve || 'Aprovar'}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleStatusChange(profile.githubLogin, 'blocked')}
            className="gap-2"
          >
            <XCircle size={16} weight="duotone" />
            {t.userManagement?.block || 'Bloquear'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Select
            value={profile.accessProfileId || 'system-guest'}
            onValueChange={(value) => handleAccessProfileChange(profile.githubLogin, value)}
            disabled={currentUser?.login === profile.githubLogin}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accessProfiles.map((profileOption) => (
                <SelectItem key={profileOption.id} value={profileOption.id}>
                  {profileOption.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteUser(profile.githubLogin)}
            disabled={currentUser?.login === profile.githubLogin}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash size={18} weight="duotone" />
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck weight="duotone" size={24} />
              {t.userManagement?.title || 'Gerenciamento de Usuarios'}
            </CardTitle>
            <CardDescription>
              {t.userManagement?.description || 'Gerencie os perfis de acesso dos usuarios do sistema'}
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus size={20} weight="duotone" />
                Criar Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus size={24} weight="duotone" />
                  Criar Novo Usuario
                </DialogTitle>
                <DialogDescription>
                  Adicione um novo usuario ao sistema e atribua um perfil de acesso
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email do GitHub</Label>
                  <Input
                    id="user-email"
                    type="email"
                    placeholder="usuario@github.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Este sera o email usado para identificar o usuario no sistema
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-role">Perfil de Acesso</Label>
                  <Select value={newUserAccessProfileId} onValueChange={setNewUserAccessProfileId}>
                    <SelectTrigger id="user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accessProfiles.map((profileOption) => (
                        <SelectItem key={profileOption.id} value={profileOption.id}>
                          {profileOption.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Perfil selecionado: {accessProfileNameById.get(newUserAccessProfileId) || 'Perfil padrao'}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={isCreating || !newUserEmail.trim()}
                  className="gap-2"
                >
                  {isCreating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus size={16} weight="bold" />
                      Criar Usuario
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="gap-2">
              <Clock size={16} weight="duotone" />
              {t.userManagement?.pending || 'Pendentes'}
              {pendingUsers.length > 0 && (
                <Badge variant="default" className="ml-1 flex h-5 w-5 items-center justify-center p-0">
                  {pendingUsers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle size={16} weight="duotone" />
              {t.userManagement?.approved || 'Aprovados'}
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-2">
              <XCircle size={16} weight="duotone" />
              {t.userManagement?.blocked || 'Bloqueados'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <div className="space-y-4">
              {pendingUsers.map((profile) => renderUserCard(profile, true))}
              {pendingUsers.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  {t.userManagement?.noPendingUsers || 'Nenhum usuario pendente'}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            <div className="space-y-4">
              {approvedUsers.map((profile) => renderUserCard(profile, false))}
              {approvedUsers.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  {t.userManagement?.noApprovedUsers || 'Nenhum usuario aprovado'}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="blocked" className="mt-4">
            <div className="space-y-4">
              {blockedUsers.map((profile) => renderUserCard(profile, false))}
              {blockedUsers.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  {t.userManagement?.noBlockedUsers || 'Nenhum usuario bloqueado'}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
