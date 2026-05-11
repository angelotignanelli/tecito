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
    <div className="bg-bg lg:flex-1 lg:flex lg:flex-col lg:h-full lg:overflow-hidden">
      <div className="px-4 sm:px-10 pt-6 sm:pt-8 pb-28 lg:pb-10 lg:overflow-y-auto lg:flex-1 lg:scrollbar-hide">
        <PageHeader
          title="Bloqueos."
          subtitle="Fechas y horarios no disponibles para nuevos turnos."
        />
        {/* New block form */}
        <form onSubmit={handleSubmit} className="bg-surface border border-gray-border rounded-[14px] p-4 sm:p-5 mb-6">
          <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
            Nuevo bloqueo
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="min-w-0">
              <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5 block" style={{ fontFamily: 'var(--font-mono)' }}>Desde</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                // iOS Safari's native `type=date` control has an intrinsic
                // width and ignores `width:100%` when the grid track lacks
                // `min-w-0`, so the box bleeds past its parent. Forcing
                // box-sizing + min-w-0 + appearance-none keeps it contained,
                // and the `[&:invalid]:text-text-hint` rule keeps the
                // dd/mm/aaaa placeholder visible while the field is empty.
                className="block w-full max-w-full min-w-0 box-border appearance-none px-3 py-[10px] leading-[1.2] rounded-[10px] border border-gray-border bg-bg text-[14px] text-text focus:border-primary-mid focus:outline-none [&:invalid]:text-text-hint"
                required
              />
            </div>
            <div className="min-w-0">
              <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5 block" style={{ fontFamily: 'var(--font-mono)' }}>Hasta</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from}
                className="block w-full max-w-full min-w-0 box-border appearance-none px-3 py-[10px] leading-[1.2] rounded-[10px] border border-gray-border bg-bg text-[14px] text-text focus:border-primary-mid focus:outline-none [&:invalid]:text-text-hint"
                required
              />
            </div>
            <div className="min-w-0">
              <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5 block" style={{ fontFamily: 'var(--font-mono)' }}>Motivo</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="block w-full max-w-full min-w-0 box-border px-3 py-[10px] leading-[1.2] rounded-[10px] border border-gray-border bg-bg text-[14px] text-text focus:border-primary-mid focus:outline-none"
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

          {/* Hand-rolled instead of <Btn> because we want the same
              tall pill height as the WhatsApp CTA in MyLinkSection
              (px-4 py-3.5 + text-[14px] + rounded-[12px]). Btn's md
              size tops out at py-[7px] which read as a secondary
              action next to a card-sized form. */}
          <button
            type="submit"
            disabled={!!overlappingBlock}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] text-[14px] font-medium bg-primary text-surface hover:bg-[#2F3C2D] disabled:opacity-60 cursor-pointer transition-colors mt-3"
          >
            <Icon name="plus" size={13} /> Crear bloqueo
          </button>
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

  const range = block.from === block.to
    ? formatDateShort(block.from)
    : `${formatDateShort(block.from)} → ${formatDateShort(block.to)}`

  return (
    // One-line card: reason leads, range + days sit below in mono. We
    // dropped the colored chip and the giant serif date column — they
    // were causing the duplicate "Otro / Otro" and an oversized left
    // gutter that broke the mobile rhythm.
    <div className="bg-surface border border-gray-border rounded-[14px] px-4 sm:px-5 py-3.5 sm:py-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-text truncate">{block.reason}</div>
        <div
          className="text-[11px] text-text-hint mt-1 truncate"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {range} · {days} día{days !== 1 ? 's' : ''}
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
