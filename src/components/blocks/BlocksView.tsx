import { useState } from 'react'
import type { DateBlock } from '../../data/appointments'
import { formatDateShort, getDatesBetween } from '../../data/appointments'
import PageHeader from '../PageHeader'
import Icon from '../Icon'
import Btn from '../Btn'

interface Props {
  blocks: DateBlock[]
  onAdd: (block: Omit<DateBlock, 'id' | 'createdAt'>) => void
  onRemove: (id: string) => void
}

export default function BlocksView({ blocks, onAdd, onRemove }: Props) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('Vacaciones')

  const overlappingBlock = from && to && to >= from
    ? blocks.find((b) => from <= b.to && to >= b.from)
    : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!from || !to) return
    if (to < from) return
    if (overlappingBlock) return
    onAdd({ from, to, reason })
    setFrom('')
    setTo('')
    setReason('Vacaciones')
  }

  const activeBlocks = blocks.filter((b) => b.to >= new Date().toISOString().split('T')[0])
  const pastBlocks = blocks.filter((b) => b.to < new Date().toISOString().split('T')[0])

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      <div className="px-4 sm:px-10 pt-6 sm:pt-8 pb-10 overflow-y-auto flex-1 pb-20 lg:pb-10 scrollbar-hide">
        <PageHeader
          title="Bloqueos."
          subtitle="Fechas y horarios no disponibles para nuevos turnos."
        />
        {/* New block form */}
        <form onSubmit={handleSubmit} className="bg-surface border border-gray-border rounded-[14px] p-5 mb-6">
          <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
            Nuevo bloqueo
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block" style={{ fontFamily: 'var(--font-mono)' }}>Desde</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-[9px] rounded-[8px] border border-gray-border bg-surface-2 text-[13px] text-text focus:border-primary-mid"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block" style={{ fontFamily: 'var(--font-mono)' }}>Hasta</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from}
                className="w-full px-3 py-[9px] rounded-[8px] border border-gray-border bg-surface-2 text-[13px] text-text focus:border-primary-mid"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block" style={{ fontFamily: 'var(--font-mono)' }}>Motivo</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-[9px] rounded-[8px] border border-gray-border bg-surface-2 text-[13px] text-text focus:border-primary-mid"
              >
                <option>Vacaciones</option>
                <option>Congreso / Capacitación</option>
                <option>Licencia médica</option>
                <option>Feriado</option>
                <option>Otro</option>
              </select>
            </div>
          </div>

          {from && to && to >= from && (
            <div className="text-xs text-text-muted mb-3">
              {getDatesBetween(from, to).length} día{getDatesBetween(from, to).length !== 1 ? 's' : ''} bloqueado{getDatesBetween(from, to).length !== 1 ? 's' : ''}
            </div>
          )}

          {overlappingBlock && (
            <div className="flex items-center gap-2 bg-coral-light rounded-[8px] px-3 py-2 mb-3">
              <Icon name="block" size={14} style={{ color: 'var(--color-coral)' }} />
              <div className="text-xs text-coral">
                Las fechas se superponen con <strong>{overlappingBlock.reason}</strong> ({formatDateShort(overlappingBlock.from)} → {formatDateShort(overlappingBlock.to)}). Elegí un rango que no se pise con bloqueos existentes.
              </div>
            </div>
          )}

          <Btn type="submit" disabled={!!overlappingBlock} variant="primary">
            <Icon name="plus" size={13} /> Crear bloqueo
          </Btn>
        </form>

        {/* Active blocks */}
        <div className="mb-8">
          <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
            Bloqueos activos · {activeBlocks.length}
          </div>

          {activeBlocks.length === 0 ? (
            <div className="bg-surface border border-gray-border rounded-[14px] p-6 text-center">
              <Icon name="check" size={20} style={{ color: 'var(--color-teal)' }} />
              <div className="text-sm text-text-muted mt-2">No hay bloqueos activos</div>
              <div className="text-xs text-text-hint mt-1">Todos los días están disponibles para turnos</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeBlocks.map((block) => (
                <BlockCard key={block.id} block={block} onRemove={onRemove} />
              ))}
            </div>
          )}
        </div>

        {pastBlocks.length > 0 && (
          <div>
            <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
              Bloqueos pasados · {pastBlocks.length}
            </div>
            <div className="flex flex-col gap-2 opacity-60">
              {pastBlocks.map((block) => (
                <BlockCard key={block.id} block={block} onRemove={onRemove} isPast />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BlockCard({ block, onRemove, isPast }: { block: DateBlock; onRemove: (id: string) => void; isPast?: boolean }) {
  const days = getDatesBetween(block.from, block.to).length

  const reasonStyle: Record<string, { bg: string; fg: string }> = {
    'Vacaciones': { bg: 'bg-teal-light', fg: 'text-teal' },
    'Congreso / Capacitación': { bg: 'bg-primary-light', fg: 'text-primary' },
    'Licencia médica': { bg: 'bg-coral-light', fg: 'text-coral' },
    'Feriado': { bg: 'bg-amber-light', fg: 'text-amber' },
    'Otro': { bg: 'bg-surface-2', fg: 'text-text-muted' },
  }
  const s = reasonStyle[block.reason] ?? reasonStyle['Otro']

  return (
    <div className="bg-surface border border-gray-border rounded-[14px] px-5 py-4 flex items-center gap-4">
      <div className="min-w-[92px]">
        <div className="text-[18px] tracking-[-0.015em] leading-none text-text" style={{ fontFamily: 'var(--font-serif)' }}>
          {formatDateShort(block.from)}
        </div>
        {block.from !== block.to && (
          <div className="text-[11px] text-text-hint mt-[3px]" style={{ fontFamily: 'var(--font-mono)' }}>
            → {formatDateShort(block.to)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-text">{block.reason}</div>
        <div className="text-[12px] text-text-muted mt-[3px] flex items-center gap-2">
          <span className={`inline-block text-[11px] font-medium px-[9px] py-[2px] rounded-full ${s.bg} ${s.fg}`}>
            {block.reason}
          </span>
          <span>{days} día{days !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {!isPast && (
        <Btn size="sm" variant="danger" onClick={() => onRemove(block.id)}>
          Eliminar
        </Btn>
      )}
    </div>
  )
}
