import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeSlash, SignIn, GithubLogo, GoogleLogo, ArrowLeft } from '@phosphor-icons/react'
import Register from '@/components/Register'
import { useLanguage } from '@/lib/LanguageContext'

interface LoginProps {
  onBack?: () => void
}

export function Login({ onBack }: LoginProps = {}) {
  const { signInWithEmail, signInWithGitHub, signInWithGoogle } = useAuth()
  const { t } = useLanguage()
  const [showRegister, setShowRegister] = useState(() => new URLSearchParams(window.location.search).has('invite'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hasInvite = new URLSearchParams(window.location.search).has('invite')
    if (hasInvite) {
      setShowRegister(true)
    }
  }, [])

  if (showRegister) {
    return <Register onBackToLogin={() => {
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.delete('invite')
      window.history.replaceState({}, document.title, `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
      setShowRegister(false)
    }} />
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
        setError(t.login_view.invalid_credentials)
      } else if (msg.includes('Email not confirmed')) {
        setError(t.login_view.email_not_confirmed)
      } else {
        setError(t.login_view.sign_in_failed)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGitHub = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      await signInWithGitHub()
    } catch {
      setError(t.login_view.github_sign_in_failed)
      setIsSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      await signInWithGoogle()
    } catch {
      setError(t.login_view.google_sign_in_failed)
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
          <CardTitle className="text-2xl font-bold">{t.login_view.title}</CardTitle>
          <CardDescription>{t.login_view.subtitle}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">{t.login_view.social_separator}</span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            size="lg"
            onClick={handleGoogle}
            disabled={isSubmitting}
          >
            <GoogleLogo size={18} weight="bold" />
            {t.login_view.sign_in_with_google}
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2"
            size="lg"
            onClick={handleGitHub}
            disabled={isSubmitting}
          >
            <GithubLogo size={18} weight="bold" />
            {t.login_view.sign_in_with_github}
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">{t.login_view.or}</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">{t.login_view.email_label}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.login_view.email_placeholder}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">{t.login_view.password_label}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
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
              {isSubmitting ? t.login_view.signing_in : t.login_view.sign_in_button}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-2 pt-0">
          <p className="text-sm text-muted-foreground text-center">
            {t.login_view.no_account}{' '}
            <button
              className="text-primary font-medium hover:underline"
              onClick={() => setShowRegister(true)}
            >
              {t.login_view.create_account}
            </button>
          </p>
          {onBack && (
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
              onClick={onBack}
            >
              <ArrowLeft size={12} />
              {t.login_view.back_to_site}
            </button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
