import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/lib/LanguageContext'
import { UserProfileSheet } from '@/components/UserProfileSheet'

export function UserInfo() {
  const { currentUser, userProfile, isLoading } = useAuth()
  const { t } = useLanguage()
  const [sheetOpen, setSheetOpen] = useState(false)

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
  const login = currentUser.login || userProfile.githubLogin || 'user'
  const initials = login.slice(0, 2).toUpperCase()

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-accent transition-colors cursor-pointer"
      >
        <Avatar className="h-10 w-10 border-2 border-border">
          <AvatarImage src={currentUser.avatarUrl} alt={login} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-start">
          <span className="text-sm font-semibold text-foreground">{login}</span>
          <Badge variant={roleColor as any} className="w-fit text-xs">{roleLabel}</Badge>
        </div>
      </button>

      <UserProfileSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}
