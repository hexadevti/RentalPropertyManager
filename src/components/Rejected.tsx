import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { XCircle, LockKey } from '@phosphor-icons/react'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'

export function Rejected() {
  const { currentUser } = useAuth()
  const { t } = useLanguage()

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
              {t.rejected?.title || 'Acesso Negado'}
            </CardTitle>
            <CardDescription className="text-base">
              {t.rejected?.subtitle || 'Sua solicitação de acesso foi rejeitada'}
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
                  {t.rejected?.message || 'Solicitação Rejeitada'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.rejected?.description || 'Sua solicitação de acesso ao sistema foi negada. Se você acredita que isso é um erro, entre em contato com o administrador do sistema.'}
                </p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-1 pt-4">
              <p>
                {t.rejected?.contact || 'Para mais informações, entre em contato com o administrador do sistema.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
