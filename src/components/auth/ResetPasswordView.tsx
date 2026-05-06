import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import AuthShell from './AuthShell'
import Icon from '../Icon'

interface Props {
  /** Called after the new password is saved + user signed out, so the app
   * routes back to the login screen. */
  onResetComplete: () => void
}

/**
 * Shown when Supabase fires a PASSWORD_RECOVERY auth event — i.e. the user
 * just clicked the "reset password" link from their email and Supabase has
 * put them in a temporary recovery session that allows updating the password
 * exactly once.
 *
 * After the password is updated successfully we sign the user out so they
 * have to re-authenticate with the new password — cleaner mental model than
 * silently dropping them into the dashboard.
 */
export default function ResetPasswordView({ onResetComplete }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }
    // Sign out the temporary recovery session so the next step is a clean
    // login with the new password.
    await supabase.auth.signOut()
    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <AuthShell>
        <div className="mb-7">
          <div className="w-12 h-12 rounded-full bg-primary-light text-primary grid place-items-center mb-4">
            <Icon name="check" size={20} />
          </div>
          <h1
            className="text-[32px] font-normal tracking-[-0.028em] text-text m-0 leading-[1.1]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Contraseña actualizada.
          </h1>
          <p className="text-[13px] text-text-muted mt-2 leading-[1.6]">
            Ya podés iniciar sesión con tu nueva contraseña.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetComplete}
          className="w-full py-[12px] rounded-[10px] text-[14px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] transition-colors"
        >
          Ir a iniciar sesión
        </button>
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
          Nueva contraseña.
        </h1>
        <p className="text-[13px] text-text-muted mt-2">Elegí una contraseña nueva para tu cuenta.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="text-[12px] text-text-muted font-medium mb-1.5 block">Contraseña nueva</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            autoFocus
            className="w-full px-3.5 py-[11px] rounded-[10px] border border-gray-border-2 bg-surface text-[14px] text-text focus:border-primary-mid"
          />
        </div>

        <div className="mb-5">
          <label className="text-[12px] text-text-muted font-medium mb-1.5 block">Repetí la contraseña</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-[11px] rounded-[10px] border border-gray-border-2 bg-surface text-[14px] text-text focus:border-primary-mid"
          />
        </div>

        {error && (
          <div className="text-[12px] text-coral mb-4 bg-coral-light rounded-[8px] px-3 py-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-[12px] rounded-[10px] text-[14px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] disabled:opacity-60 transition-colors"
        >
          {loading ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AuthShell>
  )
}
