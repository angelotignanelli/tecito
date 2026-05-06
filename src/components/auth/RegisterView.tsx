import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import AuthShell from './AuthShell'
import Icon from '../Icon'

interface Props {
  onRegisterSuccess: () => void
  onGoToLogin: () => void
}

export default function RegisterView({ onRegisterSuccess, onGoToLogin }: Props) {
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    if (!trimmedName || !email || !password) {
      setError('Completá todos los campos')
      return
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Ingresá un email válido')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    // Split the full name into first + last for the profile
    const [firstName, ...rest] = trimmedName.split(' ')
    const lastName = rest.join(' ') || ''

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    setStep('verify')
  }

  if (step === 'verify') {
    return (
      <AuthShell>
        <div className="mb-7">
          <div className="w-12 h-12 rounded-full bg-primary-light text-primary grid place-items-center mb-4">
            <Icon name="email" size={20} />
          </div>
          <h1
            className="text-[32px] font-normal tracking-[-0.028em] text-text m-0 leading-[1.1]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Verificá tu email.
          </h1>
          <p className="text-[13px] text-text-muted mt-2 leading-[1.6]">
            Enviamos un link de verificación a <strong className="text-text">{email}</strong>.
            Revisá tu bandeja (y spam), hacé clic en el link, y volvé acá.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToLogin}
          className="w-full py-[12px] rounded-[10px] text-[14px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] transition-colors"
        >
          Ir a iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setStep('form')}
          className="w-full py-[12px] mt-2 rounded-[10px] text-[13px] font-medium cursor-pointer bg-surface border border-gray-border-2 text-text-muted hover:bg-surface-2 transition-colors"
        >
          Volver al formulario
        </button>

        <div
          className="mt-8 pt-5 border-t border-gray-border text-[11px] text-text-hint uppercase tracking-[0.12em]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          no te llegó nada? <a className="text-primary cursor-pointer ml-1 normal-case tracking-normal">reenviar email</a>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <h1
          className="text-[36px] font-normal tracking-[-0.028em] text-text m-0 leading-[1.1]"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Creá tu cuenta.
        </h1>
        <p className="text-[13px] text-text-muted mt-2">Gratis hasta 10 pacientes · sin tarjeta.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="text-[12px] text-text-muted font-medium mb-1.5 block">Nombre y apellido</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alejandra Carrizo"
            className="w-full px-3.5 py-[11px] rounded-[10px] border border-gray-border-2 bg-surface text-[14px] text-text focus:border-primary-mid"
          />
        </div>

        <div className="mb-4">
          <label className="text-[12px] text-text-muted font-medium mb-1.5 block">Email profesional</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dra.carrizo@tecito.com.ar"
            className="w-full px-3.5 py-[11px] rounded-[10px] border border-gray-border-2 bg-surface text-[14px] text-text focus:border-primary-mid"
          />
        </div>

        <div className="mb-4">
          <label className="text-[12px] text-text-muted font-medium mb-1.5 block">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="w-full px-3.5 py-[11px] rounded-[10px] border border-gray-border-2 bg-surface text-[14px] text-text focus:border-primary-mid"
          />
        </div>

        <div className="text-[11px] text-text-hint leading-[1.6] mb-4">
          Al continuar aceptás los{' '}
          <a className="text-primary cursor-pointer">términos</a> y la{' '}
          <a className="text-primary cursor-pointer">política de privacidad</a>.
        </div>

        {error && (
          <div className="text-[12px] text-coral mb-4 bg-coral-light rounded-[8px] px-3 py-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-[12px] rounded-[10px] text-[14px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] disabled:opacity-60 transition-colors"
        >
          {loading ? 'Creando…' : 'Crear cuenta gratis'}
        </button>
      </form>

      <div className="text-[12px] text-text-muted mt-6 text-center">
        ¿Ya tenés cuenta?{' '}
        <button
          type="button"
          onClick={onGoToLogin}
          className="text-primary font-medium cursor-pointer bg-transparent border-none hover:underline"
        >
          Iniciá sesión
        </button>
      </div>
    </AuthShell>
  )
}
