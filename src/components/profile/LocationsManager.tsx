import { useState } from 'react'
import { useLocations, type LocationRow } from '../../lib/hooks'
import Icon from '../Icon'
import Btn from '../Btn'

const allDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface Props {
  userId: string
}

export default function LocationsManager({ userId }: Props) {
  const { locations, add, update, remove, setPrimary } = useLocations(userId)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    setSaving(true)
    const { data } = await add({
      name: `Consultorio ${locations.length + 1}`,
      address: '',
      city: '',
      notes: '',
      work_days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
      work_from: '09:00',
      work_to: '18:00',
      is_primary: locations.length === 0,
    })
    setSaving(false)
    if (data) setEditing(data.id)
  }

  return (
    <div className="bg-white border border-gray-border rounded-[14px] p-5 md:col-span-2">
      <div className="mb-4">
        <div className="text-[13px] font-semibold">Consultorios</div>
        <div className="text-[11px] text-text-hint mt-0.5">
          Los lugares donde atendés. Cada uno tiene sus propios días y horarios.
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="text-center py-8 text-[12px] text-text-hint">
          Todavía no cargaste ningún consultorio.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {locations.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              isEditing={editing === loc.id}
              onEdit={() => setEditing(loc.id)}
              onCancel={() => setEditing(null)}
              onSave={async (patch) => {
                await update(loc.id, patch)
                setEditing(null)
              }}
              onRemove={async () => {
                if (confirm('¿Eliminar este consultorio?')) {
                  await remove(loc.id)
                  if (editing === loc.id) setEditing(null)
                }
              }}
              onSetPrimary={() => setPrimary(loc.id)}
            />
          ))}
        </div>
      )}

      {/* Full-width "Agregar consultorio" CTA pinned to the bottom of
          the card, sized to match the Cerrar sesión / Agregar a Google
          Calendar buttons (py-3 / text-[14px] / rounded-[10px]). */}
      <button
        type="button"
        onClick={handleAdd}
        disabled={saving}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] text-[14px] font-medium border border-gray-border bg-surface text-text-muted hover:bg-surface-2 disabled:opacity-60 cursor-pointer transition-colors"
      >
        <Icon name="plus" size={14} /> Agregar consultorio
      </button>
    </div>
  )
}

function LocationCard({
  location,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onRemove,
  onSetPrimary,
}: {
  location: LocationRow
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (patch: Partial<LocationRow>) => Promise<void>
  onRemove: () => Promise<void>
  onSetPrimary: () => void
}) {
  const [draft, setDraft] = useState({
    name: location.name,
    address: location.address,
    city: location.city,
    work_days: location.work_days,
    work_from: location.work_from?.slice(0, 5) || '09:00',
    work_to: location.work_to?.slice(0, 5) || '18:00',
  })

  const toggleDay = (day: string) => {
    setDraft((prev) => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter((d) => d !== day)
        : [...prev.work_days, day],
    }))
  }

  if (!isEditing) {
    return (
      <div className="bg-surface-2 border border-gray-border rounded-[12px] p-4">
        <div className="flex items-start justify-between mb-2 gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[14px] font-medium truncate">{location.name}</div>
              {location.is_primary && (
                <span className="text-[10px] px-2 py-[1px] rounded-full bg-primary-light text-primary font-semibold uppercase tracking-wider shrink-0">
                  Principal
                </span>
              )}
            </div>
            <div className="text-[12px] text-text-muted mt-1">
              {location.address}{location.city && `, ${location.city}`}
            </div>
            {location.work_days.length > 0 && (
              <div className="text-[11px] text-text-hint mt-2" style={{ fontFamily: 'var(--font-mono)' }}>
                {location.work_days.join(' · ')} · {location.work_from?.slice(0, 5)} – {location.work_to?.slice(0, 5)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!location.is_primary && (
              <button
                type="button"
                onClick={onSetPrimary}
                className="text-[11px] px-2.5 py-1 rounded-md border border-gray-border bg-white text-text-muted hover:bg-surface-2 cursor-pointer"
                title="Marcar como principal"
              >
                Principal
              </button>
            )}
            <Btn size="sm" onClick={onEdit}>
              <Icon name="edit" size={12} />
            </Btn>
            <Btn size="sm" variant="danger" onClick={onRemove}>
              <Icon name="trash" size={12} />
            </Btn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-2 border border-primary-mid rounded-[12px] p-4">
      <input
        type="text"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="Nombre del consultorio"
        className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm font-medium mb-3 focus:outline-none focus:border-primary-mid"
      />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block" style={{ fontFamily: 'var(--font-mono)' }}>Dirección</label>
          <input
            type="text"
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block" style={{ fontFamily: 'var(--font-mono)' }}>Ciudad</label>
          <input
            type="text"
            value={draft.city}
            onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1.5 block" style={{ fontFamily: 'var(--font-mono)' }}>Días</label>
        <div className="flex flex-wrap gap-1">
          {allDays.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer transition-colors ${
                draft.work_days.includes(day)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-hint border-gray-border hover:bg-surface-2'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block" style={{ fontFamily: 'var(--font-mono)' }}>Desde</label>
          <input
            type="time"
            value={draft.work_from}
            onChange={(e) => setDraft({ ...draft, work_from: e.target.value })}
            className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block" style={{ fontFamily: 'var(--font-mono)' }}>Hasta</label>
          <input
            type="time"
            value={draft.work_to}
            onChange={(e) => setDraft({ ...draft, work_to: e.target.value })}
            className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onCancel}>Cancelar</Btn>
        <Btn
          size="sm"
          variant="primary"
          onClick={() => onSave({
            name: draft.name,
            address: draft.address,
            city: draft.city,
            work_days: draft.work_days,
            work_from: draft.work_from,
            work_to: draft.work_to,
          })}
        >
          Guardar
        </Btn>
      </div>
    </div>
  )
}
