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
import { User, Shield, ShieldCheck, Clock, CheckCircle, XCircle, Plus, UserPlus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useState } from 'react'

type UserRole = 'admin' | 'guest'
type UserStatus = 'pending' | 'approved' | 'rejected'

export function UserManagement() {
  const { isAdmin, currentUser, updateUserRole, updateUserStatus, getAllProfiles, createUser, deleteUser } = useAuth()
  const { t } = useLanguage()
  const profiles = getAllProfiles()
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<UserRole>('guest')
  const [isCreating, setIsCreating] = useState(false)
  
  const pendingUsers = profiles.filter(p => p.status === 'pending')
  const approvedUsers = profiles.filter(p => p.status === 'approved')
  const rejectedUsers = profiles.filter(p => p.status === 'rejected')

  const handleRoleChange = async (githubLogin: string, newRole: UserRole) => {
    if (!isAdmin) {
      toast.error(t.errors?.unauthorized || 'Não autorizado')
      return
    }

    if (currentUser?.login === githubLogin) {
      toast.error(t.errors?.cannotChangeOwnRole || 'Você não pode alterar seu próprio perfil')
      return
    }

    try {
      await updateUserRole(githubLogin, newRole)
      toast.success(t.success?.roleUpdated || 'Perfil atualizado com sucesso')
    } catch (error) {
      toast.error(t.errors?.updateFailed || 'Erro ao atualizar perfil')
    }
  }

  const handleStatusChange = async (githubLogin: string, newStatus: UserStatus) => {
    if (!isAdmin) {
      toast.error(t.errors?.unauthorized || 'Não autorizado')
      return
    }

    try {
      await updateUserStatus(githubLogin, newStatus)
      const statusMessages = {
        approved: t.success?.userApproved || 'Usuário aprovado com sucesso',
        rejected: t.success?.userRejected || 'Usuário rejeitado',
        pending: t.success?.userPending || 'Status atualizado'
      }
      toast.success(statusMessages[newStatus])
    } catch (error) {
      toast.error(t.errors?.updateFailed || 'Erro ao atualizar status')
    }
  }

  const handleCreateUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error('Por favor, insira um email válido')
      return
    }

    const githubLogin = newUserEmail.split('@')[0]
    
    const existingUser = profiles.find(p => p.email === newUserEmail || p.githubLogin === githubLogin)
    if (existingUser) {
      toast.error('Já existe um usuário com este email')
      return
    }

    setIsCreating(true)
    try {
      await createUser(githubLogin, newUserEmail, newUserRole)
      toast.success('Usuário criado com sucesso')
      setIsCreateDialogOpen(false)
      setNewUserEmail('')
      setNewUserRole('guest')
    } catch (error) {
      toast.error('Erro ao criar usuário')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteUser = async (githubLogin: string) => {
    if (!isAdmin) {
      toast.error(t.errors?.unauthorized || 'Não autorizado')
      return
    }

    if (currentUser?.login === githubLogin) {
      toast.error('Você não pode apagar seu próprio usuário')
      return
    }

    try {
      await deleteUser(githubLogin)
      toast.success('Usuário removido com sucesso')
    } catch (error) {
      toast.error('Erro ao remover usuário')
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield weight="duotone" size={24} />
            {t.userManagement?.title || 'Gerenciamento de Usuários'}
          </CardTitle>
          <CardDescription>
            {t.userManagement?.adminOnly || 'Apenas administradores podem gerenciar usuários'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const renderUserCard = (profile: typeof profiles[0], showActions = false) => (
    <div
      key={profile.githubLogin}
      className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card/50"
    >
      <div className="flex items-center gap-4 flex-1">
        <Avatar className="h-12 w-12 border-2 border-border">
          <AvatarImage src={profile.avatarUrl} alt={profile.githubLogin} />
          <AvatarFallback>
            <User weight="duotone" size={24} />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">
              {profile.githubLogin}
            </span>
            {currentUser?.login === profile.githubLogin && (
              <Badge variant="outline" className="text-xs">
                {t.userManagement?.you || 'Você'}
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
            onClick={() => handleStatusChange(profile.githubLogin, 'rejected')}
            className="gap-2"
          >
            <XCircle size={16} weight="duotone" />
            {t.userManagement?.reject || 'Rejeitar'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Select
            value={profile.role}
            onValueChange={(value) =>
              handleRoleChange(profile.githubLogin, value as UserRole)
            }
            disabled={currentUser?.login === profile.githubLogin}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} weight="duotone" />
                  {t.roles?.admin || 'Administrador'}
                </div>
              </SelectItem>
              <SelectItem value="guest">
                <div className="flex items-center gap-2">
                  <User size={16} weight="duotone" />
                  {t.roles?.guest || 'Hóspede'}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteUser(profile.githubLogin)}
            disabled={currentUser?.login === profile.githubLogin}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
              {t.userManagement?.title || 'Gerenciamento de Usuários'}
            </CardTitle>
            <CardDescription>
              {t.userManagement?.description || 'Gerencie os perfis de acesso dos usuários do sistema'}
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus size={20} weight="duotone" />
                Criar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus size={24} weight="duotone" />
                  Criar Novo Usuário
                </DialogTitle>
                <DialogDescription>
                  Adicione um novo usuário ao sistema e atribua um perfil de acesso
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
                    Este será o email usado para identificar o usuário no sistema
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-role">Perfil de Acesso</Label>
                  <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as UserRole)}>
                    <SelectTrigger id="user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={16} weight="duotone" />
                          {t.roles?.admin || 'Administrador'}
                        </div>
                      </SelectItem>
                      <SelectItem value="guest">
                        <div className="flex items-center gap-2">
                          <User size={16} weight="duotone" />
                          {t.roles?.guest || 'Hóspede'}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {newUserRole === 'admin' 
                      ? 'Administradores têm acesso completo ao sistema'
                      : 'Hóspedes têm acesso limitado às suas informações'}
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
                      <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus size={16} weight="bold" />
                      Criar Usuário
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
                <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                  {pendingUsers.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle size={16} weight="duotone" />
              {t.userManagement?.approved || 'Aprovados'}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle size={16} weight="duotone" />
              {t.userManagement?.rejected || 'Rejeitados'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <div className="space-y-4">
              {pendingUsers.map((profile) => renderUserCard(profile, true))}
              {pendingUsers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t.userManagement?.noPendingUsers || 'Nenhum usuário pendente'}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="approved" className="mt-4">
            <div className="space-y-4">
              {approvedUsers.map((profile) => renderUserCard(profile, false))}
              {approvedUsers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t.userManagement?.noApprovedUsers || 'Nenhum usuário aprovado'}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rejected" className="mt-4">
            <div className="space-y-4">
              {rejectedUsers.map((profile) => renderUserCard(profile, false))}
              {rejectedUsers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t.userManagement?.noRejectedUsers || 'Nenhum usuário rejeitado'}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
