import { useState } from 'react'

interface Props {
  onClose: () => void
  onCreate: (name: string, slug: string) => Promise<any>
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

export default function CreateOrgModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [customSlug, setCustomSlug] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleNameChange = (v: string) => {
    setName(v)
    if (!customSlug) setSlug(toSlug(v))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) {
      setError('Completa nombre y slug')
      return
    }
    setLoading(true)
    setError('')
    const err = await onCreate(name.trim(), slug.trim())
    setLoading(false)
    if (err) {
      setError(err.message?.includes('duplicate') ? 'Ese slug ya esta en uso' : err.message || 'Error al crear')
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-stretch sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white sm:rounded-[10px] sm:border sm:border-gray-border w-full sm:max-w-[420px] h-full sm:h-auto p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-semibold mb-1">Crear organizacion</div>
        <div className="text-sm text-text-muted mb-5">Arma tu consultorio y sumá otros medicos</div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="text-[11px] text-text-hint uppercase tracking-wide mb-1 block">Nombre de la organizacion</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Consultorio Perez & Asociados"
              className="w-full px-3 py-2.5 rounded-md border border-gray-border text-sm focus:outline-none focus:border-primary-mid focus:ring-1 focus:ring-primary-mid"
            />
          </div>

          <div className="mb-4">
            <label className="text-[11px] text-text-hint uppercase tracking-wide mb-1 block">Slug (para el link)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlug(toSlug(e.target.value)); setCustomSlug(true) }}
              placeholder="consultorio-perez"
              className="w-full px-3 py-2.5 rounded-md border border-gray-border text-sm focus:outline-none focus:border-primary-mid focus:ring-1 focus:ring-primary-mid font-mono"
            />
            <div className="text-[10px] text-text-hint mt-1">Identificador unico. Solo letras, numeros y guiones.</div>
          </div>

          {error && (
            <div className="text-xs text-coral mb-4 bg-coral-light rounded-md px-3 py-2">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-md text-sm font-medium cursor-pointer border border-primary bg-primary text-white hover:bg-[#534AB7] transition-colors disabled:opacity-60"
            >
              {loading ? 'Creando...' : 'Crear organizacion'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-md text-sm cursor-pointer border border-gray-border bg-white text-text-muted hover:bg-gray-bg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
