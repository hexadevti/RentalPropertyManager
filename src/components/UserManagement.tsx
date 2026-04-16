import { useKV } from '@github/spark/hooks'
import { UserProfile, UserRole } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { User, Shield, ShieldCheck } from '@phosphor-icons/react'
import { toast } from 'sonner'

export function UserManagement() {
  const { isAdmin, currentUser, updateUserRole } = useAuth()
  const { t } = useLanguage()
  const [profiles, setProfiles] = useKV<UserProfile[]>('user-profiles', [])

  const handleRoleChange = async (githubLogin: string, newRole: UserRole) => {
    if (!isAdmin) {
      toast.error(t.errors?.unauthorized || 'Não autorizado')
      return
    }

    if (currentUser?.githubLogin === githubLogin) {
      toast.error(t.errors?.cannotChangeOwnRole || 'Você não pode alterar seu próprio perfil')
      return
    }

    try {
      await updateUserRole(githubLogin, newRole)
      
      setProfiles((current) =>
        (current || []).map((p) =>
          p.githubLogin === githubLogin
            ? { ...p, role: newRole, updatedAt: new Date().toISOString() }
            : p
        )
      )

      toast.success(t.success?.roleUpdated || 'Perfil atualizado com sucesso')
    } catch (error) {
      toast.error(t.errors?.updateFailed || 'Erro ao atualizar perfil')
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck weight="duotone" size={24} />
          {t.userManagement?.title || 'Gerenciamento de Usuários'}
        </CardTitle>
        <CardDescription>
          {t.userManagement?.description || 'Gerencie os perfis de acesso dos usuários do sistema'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(profiles || []).map((profile) => (
            <div
              key={profile.githubLogin}
              className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card/50"
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border-2 border-border">
                  <AvatarImage src={profile.avatarUrl} alt={profile.githubLogin} />
                  <AvatarFallback>
                    <User weight="duotone" size={24} />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {profile.githubLogin}
                    </span>
                    {currentUser?.githubLogin === profile.githubLogin && (
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
              <div className="flex items-center gap-3">
                <Select
                  value={profile.role}
                  onValueChange={(value) =>
                    handleRoleChange(profile.githubLogin, value as UserRole)
                  }
                  disabled={currentUser?.githubLogin === profile.githubLogin}
                >
                  <SelectTrigger className="w-40">
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
              </div>
            </div>
          ))}
          {(!profiles || profiles.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              {t.userManagement?.noUsers || 'Nenhum usuário cadastrado'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
