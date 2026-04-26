import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { UserProfileSheet } from '@/components/UserProfileSheet'

interface UserInfoProps {
  activeTab?: string
  activeTabLabel?: string
  tabTitleMap?: Record<string, string>
}

export function UserInfo({ activeTab, activeTabLabel, tabTitleMap }: UserInfoProps = {}) {
  const { currentUser, userProfile, accessProfile, isLoading } = useAuth()
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

  const profileLabel = accessProfile?.name || 'Perfil padrao'
  const profileColor = userProfile.role === 'admin' ? 'default' : 'secondary'
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
        <div className="hidden min-w-0 flex-col items-start sm:flex">
          <span className="text-sm font-semibold text-foreground">{login}</span>
          <Badge variant={profileColor as 'default' | 'secondary'} className="w-fit text-xs">
            {profileLabel}
          </Badge>
        </div>
      </button>

      <UserProfileSheet open={sheetOpen} onOpenChange={setSheetOpen} activeTab={activeTab} activeTabLabel={activeTabLabel} tabTitleMap={tabTitleMap} />
    </>
  )
}
