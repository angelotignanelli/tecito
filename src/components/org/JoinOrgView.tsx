import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Logo from '../Logo'

interface Props {
  inviteCode: string
  onJoined: (orgId: string, orgName: string) => void
  onSkip: () => void
}

export default function JoinOrgView({ inviteCode, onJoined, onSkip }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAccept = async () => {
    setLoading(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('accept_invite', { p_invite_code: inviteCode })
    setLoading(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    const result = data as any
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.already_member) {
      onJoined(result.organization_id || '', result.organization_name)
      return
    }
    if (result.success) {
      onJoined(result.organization_id, result.organization_name)
    }
  }

  return (
    <div className="min-h-screen bg-gray-bg flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-8">
          <Logo variant="full" size={32} />
          <div className="text-sm text-text-hint mt-2">Panel profesional</div>
        </div>

        <div className="bg-white border border-gray-border rounded-[10px] p-6 text-center">
          <div className="text-4xl mb-4">🏥</div>
          <div className="text-lg font-semibold mb-2">Te invitaron a una organizacion</div>
          <div className="text-sm text-text-muted mb-6">
            Alguien te invito a unirte a su consultorio en Tecito. Al aceptar, vas a aparecer como medico dentro de su organizacion.
          </div>

          {error && (
            <div className="text-xs text-coral mb-4 bg-coral-light rounded-md px-3 py-2">{error}</div>
          )}

          <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full py-2.5 rounded-md text-sm font-medium cursor-pointer border border-primary bg-primary text-white hover:bg-[#534AB7] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mb-3"
          >
            {loading ? 'Uniéndose...' : 'Aceptar invitacion'}
          </button>
          <button
            onClick={onSkip}
            className="w-full py-2.5 rounded-md text-sm cursor-pointer border border-gray-border bg-white text-text-muted hover:bg-gray-bg transition-colors"
          >
            Omitir por ahora
          </button>
        </div>
      </div>
    </div>
  )
}
