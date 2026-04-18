import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeSlash, UserPlus, CheckCircle } from '@phosphor-icons/react'

interface RegisterProps {
  onBackToLogin: () => void
}

export default function Register({ onBackToLogin }: RegisterProps) {
  const { signUp } = useAuth()
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
      const result = await signUp(orgName.trim(), name.trim(), email.trim(), password)
      setNeedsEmailConfirmation(result.needsEmailConfirmation)
      setSuccess(true)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('already registered') || msg.includes('User already registered')) {
        setError('Este e-mail já está cadastrado.')
      } else if (msg.includes('invalid email') || msg.includes('Invalid email')) {
        setError('E-mail inválido.')
      } else if (msg.includes('Password should be')) {
        setError('A senha deve ter pelo menos 6 caracteres.')
      } else {
        setError('Não foi possível criar a conta. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle size={64} weight="duotone" className="text-primary" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Cadastro realizado!</h2>
              {needsEmailConfirmation ? (
                <>
                  <p className="text-muted-foreground text-sm">
                    Enviamos um e-mail de confirmação para <strong>{email}</strong>.
                    Clique no link do e-mail para ativar sua conta.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Caso não encontre, verifique a caixa de spam.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">
                    Sua conta foi criada com sucesso. Um administrador precisa aprovar
                    seu acesso antes que você possa entrar no sistema.
                  </p>
                </>
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
          <CardTitle className="text-2xl font-bold">Criar conta</CardTitle>
          <CardDescription>Preencha os dados para solicitar acesso</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
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

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button type="submit" className="w-full mt-2" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Criando conta...' : 'Criar conta'}
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
