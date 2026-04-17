import { useState } from 'react'
import { GithubLogo, SignIn } from '@phosphor-icons/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/AuthContext'

export function Login() {
  const { signInWithGitHub } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleGitHubLogin = async () => {
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await signInWithGitHub()
    } catch (error) {
      console.error('GitHub login failed:', error)
      setErrorMessage('Nao foi possivel autenticar com GitHub. Verifique as configuracoes do provider no Supabase.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <GithubLogo size={36} weight="fill" className="text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Entrar no RentFlow</CardTitle>
          <CardDescription>
            Acesso via GitHub para manter o mesmo fluxo de autenticacao usado anteriormente.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button className="w-full gap-2" size="lg" onClick={handleGitHubLogin} disabled={isSubmitting}>
            <SignIn size={18} />
            {isSubmitting ? 'Redirecionando...' : 'Entrar com GitHub'}
          </Button>

          {errorMessage && (
            <p className="text-sm text-destructive text-center">{errorMessage}</p>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Se for o primeiro acesso, seu perfil sera criado automaticamente e aguardara aprovacao de um administrador.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
