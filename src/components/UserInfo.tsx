import { useAuth } from '@/lib/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/LanguageContext'
import { SignOut } from '@phosphor-icons/react'
import { useState } from 'react'

export function UserInfo() {
  const { currentUser, userProfile, isLoading, signOut } = useAuth()
  const { t } = useLanguage()
  const [isSigningOut, setIsSigningOut] = useState(false)

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
  
  const statusLabel = userProfile.status === 'pending' 
    ? 'Pendente' 
    : userProfile.status === 'approved' 
    ? 'Aprovado' 
    : 'Rejeitado'
  
  const statusColor = userProfile.status === 'pending'
    ? 'outline'
    : userProfile.status === 'approved'
    ? 'default'
    : 'destructive'

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out failed:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10 border-2 border-border">
        <AvatarImage src={currentUser.avatarUrl} alt={login} />
        <AvatarFallback>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">
          {login}
        </span>
        <div className="flex items-center gap-1">
          <Badge variant={roleColor} className="w-fit text-xs">
            {roleLabel}
          </Badge>
        </div>
      </div>

      <Button variant="ghost" size="icon" onClick={handleSignOut} disabled={isSigningOut} title="Sair">
        <SignOut size={16} />
      </Button>
    </div>
  )
}
