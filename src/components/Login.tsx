import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Eye, EyeSlash, SignIn, GoogleLogo } from '@phosphor-icons/react'
import Register from '@/components/Register'

export function Login() {
  const { signInWithEmail, signInWithGoogle, signInWithDevCredentials } = useAuth()
  const [showRegister, setShowRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true'
  const devUserEmail = import.meta.env.VITE_DEV_USER_EMAIL
  const devUserId = import.meta.env.VITE_DEV_USER_ID

  if (showRegister) {
    return <Register onBackToLogin={() => setShowRegister(false)} />
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await signInWithEmail(email, password)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
        setError('E-mail ou senha incorretos.')
      } else if (msg.includes('Email not confirmed')) {
        setError('Confirme seu e-mail antes de entrar.')
      } else {
        setError('Não foi possível entrar. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      await signInWithGoogle()
    } catch {
      setError('Não foi possível entrar com Google.')
      setIsSubmitting(false)
    }
  }

  const handleDevLogin = async () => {
    setIsSubmitting(true)
    try {
      await signInWithDevCredentials(devUserEmail, devUserId)
    } catch {
      setError('Dev login falhou.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <SignIn size={30} weight="duotone" className="text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Entrar no RentFlow</CardTitle>
          <CardDescription>Acesse sua conta para continuar</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full gap-2"
            size="lg"
            onClick={handleGoogle}
            disabled={isSubmitting}
          >
            <GoogleLogo size={18} weight="bold" />
            Entrar com Google
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">ou</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          {isDevMode && (
            <Button
              variant="outline"
              className="w-full gap-2 border-dashed"
              size="sm"
              onClick={handleDevLogin}
              disabled={isSubmitting}
            >
              Dev Login
            </Button>
          )}
        </CardContent>

        <CardFooter className="flex-col gap-2 pt-0">
          <p className="text-sm text-muted-foreground text-center">
            Não tem conta?{' '}
            <button
              className="text-primary font-medium hover:underline"
              onClick={() => setShowRegister(true)}
            >
              Criar conta
            </button>
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Novos cadastros aguardam aprovação de um administrador.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
