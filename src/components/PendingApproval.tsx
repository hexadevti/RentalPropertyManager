import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Clock, LockKey } from '@phosphor-icons/react'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'

export function PendingApproval() {
  const { currentUser } = useAuth()
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/10 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-2xl border-2">
        <CardHeader className="text-center space-y-6 pb-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/20 blur-2xl rounded-full" />
              <div className="relative bg-accent/10 p-6 rounded-full">
                <Clock size={64} weight="duotone" className="text-accent" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight">
              {t.pendingApproval?.title || 'Aguardando Aprovação'}
            </CardTitle>
            <CardDescription className="text-base">
              {t.pendingApproval?.subtitle || 'Seu acesso está sendo analisado'}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-8">
          <div className="flex items-center justify-center gap-4 p-6 bg-muted/50 rounded-lg border">
            <Avatar className="h-16 w-16 border-2 border-accent">
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
            <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <LockKey size={24} weight="duotone" className="text-primary mt-1 flex-shrink-0" />
              <div className="text-left flex-1">
                <p className="font-medium text-foreground mb-1">
                  {t.pendingApproval?.message || 'Solicitação Enviada'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.pendingApproval?.description || 'Um administrador precisa aprovar seu acesso ao sistema. Você receberá uma notificação assim que sua conta for aprovada.'}
                </p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-1 pt-4">
              <p>
                {t.pendingApproval?.contact || 'Se tiver dúvidas, entre em contato com o administrador do sistema.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
