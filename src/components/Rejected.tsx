import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { XCircle, LockKey } from '@phosphor-icons/react'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { useState } from 'react'

export function Blocked() {
  const { currentUser, signOut } = useAuth()
  const { t } = useLanguage()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-destructive/10 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-2xl border-2 border-destructive/50">
        <CardHeader className="text-center space-y-6 pb-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-destructive/20 blur-2xl rounded-full" />
              <div className="relative bg-destructive/10 p-6 rounded-full">
                <XCircle size={64} weight="duotone" className="text-destructive" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight">
              {t.blocked?.title || 'Acesso Bloqueado'}
            </CardTitle>
            <CardDescription className="text-base">
              {t.blocked?.subtitle || 'Seu acesso ao sistema foi bloqueado'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <div className="flex items-center justify-center gap-4 p-6 bg-muted/50 rounded-lg border">
            <Avatar className="h-16 w-16 border-2 border-destructive">
              <AvatarImage src={currentUser?.avatarUrl} alt={currentUser?.login} />
              <AvatarFallback className="text-xl font-bold">
                {currentUser?.login.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="text-lg font-semibold text-foreground">
                {currentUser?.login}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentUser?.email}
              </p>
            </div>
          </div>

          <div className="space-y-4 text-center">
            <div className="flex items-start gap-3 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
              <LockKey size={24} weight="duotone" className="text-destructive mt-1 flex-shrink-0" />
              <div className="text-left flex-1">
                <p className="font-medium text-foreground mb-1">
                  {t.blocked?.message || 'Acesso Bloqueado'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.blocked?.description || 'Seu acesso ao sistema foi bloqueado. Se você acredita que isso é um erro, entre em contato com o administrador do sistema.'}
                </p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-1 pt-4">
              <p>
                {t.blocked?.contact || 'Para mais informações, entre em contato com o administrador do sistema.'}
              </p>
            </div>

            <div className="pt-2">
              <Button variant="outline" onClick={() => void handleSignOut()} disabled={isSigningOut}>
                {isSigningOut
                  ? (t.pendingApproval?.signing_out || 'Saindo...')
                  : (t.pendingApproval?.sign_out || 'Sair')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const Rejected = Blocked
