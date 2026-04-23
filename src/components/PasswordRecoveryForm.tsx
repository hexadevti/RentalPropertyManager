import { useState } from 'react'
import { CheckCircle, Eye, EyeSlash, Key } from '@phosphor-icons/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/AuthContext'

export function PasswordRecoveryForm() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
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
      await updatePassword(password)
      setSuccess(true)
      const nextUrl = new URL(window.location.origin)
      window.setTimeout(() => {
        window.location.replace(nextUrl.toString())
      }, 1200)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível redefinir a senha.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            {success
              ? <CheckCircle size={30} weight="duotone" className="text-primary" />
              : <Key size={30} weight="duotone" className="text-primary" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {success ? 'Senha atualizada' : 'Criar nova senha'}
          </CardTitle>
          <CardDescription>
            {success
              ? 'Sua senha foi atualizada com sucesso. Redirecionando...'
              : 'Defina uma nova senha para acessar o RPM com email e senha.'}
          </CardDescription>
        </CardHeader>

        {!success && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="recovery-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((value) => !value)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-confirm-password">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    id="recovery-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm((value) => !value)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? 'Atualizando senha...' : 'Salvar nova senha'}
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
