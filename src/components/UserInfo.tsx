import { useAuth } from '@/lib/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/lib/LanguageContext'

export function UserInfo() {
  const { currentUser, userProfile, isLoading } = useAuth()
  const { t } = useLanguage()

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
        <div className="space-y-1">
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="h-3 w-16 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (!currentUser || !userProfile) {
    return null
  }

  const roleLabel = userProfile.role === 'admin' ? t.roles?.admin || 'Administrador' : t.roles?.guest || 'Hóspede'
  const roleColor = userProfile.role === 'admin' ? 'default' : 'secondary'

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10 border-2 border-border">
        <AvatarImage src={currentUser.avatarUrl} alt={currentUser.githubLogin} />
        <AvatarFallback>
          {currentUser.githubLogin.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">
          {currentUser.githubLogin}
        </span>
        <Badge variant={roleColor} className="w-fit text-xs">
          {roleLabel}
        </Badge>
      </div>
    </div>
  )
}
