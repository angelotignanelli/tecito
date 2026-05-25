import { useState } from 'react'
import {
  useLocations,
  useLocationSchedules,
  type LocationRow,
  type ScheduleDraft,
  type ScheduleRow,
} from '../../lib/hooks'
import Icon from '../Icon'
import Btn from '../Btn'

const allDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface Props {
  userId: string
}

export default function LocationsManager({ userId }: Props) {
  const { locations, add, update, remove, setPrimary } = useLocations(userId)
  const { byLocation, replaceForLocation } = useLocationSchedules(userId)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    setSaving(true)
    // We still write a default work_days/from/to on the parent row so any
    // legacy reader keeps something to fall back on. The real source of
    // truth for the editor is location_schedules though — we seed one
    // single range (mañana 9-13 + tarde 16-20 makes no sense as a default;
    // the simpler default is 9-18 corrido, doctor can split into two later).
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
    if (data) {
      // Seed the new location with a single schedule row that matches the
      // legacy values, so the editor opens with something visible.
      await replaceForLocation(data.id, [
        { days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'], from_time: '09:00', to_time: '18:00' },
      ])
      setEditing(data.id)
    }
    setSaving(false)
  }

  return (
    <div className="bg-white border border-gray-border rounded-[14px] p-5 md:col-span-2">
      <div className="mb-4">
        <div className="text-[13px] font-semibold">Consultorios</div>
        <div className="text-[11px] text-text-hint mt-0.5">
          Los lugares donde atendés. Cada consultorio puede tener uno o varios rangos horarios (ej: mañana y tarde).
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
              schedules={byLocation.get(loc.id) ?? []}
              isEditing={editing === loc.id}
              onEdit={() => setEditing(loc.id)}
              onCancel={() => setEditing(null)}
              onSave={async (locPatch, scheduleDrafts) => {
                // Two writes in series: the parent row (name/address) and
                // the schedule rows. We don't roll back on partial failure
                // — that's a vanishingly rare case and the user can re-edit.
                await update(loc.id, locPatch)
                const err = await replaceForLocation(loc.id, scheduleDrafts)
                if (err) {
                  alert('No se pudieron guardar los rangos horarios. Probá de nuevo.')
                  return
                }
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

// ─── Card ──────────────────────────────────────────────────────────────────

function LocationCard({
  location,
  schedules,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onRemove,
  onSetPrimary,
}: {
  location: LocationRow
  schedules: ScheduleRow[]
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (locPatch: Partial<LocationRow>, schedules: ScheduleDraft[]) => Promise<void>
  onRemove: () => Promise<void>
  onSetPrimary: () => void
}) {
  // ─── READ MODE ────────────────────────────────────────────────────────
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
            {schedules.length > 0 ? (
              <div className="flex flex-col gap-0.5 mt-2">
                {schedules.map((s) => (
                  <div
                    key={s.id}
                    className="text-[11px] text-text-hint"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {(s.days || []).join(' · ')} · {s.from_time.slice(0, 5)} – {s.to_time.slice(0, 5)}
                  </div>
                ))}
              </div>
            ) : location.work_days.length > 0 ? (
              // Fallback for locations that haven't been touched since the
              // multi-range rollout — show the legacy single range so the
              // doctor sees something while they haven't re-saved yet.
              <div className="text-[11px] text-text-hint mt-2" style={{ fontFamily: 'var(--font-mono)' }}>
                {location.work_days.join(' · ')} · {location.work_from?.slice(0, 5)} – {location.work_to?.slice(0, 5)}
              </div>
            ) : null}
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

  // ─── EDIT MODE ────────────────────────────────────────────────────────
  return (
    <LocationEditor
      location={location}
      schedules={schedules}
      onCancel={onCancel}
      onSave={onSave}
    />
  )
}

// ─── Editor (split out for clarity) ───────────────────────────────────────

function LocationEditor({
  location,
  schedules,
  onCancel,
  onSave,
}: {
  location: LocationRow
  schedules: ScheduleRow[]
  onCancel: () => void
  onSave: (locPatch: Partial<LocationRow>, schedules: ScheduleDraft[]) => Promise<void>
}) {
  const [name, setName] = useState(location.name)
  const [address, setAddress] = useState(location.address)
  const [city, setCity] = useState(location.city)
  // Draft array of ranges. Seed from existing schedules; if there are
  // none (legacy location never edited), seed from the work_* fallback
  // so the doctor doesn't see an empty editor.
  const [drafts, setDrafts] = useState<ScheduleDraft[]>(() => {
    if (schedules.length > 0) {
      return schedules.map((s) => ({
        days: s.days ?? [],
        from_time: s.from_time.slice(0, 5),
        to_time: s.to_time.slice(0, 5),
      }))
    }
    return [{
      days: location.work_days?.length ? location.work_days : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
      from_time: location.work_from?.slice(0, 5) || '09:00',
      to_time: location.work_to?.slice(0, 5) || '18:00',
    }]
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const updateDraft = (idx: number, patch: Partial<ScheduleDraft>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
  }

  const toggleDayOnDraft = (idx: number, day: string) => {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d
        return {
          ...d,
          days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day],
        }
      }),
    )
  }

  const addRange = () => {
    // New range defaults to the same days as the last one but a fresh
    // time block (16-20 if the previous ended at 13, otherwise blank).
    setDrafts((prev) => {
      const last = prev[prev.length - 1]
      const defaultFrom = last && last.to_time === '13:00' ? '16:00' : '14:00'
      return [
        ...prev,
        {
          days: last ? [...last.days] : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
          from_time: defaultFrom,
          to_time: '20:00',
        },
      ]
    })
  }

  const removeRange = (idx: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    // Lightweight client-side validation. The DB CHECK will also catch
    // from >= to but the friendlier message lives here.
    for (const [idx, d] of drafts.entries()) {
      if (d.days.length === 0) {
        setError(`El rango ${idx + 1} no tiene días seleccionados.`)
        return
      }
      if (d.from_time >= d.to_time) {
        setError(`El rango ${idx + 1} tiene una hora de inicio mayor o igual a la de fin.`)
        return
      }
    }
    setError(null)
    setSaving(true)

    // Patch the parent row's "summary" fields (work_days/from/to) with
    // the union of days + extreme times so any legacy reader still gets
    // something sensible. Eventually the parent columns get dropped.
    const allDaysUnion = Array.from(new Set(drafts.flatMap((d) => d.days)))
    const earliestFrom = drafts.length > 0 ? drafts.reduce((acc, d) => (d.from_time < acc ? d.from_time : acc), drafts[0].from_time) : '09:00'
    const latestTo = drafts.length > 0 ? drafts.reduce((acc, d) => (d.to_time > acc ? d.to_time : acc), drafts[0].to_time) : '18:00'

    await onSave(
      {
        name,
        address,
        city,
        work_days: allDaysUnion,
        work_from: earliestFrom,
        work_to: latestTo,
      },
      drafts,
    )
    setSaving(false)
  }

  return (
    <div className="bg-surface-2 border border-primary-mid rounded-[12px] p-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del consultorio"
        className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm font-medium mb-3 focus:outline-none focus:border-primary-mid"
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block" style={{ fontFamily: 'var(--font-mono)' }}>Dirección</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block" style={{ fontFamily: 'var(--font-mono)' }}>Ciudad</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid"
          />
        </div>
      </div>

      {/* Ranges */}
      <div className="flex flex-col gap-3 mb-3">
        {drafts.map((draft, idx) => (
          <div
            key={idx}
            className="bg-white border border-gray-border rounded-[10px] p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className="text-[10px] text-text-hint uppercase tracking-[0.12em]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Rango {idx + 1}
              </div>
              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRange(idx)}
                  className="text-[11px] text-coral hover:underline cursor-pointer"
                  title="Eliminar rango"
                >
                  Quitar
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1 mb-2.5">
              {allDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDayOnDraft(idx, day)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer transition-colors ${
                    draft.days.includes(day)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-text-hint border-gray-border hover:bg-surface-2'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Desde
                </label>
                <input
                  type="time"
                  value={draft.from_time}
                  onChange={(e) => updateDraft(idx, { from_time: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid"
                />
              </div>
              <div>
                <label
                  className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-1 block"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Hasta
                </label>
                <input
                  type="time"
                  value={draft.to_time}
                  onChange={(e) => updateDraft(idx, { to_time: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-gray-border bg-white text-sm focus:outline-none focus:border-primary-mid"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRange}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-[13px] font-medium border border-dashed border-gray-border-2 bg-transparent text-text-muted hover:bg-surface hover:border-gray-border-2 cursor-pointer transition-colors"
        >
          <Icon name="plus" size={12} /> Agregar otro rango
        </button>
      </div>

      {error && (
        <div className="text-[12px] text-coral mb-3" role="alert">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Btn size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Btn>
        <Btn size="sm" variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Btn>
      </div>
    </div>
  )
}
