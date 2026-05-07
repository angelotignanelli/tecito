import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getPublicBaseUrl } from '../../lib/publicUrl'
import AuthShell from './AuthShell'

interface Props {
  onLoginSuccess: () => void
  onGoToRegister: () => void
}

export default function LoginView({ onLoginSuccess, onGoToRegister }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  // Default: remember (most users want this). Persist the *preference* in
  // localStorage so the checkbox remembers its own state next visit.
  const [rememberMe, setRememberMe] = useState(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('tecito_remember_me') !== 'false'
      : true
  })

  /** "¿Olvidaste?" — uses the email already in the field. We send the user a
   * password-recovery link via Supabase. The link redirects them back to the
   * site, where Supabase fires a PASSWORD_RECOVERY auth event that App.tsx
   * picks up to show the ResetPasswordView. */
  const handleForgot = async () => {
    setError('')
    setInfo('')
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Ingresá tu email arriba y volvé a tocar "¿Olvidaste?"')
      return
    }
    setForgotLoading(true)
    // Use the canonical URL, not window.location.origin, so the recovery
    // email link always points at tecito.com.ar even if the doctor is
    // currently using the *.vercel.app technical URL.
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: getPublicBaseUrl(),
    })
    setForgotLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setInfo(`Te enviamos un email a ${trimmed}. Revisá tu bandeja (y spam) y hacé click en el link para elegir una contraseña nueva.`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Completá todos los campos')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : error.message)
      return
    }

    // Persist the checkbox preference for next visit
    localStorage.setItem('tecito_remember_me', String(rememberMe))

    // If user does NOT want to be remembered, wipe Supabase auth tokens from
    // localStorage when the tab closes. sessionStorage would also be wiped, but
    // Supabase reads from localStorage by default so we purge those keys.
    // The handler is registered at window-level so it survives this component
    // unmounting after successful login.
    if (!rememberMe) {
      window.addEventListener('beforeunload', () => {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-'))
          .forEach((k) => localStorage.removeItem(k))
      })
    }

    onLoginSuccess()
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <h1
          className="text-[36px] font-normal tracking-[-0.028em] text-text m-0 leading-[1.1]"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Iniciar sesión.
        </h1>
        <p className="text-[13px] text-text-muted mt-2">Bienvenida de nuevo.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="text-[12px] text-text-muted font-medium mb-1.5 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dra.carrizo@tecito.com.ar"
            className="w-full px-3.5 py-[11px] rounded-[10px] border border-gray-border-2 bg-surface text-[14px] text-text focus:border-primary-mid"
          />
        </div>

        <div className="mb-5">
          <div className="flex items-baseline justify-between mb-1.5">
            <label className="text-[12px] text-text-muted font-medium">Contraseña</label>
            <button
              type="button"
              onClick={handleForgot}
              disabled={forgotLoading}
              className="text-[11px] text-primary cursor-pointer bg-transparent border-none p-0 hover:underline disabled:opacity-60"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {forgotLoading ? 'enviando…' : '¿Olvidaste?'}
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-[11px] rounded-[10px] border border-gray-border-2 bg-surface text-[14px] text-text focus:border-primary-mid"
          />
        </div>

        <label className="flex items-center gap-2 mb-5 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-gray-border-2 text-primary focus:ring-primary-mid focus:ring-1 cursor-pointer accent-primary"
          />
          <span className="text-[12px] text-text-muted group-hover:text-text transition-colors">
            Recordarme en este dispositivo
          </span>
        </label>

        {info && (
          <div className="text-[12px] text-primary mb-4 bg-primary-light rounded-[8px] px-3 py-2 leading-[1.55]">{info}</div>
        )}

        {error && (
          <div className="text-[12px] text-coral mb-4 bg-coral-light rounded-[8px] px-3 py-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-[12px] rounded-[10px] text-[14px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] disabled:opacity-60 transition-colors"
        >
          {loading ? 'Ingresando…' : 'Entrar'}
        </button>
      </form>

      <div className="text-[12px] text-text-muted mt-6 text-center">
        ¿Primera vez?{' '}
        <button
          type="button"
          onClick={onGoToRegister}
          className="text-primary font-medium cursor-pointer bg-transparent border-none hover:underline"
        >
          Creá tu cuenta
        </button>
      </div>
    </AuthShell>
  )
}
