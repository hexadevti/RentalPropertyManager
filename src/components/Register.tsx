import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getEdgeFunctionErrorFromInvokeError, getEdgeFunctionErrorFromPayload, getEdgeFunctionMessage } from '@/lib/edgeFunctionMessages'
import { useLanguage } from '@/lib/LanguageContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeSlash, UserPlus, CheckCircle, GithubLogo, GoogleLogo } from '@phosphor-icons/react'
import { Separator } from '@/components/ui/separator'

interface RegisterProps {
  onBackToLogin: () => void
}

type ResolvedInvitation = {
  token: string
  tenantId: string
  tenantName: string
  email: string
  login?: string
  role: 'admin' | 'guest'
  message: string
  expiresAt: string | null
  alreadyClaimed?: boolean
}

export default function Register({ onBackToLogin }: RegisterProps) {
  const { signUp, signInWithGitHub, signInWithGoogle } = useAuth()
  const { t } = useLanguage()
  const invitationToken = useMemo(() => new URLSearchParams(window.location.search).get('invite') || '', [])
  const isInviteMode = invitationToken.length > 0

  const [orgName, setOrgName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false)
  const [resolvedInvitation, setResolvedInvitation] = useState<ResolvedInvitation | null>(null)
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(isInviteMode)
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    if (!isInviteMode) return

    let cancelled = false

    const resolveInvitation = async () => {
      setIsLoadingInvitation(true)
      setInviteError(null)
      try {
        const { data, error } = await supabase.functions.invoke<{
          success?: boolean
          invitation?: ResolvedInvitation
          error?: string
          errorKey?: string
          errorParams?: Record<string, string | number>
        }>('tenant-user-invitations', {
          body: {
            action: 'resolve',
            token: invitationToken,
          },
        })

        if (error) throw await getEdgeFunctionErrorFromInvokeError(error, 'Não foi possível carregar o convite.')
        const responseError = getEdgeFunctionErrorFromPayload(data, 'Não foi possível carregar o convite.')
        if (responseError) throw responseError
        if (!data?.invitation) {
          throw new Error('Convite não encontrado.')
        }
        if (cancelled) return

        setResolvedInvitation(data.invitation)
        setOrgName(data.invitation.tenantName)
        setName(data.invitation.login || '')
        setEmail(data.invitation.email)
      } catch (err: unknown) {
        if (cancelled) return
        setInviteError(getEdgeFunctionMessage(err, t, 'Não foi possível carregar o convite.'))
      } finally {
        if (!cancelled) setIsLoadingInvitation(false)
      }
    }

    void resolveInvitation()
    return () => { cancelled = true }
  }, [invitationToken, isInviteMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setIsSubmitting(true)
    try {
      if (isInviteMode && resolvedInvitation) {
        const { data, error: fnError } = await supabase.functions.invoke<{
          success?: boolean
          email?: string
          error?: string
          errorKey?: string
          errorParams?: Record<string, string | number>
        }>('tenant-user-invitations', {
          body: { action: 'claim-invite', token: invitationToken, login: name.trim(), password },
        })

        if (fnError) throw await getEdgeFunctionErrorFromInvokeError(fnError, 'Não foi possível criar a conta.')
        const responseError = getEdgeFunctionErrorFromPayload(data, 'Não foi possível criar a conta.')
        if (responseError) throw responseError

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: resolvedInvitation.email,
          password,
        })
        if (signInError) throw signInError

        setSuccess(true)
      } else {
        const result = await signUp(orgName.trim(), name.trim(), email.trim(), password)
        setNeedsEmailConfirmation(result.needsEmailConfirmation)
        setSuccess(true)
      }
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('already registered') || msg.includes('User already registered') || msg.includes('already exists')) {
        setError('Este e-mail já está cadastrado. Use uma das opções de login acima.')
      } else if (msg.includes('no longer available') || msg.includes('expired')) {
        setError('Este convite não está mais disponível.')
      } else if (msg.includes('invalid email') || msg.includes('Invalid email')) {
        setError('E-mail inválido.')
      } else if (msg.includes('Password should be') || msg.includes('at least 6')) {
        setError('A senha deve ter pelo menos 6 caracteres.')
      } else {
        setError(msg || 'Não foi possível criar a conta. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError(null)
    setIsSubmitting(true)
    try {
      if (provider === 'google') {
        await signInWithGoogle()
      } else {
        await signInWithGitHub()
      }
    } catch {
      setError(provider === 'google'
        ? 'Não foi possível entrar com Google.'
        : 'Não foi possível entrar com GitHub.')
      setIsSubmitting(false)
    }
  }

  if (isInviteMode && isLoadingInvitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Carregando convite</h2>
              <p className="text-muted-foreground text-sm">Estamos validando seu link de acesso.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isInviteMode && (inviteError || !resolvedInvitation)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <UserPlus size={64} weight="duotone" className="text-primary" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Convite indisponível</h2>
              <p className="text-muted-foreground text-sm">{inviteError || 'Este convite não está mais disponível.'}</p>
            </div>
            <Button className="mt-2" onClick={onBackToLogin}>
              Voltar para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle size={64} weight="duotone" className="text-primary" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold">{isInviteMode ? 'Convite aceito!' : 'Cadastro realizado!'}</h2>
              {needsEmailConfirmation ? (
                <>
                  <p className="text-muted-foreground text-sm">
                    Enviamos um e-mail de confirmação para <strong>{email}</strong>.
                    Clique no link do e-mail para ativar sua conta.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Após a confirmação, você poderá acessar o tenant <strong>{orgName}</strong>.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Sua conta foi criada com sucesso{isInviteMode ? ` e vinculada ao tenant ${orgName}.` : '.'}
                </p>
              )}
            </div>
            <Button className="mt-2" onClick={onBackToLogin}>
              Voltar para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <UserPlus size={30} weight="duotone" className="text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isInviteMode ? 'Aceitar convite' : 'Criar conta'}
          </CardTitle>
          <CardDescription>
            {isInviteMode
              ? 'Conclua seu acesso ao tenant convidado'
              : 'Preencha os dados para criar sua conta'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isInviteMode && resolvedInvitation && (
            <div className="mb-4 rounded-xl border border-border bg-muted/40 p-4 space-y-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Tenant</p>
                <p className="font-medium">{resolvedInvitation.tenantName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">E-mail</p>
                <p className="font-medium">{resolvedInvitation.email}</p>
              </div>
              {!!resolvedInvitation.message && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Mensagem</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resolvedInvitation.message}</p>
                </div>
              )}
            </div>
          )}

          {isInviteMode && (
            <div className="space-y-3 mb-4">
              <Button
                variant="outline"
                className="w-full gap-2"
                size="lg"
                onClick={() => void handleOAuth('google')}
                disabled={isSubmitting || !!resolvedInvitation?.alreadyClaimed}
              >
                <GoogleLogo size={18} weight="bold" />
                Continuar com Google
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2"
                size="lg"
                onClick={() => void handleOAuth('github')}
                disabled={isSubmitting || !!resolvedInvitation?.alreadyClaimed}
              >
                <GithubLogo size={18} weight="bold" />
                Continuar com GitHub
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">ou crie uma senha</span>
                <Separator className="flex-1" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isInviteMode && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="reg-org">Nome da organização</Label>
                  <Input
                    id="reg-org"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Minha Imobiliária"
                    required
                    autoComplete="organization"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg-name">Nome completo</Label>
                  <Input
                    id="reg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    required
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg-email">E-mail</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </>
            )}

            {isInviteMode && (
              <>
            <div className="space-y-1">
              <Label htmlFor="invite-tenant">Tenant</Label>
              <Input id="invite-tenant" value={orgName} disabled />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-login">Usuário</Label>
              <Input
                id="invite-login"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Escolha seu usuário"
                required
                autoComplete="username"
                disabled={!!resolvedInvitation?.alreadyClaimed}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-email">E-mail</Label>
              <Input id="invite-email" value={email} disabled />
            </div>
              </>
            )}

            <div className="space-y-1">
              <Label htmlFor="reg-password">Senha</Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoComplete="new-password"
                  className="pr-10"
                  disabled={!!resolvedInvitation?.alreadyClaimed}
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

            <div className="space-y-1">
              <Label htmlFor="reg-confirm">Confirmar senha</Label>
              <div className="relative">
                <Input
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  required
                  autoComplete="new-password"
                  className="pr-10"
                  disabled={!!resolvedInvitation?.alreadyClaimed}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {resolvedInvitation?.alreadyClaimed && (
              <p className="text-sm text-muted-foreground text-center">
                Este convite já foi associado a uma conta. Use um provedor social com o mesmo e-mail ou volte para o login.
              </p>
            )}

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              disabled={isSubmitting || !!resolvedInvitation?.alreadyClaimed}
            >
              {isSubmitting
                ? (isInviteMode ? 'Concluindo convite...' : 'Criando conta...')
                : (isInviteMode ? 'Criar conta e aceitar convite' : 'Criar conta')}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="pt-0">
          <p className="text-sm text-muted-foreground text-center w-full">
            Já tem conta?{' '}
            <button
              className="text-primary font-medium hover:underline"
              onClick={onBackToLogin}
            >
              Entrar
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
