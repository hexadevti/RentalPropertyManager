import { ReactNode } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { UserRole } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldWarning } from '@phosphor-icons/react'

interface RestrictedProps {
  children: ReactNode
  allowedRoles: UserRole[]
  fallback?: ReactNode
}

export function Restricted({ children, allowedRoles, fallback }: RestrictedProps) {
  const { userProfile, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!userProfile || !allowedRoles.includes(userProfile.role)) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldWarning size={24} weight="duotone" />
            Acesso Restrito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta funcionalidade.
          </p>
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}
