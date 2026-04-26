import { useState } from 'react'
import { usePortalAuth } from '../PortalAuthContext'
import type { PortalTenant } from '../types'
import { ArrowLeft, GoogleLogo, Eye, EyeSlash } from '@phosphor-icons/react'
import { PhoneInput } from '@/components/ui/phone-input'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs)
    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timer)
        reject(error)
      })
  })
}

function validateStrongPassword(password: string): string | null {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'A senha deve conter pelo menos uma letra e um numero.'
  }
  return null
}

interface PortalAuthPageProps {
  tenant: PortalTenant
  mode: 'login' | 'register'
  onSuccess: () => void
  onSwitchToRegister?: () => void
  onSwitchToLogin?: () => void
  onBack: () => void
}

export function PortalAuthPage({
  tenant,
  mode,
  onSuccess,
  onSwitchToRegister,
  onSwitchToLogin,
  onBack,
}: PortalAuthPageProps) {
  const { signIn, signUp, resetGuestPassword, signInWithGoogle } = usePortalAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false)
  const [recoverEmail, setRecoverEmail] = useState('')
  const [recoverPhone, setRecoverPhone] = useState('')
  const [recoverNewPassword, setRecoverNewPassword] = useState('')
  const [recoverConfirmPassword, setRecoverConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setIsLoading(true)

    try {
      if (mode === 'login') {
        const { error: err } = await withTimeout(
          signIn(email, password),
          20000,
          'A autenticação demorou mais do que o esperado. Tente novamente.',
        )
        if (err) { setError(err); return }
        onSuccess()
      } else {
        if (!name.trim()) { setError('Por favor, informe seu nome.'); return }
        if (!phone.trim()) { setError('Por favor, informe seu telefone para contato.'); return }
        const passwordValidation = validateStrongPassword(password)
        if (passwordValidation) { setError(passwordValidation); return }
        const { error: err } = await withTimeout(
          signUp(name.trim(), email, password, phone.trim()),
          20000,
          'O cadastro demorou mais do que o esperado. Tente novamente.',
        )
        if (err) {
          const normalizedErr = err.toLowerCase()
          if (normalizedErr.includes('ja existe cadastro') || normalizedErr.includes('já existe cadastro')) {
            setError('Este e-mail já tem cadastro no portal. Use "Esqueci minha senha" para recuperar o acesso.')
            return
          }
          setError(err)
          return
        }
        setSuccessMsg('Cadastro realizado! Verifique seu e-mail se necessário, ou já pode usar o portal.')
        setTimeout(onSuccess, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a operação. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (!recoverEmail.trim()) { setError('Informe o e-mail.'); return }
    if (!recoverPhone.trim()) { setError('Informe o telefone.'); return }
    const passwordValidation = validateStrongPassword(recoverNewPassword)
    if (passwordValidation) { setError(passwordValidation); return }
    if (recoverNewPassword !== recoverConfirmPassword) {
      setError('A confirmacao da senha nao confere.')
      return
    }

    setIsLoading(true)
    try {
      const { error: err } = await withTimeout(
        resetGuestPassword(recoverEmail.trim(), recoverPhone.trim(), recoverNewPassword),
        20000,
        'A redefinicao de senha demorou mais do que o esperado. Tente novamente.',
      )
      if (err) {
        setError(err)
        return
      }

      setSuccessMsg('Senha redefinida com sucesso. Agora voce pode entrar com a nova senha.')
      setIsRecoveringPassword(false)
      setEmail(recoverEmail.trim())
      setPassword('')
      setRecoverNewPassword('')
      setRecoverConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel redefinir a senha.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)

    if (mode === 'register') {
      if (!name.trim()) { setError('Por favor, informe seu nome.'); return }
      if (!phone.trim()) { setError('Por favor, informe seu telefone para contato.'); return }
    }

    setIsLoading(true)
    const { error: err } = await signInWithGoogle(
      mode === 'register'
        ? { name: name.trim(), phone: phone.trim() }
        : undefined,
    )
    if (err) {
      setError(err)
      setIsLoading(false)
      return
    }

    // Fallback: if browser blocks redirect/pop-up, release UI and show guidance.
    window.setTimeout(() => {
      setIsLoading(false)
      setError('Não foi possível redirecionar para o Google. Verifique bloqueio de pop-up e tente novamente.')
    }, 6000)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-gray-900">{tenant.name}</h1>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === 'login' ? 'Entrar na sua conta' : 'Criar conta'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {mode === 'login'
                ? 'Acesse para gerenciar suas reservas.'
                : 'Cadastre-se para solicitar reservas.'}
            </p>
          </div>

          {!isRecoveringPassword && (
            <>
              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <GoogleLogo size={18} weight="bold" className="text-red-500" />
                Continuar com Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">ou</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </>
          )}

          {/* Form */}
          {!isRecoveringPassword ? (
            <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nome completo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Seu nome"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">E-mail *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Senha *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Telefone *
                </label>
                <PhoneInput
                  value={phone}
                  onValueChange={setPhone}
                  required
                  placeholder="11 99999-0000"
                />
                <p className="text-xs text-gray-400 mt-1">A senha deve ter 8+ caracteres com letra e numero.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              {isLoading
                ? 'Aguarde...'
                : mode === 'login'
                  ? 'Entrar'
                  : 'Criar conta'}
            </button>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setSuccessMsg(null)
                  setRecoverEmail(email)
                  setIsRecoveringPassword(true)
                }}
                className="w-full text-xs text-blue-600 hover:underline"
              >
                Esqueci minha senha
              </button>
            )}
            </form>
          ) : (
            <form onSubmit={e => void handleResetPassword(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">E-mail *</label>
                <input
                  type="email"
                  value={recoverEmail}
                  onChange={e => setRecoverEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Telefone *</label>
                <PhoneInput
                  value={recoverPhone}
                  onValueChange={setRecoverPhone}
                  required
                  placeholder="11 99999-0000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nova senha *</label>
                <input
                  type="password"
                  value={recoverNewPassword}
                  onChange={e => setRecoverNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar nova senha *</label>
                <input
                  type="password"
                  value={recoverConfirmPassword}
                  onChange={e => setRecoverConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Use 8+ caracteres com letra e numero.</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {isLoading ? 'Aguarde...' : 'Redefinir senha'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRecoveringPassword(false)
                  setError(null)
                }}
                className="w-full text-xs text-gray-500 hover:underline"
              >
                Voltar para login
              </button>
            </form>
          )}

          {/* Switch mode */}
          <p className="text-center text-xs text-gray-500">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button onClick={onSwitchToRegister} className="text-blue-600 hover:underline font-medium">
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button onClick={onSwitchToLogin} className="text-blue-600 hover:underline font-medium">
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
