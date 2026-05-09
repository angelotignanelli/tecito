import { useEffect, useMemo, useState } from 'react'
import {
  getAvailableSlotsRange,
  getDoctorByBookingCode,
  getGroupedAvailableSlots,
  getPublicDoctorLocations,
  locationColor,
  type DaySlotsGrouped,
  type PublicDoctor,
  type PublicLocation,
} from '../../lib/publicBooking'
import BookingModal from './BookingModal'
import Icon from '../Icon'
import Logo from '../Logo'

interface Props {
  bookingCode: string
}

const DOW_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatDayChip(dateISO: string) {
  const d = new Date(dateISO + 'T12:00:00')
  const todayISO = new Date().toISOString().split('T')[0]
  const tomorrowISO = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const dow = DOW_SHORT[d.getDay()]
  let heading = dow
  if (dateISO === todayISO) heading = 'HOY'
  else if (dateISO === tomorrowISO) heading = 'MAÑ'
  return { heading, dayNum: d.getDate(), month: MONTHS_SHORT[d.getMonth()], dateISO }
}

// Translate a location's work_days array into a human short label (e.g. "Lun, Mié, Vie")
function workDaysLabel(days: string[] | null | undefined): string {
  if (!days || days.length === 0) return ''
  if (days.length === 7) return 'Todos los días'
  if (days.length === 5 && days.includes('Lun') && days.includes('Vie')) return 'Lun a Vie'
  return days.join(', ')
}

export default function PublicBookingPage({ bookingCode }: Props) {
  const [doctor, setDoctor] = useState<PublicDoctor | null>(null)
  const [locations, setLocations] = useState<PublicLocation[]>([])
  const [allSlots, setAllSlots] = useState<DaySlotsGrouped[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Selection state
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [pickedTime, setPickedTime] = useState<string | null>(null)
  const [manualLocationId, setManualLocationId] = useState<string | null>(null)

  const [selectedSlot, setSelectedSlot] = useState<
    { date: string; time: string; dayLabel: string } | null
  >(null)
  const [openBooking, setOpenBooking] = useState(false)

  useEffect(() => {
    ;(async () => {
      const doc = await getDoctorByBookingCode(bookingCode)
      if (!doc) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setDoctor(doc)

      const locs = await getPublicDoctorLocations(doc.id)
      setLocations(locs)

      const slots = await getGroupedAvailableSlots(doc.id, locs, 45)
      setAllSlots(slots)
      setLoading(false)
    })()
  }, [bookingCode])

  // When the patient picks a specific consultorio in the right rail,
  // re-fetch slots filtered to JUST that location. This sidesteps the
  // "first-wins by date" merge inside getGroupedAvailableSlots, which
  // hid every day where another consultorio happened to be primary —
  // a doctor with overlapping work days (e.g. Consultorio A: Mié+Vie,
  // Consultorio B: Lun a Vie) would see B's Wed/Fri vanish entirely.
  // No-filter view (manualLocationId=null) keeps the merged behavior:
  // each day still has one representative location to display.
  useEffect(() => {
    if (!doctor) return
    if (!manualLocationId) {
      // Refresh the merged view (in case data changed while a filter was active).
      getGroupedAvailableSlots(doctor.id, locations, 45).then(setAllSlots)
      return
    }
    let cancelled = false
    getAvailableSlotsRange(doctor.id, 45, manualLocationId).then((slots) => {
      if (cancelled) return
      setAllSlots(slots.map((s) => ({ ...s, locationId: manualLocationId })))
    })
    return () => { cancelled = true }
  }, [doctor, locations, manualLocationId])

  // Indexes for quick lookup
  const locationsById = useMemo(() => {
    const m = new Map<string, { loc: PublicLocation; color: string; index: number }>()
    locations.forEach((loc, i) => m.set(loc.id, { loc, color: locationColor(i), index: i }))
    return m
  }, [locations])

  // The day currently picked in the calendar (full record)
  const currentDay = useMemo(
    () => allSlots.find((d) => d.date === selectedDay) ?? null,
    [allSlots, selectedDay],
  )

  // Effective location (derived): manual pick wins; otherwise, whatever the selected date owns.
  const effectiveLocationId = manualLocationId ?? currentDay?.locationId ?? null
  const effectiveLocation = effectiveLocationId
    ? (locationsById.get(effectiveLocationId)?.loc ?? null)
    : null

  const fullAddress = effectiveLocation?.address
    ? `${effectiveLocation.address}${effectiveLocation.city ? ', ' + effectiveLocation.city : ''}`
    : doctor?.address
      ? `${doctor.address}${doctor.city ? ', ' + doctor.city : ''}`
      : ''

  const handleBookingSuccess = async () => {
    if (!doctor) return
    // 1) Refresh availability so the just-booked slot doesn't show as
    //    available anymore if the patient browses again.
    const slots = await getGroupedAvailableSlots(doctor.id, locations, 45)
    setAllSlots(slots)
    // 2) Dismiss the modal and clear the picker state. Without this the
    //    "Listo" button on the success screen had nothing to react to and
    //    the patient was stuck on the green confirmation forever.
    setOpenBooking(false)
    setSelectedSlot(null)
    setPickedTime(null)
    setSelectedDay(null)
  }

  const handleOfficeClick = (locId: string) => {
    if (manualLocationId === locId) {
      // Toggle off → back to auto mode
      setManualLocationId(null)
    } else {
      setManualLocationId(locId)
      // If the currently selected day doesn't belong to this location, clear it
      if (currentDay && currentDay.locationId !== locId) {
        setSelectedDay(null)
        setPickedTime(null)
      }
    }
  }

  const handleDayClick = (iso: string) => {
    if (selectedDay !== iso) setPickedTime(null)
    setSelectedDay(iso)
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}
      >
        <div className="text-[13px] text-text-hint" style={{ fontFamily: 'var(--font-mono)' }}>
          CARGANDO…
        </div>
      </div>
    )
  }

  if (notFound || !doctor) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}
      >
        <div className="max-w-md text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-surface border border-gray-border grid place-items-center text-text-hint">
            <Icon name="search" size={20} />
          </div>
          <div
            className="text-[22px] font-normal text-text leading-[1.15] tracking-[-0.015em]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Profesional no encontrado.
          </div>
          <div className="text-[13px] text-text-muted mt-3 leading-[1.55]">
            El link que estás usando no es válido o expiró. Verificá con el profesional.
          </div>
        </div>
      </div>
    )
  }

  const initials = `${doctor.first_name[0]}${doctor.last_name[0]}`.toUpperCase()
  const mapUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null

  return (
    <div
      className="h-screen lg:overflow-hidden flex flex-col"
      style={{ background: 'var(--color-bg)', fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}
    >
      <h1 className="sr-only">
        Reservá turno con {doctor.first_name} {doctor.last_name}
        {doctor.specialty ? ` — ${doctor.specialty}` : ''}
      </h1>

      {/* Header */}
      <header className="bg-surface border-b border-gray-border shrink-0" role="banner">
        <div className="px-6 lg:px-10 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="cursor-pointer" aria-label="Volver a Tecito">
              <Logo variant="full" size={22} />
            </a>
            <div
              className="hidden sm:block text-[11px] text-text-hint"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              tecito.com.ar/{doctor.last_name?.toLowerCase().replace(/\s+/g, '-') || bookingCode}
            </div>
          </div>
          <div
            className="text-[10px] text-text-hint uppercase tracking-[0.14em] flex items-center gap-1.5"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <Icon name="check" size={10} /> Conexión segura
          </div>
        </div>
      </header>

      {/* MOBILE — compact doctor header */}
      <section
        className="lg:hidden bg-surface border-b border-gray-border px-6 py-5"
        aria-label="Profesional"
      >
        <div className="flex items-start gap-4">
          <div
            className="w-[60px] h-[60px] rounded-full bg-primary-light text-primary grid place-items-center text-[18px] shrink-0 overflow-hidden"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {doctor.avatar_url ? (
              <img
                src={doctor.avatar_url}
                alt={`Foto de ${doctor.first_name} ${doctor.last_name}`}
                width={60}
                height={60}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="flex-1 min-w-0">
            {doctor.specialty && (
              <div
                className="text-[11px] text-text-hint uppercase tracking-[0.15em] mb-1"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {doctor.specialty}
              </div>
            )}
            <div
              className="text-[22px] font-normal text-text leading-[1.1] tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {doctor.first_name} {doctor.last_name}
            </div>
            {fullAddress && (
              <div className="text-[12px] text-text-muted mt-2 leading-[1.5]">
                {fullAddress}
                {mapUrl && (
                  <>
                    {' · '}
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-medium hover:underline"
                    >
                      Cómo llegar
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* DESKTOP — 3 column layout (sidebar · calendar · rail) */}
      <main className="hidden lg:grid lg:grid-cols-[280px_1fr_360px] flex-1 min-h-0" role="main">
        <DoctorSidebar doctor={doctor} initials={initials} />

        {allSlots.length === 0 ? (
          <div className="col-span-2 flex items-center justify-center">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-surface border border-gray-border grid place-items-center text-text-hint">
                <Icon name="calendar" size={20} />
              </div>
              <div className="text-[14px] text-text">No hay horarios disponibles.</div>
              <div className="text-[12px] text-text-hint mt-1.5 leading-[1.55]">
                Contactá al profesional para más opciones.
              </div>
            </div>
          </div>
        ) : (
          <>
            <CalendarGrid
              allSlots={allSlots}
              selectedDay={selectedDay}
              onSelectDay={handleDayClick}
              manualLocationId={manualLocationId}
              locationsById={locationsById}
              stepIndex={pickedTime ? 1 : 0}
            />
            <RightRail
              locations={locations}
              locationsById={locationsById}
              manualLocationId={manualLocationId}
              effectiveLocationId={effectiveLocationId}
              onOfficeClick={handleOfficeClick}
              currentDay={currentDay}
              selectedTime={pickedTime}
              onPickSlot={setPickedTime}
              onConfirm={() => {
                if (!currentDay || !pickedTime) return
                setSelectedSlot({
                  date: currentDay.date,
                  time: pickedTime,
                  dayLabel: currentDay.dayLabel,
                })
                setOpenBooking(true)
              }}
            />
          </>
        )}
      </main>

      {/* MOBILE — accordion list */}
      <main className="lg:hidden flex-1 flex flex-col" role="main">
        {locations.length > 1 && (
          <div className="px-4 pt-5">
            <div
              className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-2"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Consultorio · <span className="normal-case tracking-normal italic text-text-hint" style={{ fontFamily: 'var(--font-sans)' }}>
                {manualLocationId ? 'filtrando el calendario' : 'se elige con la fecha'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {locations.map((loc) => {
                const meta = locationsById.get(loc.id)!
                const active = manualLocationId === loc.id
                return (
                  <button
                    key={loc.id}
                    onClick={() => handleOfficeClick(loc.id)}
                    className={`text-left px-3.5 py-2.5 rounded-[10px] border cursor-pointer transition-colors flex items-start gap-2.5 ${
                      active
                        ? 'bg-primary-light border-primary'
                        : 'bg-surface border-gray-border hover:bg-surface-2'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-[6px]"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-medium ${active ? 'text-primary' : 'text-text'}`}>
                        {loc.name}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5 truncate">
                        {loc.address}
                        {loc.city && `, ${loc.city}`}
                        {loc.work_days && loc.work_days.length > 0 && ` · ${workDaysLabel(loc.work_days)}`}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {allSlots.length === 0 ? (
          <div className="text-center py-16 px-6 flex-1">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-surface border border-gray-border grid place-items-center text-text-hint">
              <Icon name="calendar" size={20} />
            </div>
            <div className="text-[14px] text-text">No hay horarios disponibles.</div>
            <div className="text-[12px] text-text-hint mt-1.5 leading-[1.55]">
              Contactá al profesional para más opciones.
            </div>
          </div>
        ) : (
          <div className="flex-1 px-4 py-5">
            <div
              className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-2"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Elegí el día
            </div>
            <div className="flex flex-col gap-2">
              {allSlots.map((day) => {
                const open = selectedDay === day.date
                const chip = formatDayChip(day.date)
                const dimmed = manualLocationId !== null && day.locationId !== manualLocationId
                const pinColor = day.locationId ? locationsById.get(day.locationId)?.color : null
                return (
                  <div
                    key={day.date}
                    className={`bg-surface rounded-[12px] border overflow-hidden transition-opacity ${
                      open ? 'border-primary' : 'border-gray-border'
                    } ${dimmed ? 'opacity-30' : ''}`}
                  >
                    <button
                      onClick={() => !dimmed && setSelectedDay(open ? null : day.date)}
                      disabled={dimmed}
                      className="w-full px-4 py-3 flex items-center gap-3.5 cursor-pointer text-left disabled:cursor-not-allowed"
                    >
                      <div className="text-center min-w-[40px]">
                        <div
                          className="text-[9px] text-text-hint uppercase tracking-[0.12em]"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {chip.heading}
                        </div>
                        <div
                          className="text-[22px] font-medium leading-none mt-0.5 text-text"
                          style={{ fontFamily: 'var(--font-serif)' }}
                        >
                          {chip.dayNum}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-text capitalize flex items-center gap-2">
                          {day.dayLabel}
                          {pinColor && (
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block"
                              style={{ backgroundColor: pinColor }}
                              aria-hidden
                            />
                          )}
                        </div>
                        <div className="text-[11px] text-text-hint mt-0.5">
                          {day.slots.length}{' '}
                          {day.slots.length === 1 ? 'horario disponible' : 'horarios disponibles'}
                        </div>
                      </div>
                      <div
                        className="text-text-hint text-[16px] transition-transform"
                        style={{ transform: open ? 'rotate(90deg)' : 'none' }}
                      >
                        ›
                      </div>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 border-t border-gray-border">
                        <AccordionSlotBlocks
                          slots={day.slots}
                          selectedTime={selectedSlot && openBooking && selectedSlot.date === day.date ? selectedSlot.time : null}
                          onPick={(time) => {
                            setSelectedSlot({ date: day.date, time, dayLabel: day.dayLabel })
                            setOpenBooking(true)
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {openBooking && selectedSlot && (
        <BookingModal
          doctor={doctor}
          slot={selectedSlot}
          location={effectiveLocation}
          onClose={() => setOpenBooking(false)}
          onSuccess={async () => {
            await handleBookingSuccess()
          }}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Doctor sidebar (desktop, simplified)
// ────────────────────────────────────────────────────────────────

function DoctorSidebar({ doctor, initials }: { doctor: PublicDoctor; initials: string }) {
  const duration = `${doctor.session_duration || 50} min`
  return (
    <aside className="bg-surface border-r border-gray-border p-8 overflow-y-auto scrollbar-hide">
      <div
        className="w-12 h-12 rounded-full bg-primary-light text-primary grid place-items-center text-[17px] overflow-hidden mb-[14px]"
        style={{ fontFamily: 'var(--font-serif)', border: '1px solid rgba(59,74,56,0.15)' }}
      >
        {doctor.avatar_url ? (
          <img
            src={doctor.avatar_url}
            alt={`Foto de ${doctor.first_name} ${doctor.last_name}`}
            width={48}
            height={48}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="w-full h-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      {doctor.specialty && (
        <div
          className="text-[10px] text-text-hint uppercase tracking-[0.14em] mb-1"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {doctor.specialty}
        </div>
      )}
      <div
        className="text-[22px] font-medium text-text leading-[1.15] tracking-[-0.02em]"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {doctor.first_name} {doctor.last_name}
      </div>
      {doctor.license && (
        <div
          className="text-[11px] text-text-hint mt-1"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          MN · {doctor.license}
        </div>
      )}

      {doctor.bio && (
        <p
          className="text-[13px] text-text-muted leading-[1.55] mt-[18px] italic"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {doctor.bio}
        </p>
      )}

      <div className="mt-[22px] pt-4 border-t border-gray-border grid gap-3">
        <div>
          <div
            className="text-[9px] text-text-hint uppercase tracking-[0.14em] mb-[3px]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Duración
          </div>
          <div className="text-[12.5px] text-text">{duration}</div>
        </div>
        {doctor.price_particular && (
          <div>
            <div
              className="text-[9px] text-text-hint uppercase tracking-[0.14em] mb-[3px]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Valor particular
            </div>
            <div className="text-[12.5px] text-text">
              ${doctor.price_particular.toLocaleString('es-AR')}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

// ────────────────────────────────────────────────────────────────
// Calendar grid (desktop) — Monday-first weekly grid with location pin
// ────────────────────────────────────────────────────────────────

function CalendarGrid({
  allSlots,
  selectedDay,
  onSelectDay,
  manualLocationId,
  locationsById,
  stepIndex,
}: {
  allSlots: DaySlotsGrouped[]
  selectedDay: string | null
  onSelectDay: (iso: string) => void
  manualLocationId: string | null
  locationsById: Map<string, { loc: PublicLocation; color: string; index: number }>
  stepIndex: number
}) {
  const slotMap = new Map<string, DaySlotsGrouped>()
  for (const d of allSlots) slotMap.set(d.date, d)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = toISO(today)
  const weeks = 4
  const dow = today.getDay()
  const offsetToMonday = (dow + 6) % 7
  const start = new Date(today)
  start.setDate(today.getDate() - offsetToMonday)

  const grid: Array<
    Array<{
      iso: string
      num: number
      inPast: boolean
      isToday: boolean
      day: DaySlotsGrouped | undefined
    }>
  > = []
  for (let w = 0; w < weeks; w++) {
    const row: (typeof grid)[number] = []
    for (let di = 0; di < 7; di++) {
      const cell = new Date(start)
      cell.setDate(start.getDate() + w * 7 + di)
      const iso = toISO(cell)
      row.push({
        iso,
        num: cell.getDate(),
        inPast: cell < today,
        isToday: iso === todayISO,
        day: slotMap.get(iso),
      })
    }
    grid.push(row)
  }

  const monthName = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const steps = ['Horario', 'Datos', 'Listo']

  return (
    <div className="px-9 py-8 overflow-y-auto scrollbar-hide">
      <div className="flex items-start justify-between mb-[22px] gap-6">
        <div>
          <div
            className="text-[10px] text-text-hint uppercase tracking-[0.14em] mb-1"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Agenda pública · <span className="capitalize">{monthName}</span>
          </div>
          <h2
            className="text-[32px] font-medium leading-[1.05] tracking-[-0.025em] m-0 text-text"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Elegí el día que <span className="italic">te queda mejor</span>
          </h2>
        </div>
        <div
          className="flex items-center gap-2 pt-1 shrink-0"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {steps.map((s, i) => {
            const active = i === stepIndex
            const done = i < stepIndex
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-[17px] h-[17px] rounded-full grid place-items-center text-[9px] border ${
                    active
                      ? 'bg-text text-surface border-text'
                      : done
                        ? 'bg-primary-light text-primary border-primary-mid'
                        : 'bg-surface text-text-hint border-text-dim'
                  }`}
                >
                  {i + 1}
                </div>
                <div
                  className={`text-[10px] uppercase tracking-[0.14em] ${
                    active ? 'text-text' : 'text-text-dim'
                  }`}
                >
                  {s}
                </div>
                {i < steps.length - 1 && <div className="w-6 h-px bg-gray-border" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-[7px] mb-[9px]">
        {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d) => (
          <div
            key={d}
            className="text-[10px] text-text-hint uppercase tracking-[0.14em] pl-[2px]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid gap-[7px]">
        {grid.map((row, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-[7px]">
            {row.map((cell) => {
              const day = cell.day
              const available = !!day
              const selected = selectedDay === cell.iso
              const belongsToManual =
                !manualLocationId || (day && day.locationId === manualLocationId)
              const dimmed = available && !belongsToManual
              const pinColor = day?.locationId ? locationsById.get(day.locationId)?.color : null

              return (
                <button
                  key={cell.iso}
                  disabled={!available || dimmed}
                  onClick={() => available && belongsToManual && onSelectDay(cell.iso)}
                  className={`aspect-square p-[10px] rounded-[10px] border text-left flex flex-col justify-between transition-opacity ${
                    selected
                      ? 'bg-primary border-primary text-surface'
                      : available
                        ? 'bg-surface border-gray-border text-text hover:border-gray-border-2 cursor-pointer'
                        : 'bg-transparent border-transparent text-text-dim cursor-not-allowed'
                  } ${dimmed ? 'opacity-30 pointer-events-none' : ''}`}
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="text-[22px] font-medium leading-none tracking-[-0.015em]"
                    >
                      {cell.num}
                    </div>
                    {cell.isToday && (
                      <div
                        className="text-[8px] uppercase tracking-[0.14em] opacity-70"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Hoy
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-[4px]">
                    <div
                      className={`text-[10px] ${selected ? 'opacity-70' : available ? 'opacity-55' : 'opacity-40'}`}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {available ? `${day.slots.length} libres` : '—'}
                    </div>
                    {pinColor && (
                      <div className="flex gap-[3px]">
                        <span
                          className="w-[5px] h-[5px] rounded-full"
                          style={{ backgroundColor: selected ? '#F5F2EC' : pinColor }}
                          aria-hidden
                        />
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Right rail — office selector on top, slots below
// ────────────────────────────────────────────────────────────────

function RightRail({
  locations,
  locationsById,
  manualLocationId,
  effectiveLocationId,
  onOfficeClick,
  currentDay,
  selectedTime,
  onPickSlot,
  onConfirm,
}: {
  locations: PublicLocation[]
  locationsById: Map<string, { loc: PublicLocation; color: string; index: number }>
  manualLocationId: string | null
  effectiveLocationId: string | null
  onOfficeClick: (id: string) => void
  currentDay: DaySlotsGrouped | null
  selectedTime: string | null
  onPickSlot: (t: string) => void
  onConfirm: () => void
}) {
  const hint = manualLocationId
    ? 'filtrando el calendario'
    : effectiveLocationId
      ? 'seleccionado por la fecha'
      : 'se selecciona al elegir fecha'

  return (
    <aside className="bg-surface border-l border-gray-border flex flex-col min-h-0">
      {/* Top: office selector (no scroll) */}
      <div className="px-[26px] pt-[28px] shrink-0">
        <div
          className="flex justify-between items-baseline mb-[10px]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <span className="text-[10px] text-text-hint uppercase tracking-[0.14em]">
            Consultorio
          </span>
          <span
            className="text-[10px] text-text-hint italic"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {hint}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {locations.map((loc) => {
            const meta = locationsById.get(loc.id)!
            const isEffective = effectiveLocationId === loc.id
            const isManual = manualLocationId === loc.id

            return (
              <button
                key={loc.id}
                onClick={() => onOfficeClick(loc.id)}
                aria-pressed={isManual}
                className={`text-left flex items-start gap-2.5 px-3 py-[11px] rounded-[10px] cursor-pointer transition-colors border ${
                  isEffective
                    ? 'bg-primary-light border-primary'
                    : 'bg-surface-2 border-gray-border hover:border-gray-border-2'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-[3px]"
                  style={{ backgroundColor: meta.color }}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <div className="text-[13px] font-medium text-text">{loc.name}</div>
                    {isManual && (
                      <span
                        className="text-[9px] uppercase tracking-[0.1em] text-primary bg-surface border border-primary rounded-full px-[7px] py-[2px]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Filtrando
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-hint mt-0.5 leading-[1.4]">
                    {loc.address}
                    {loc.city && `, ${loc.city}`}
                    {loc.work_days && loc.work_days.length > 0 && ` · ${workDaysLabel(loc.work_days)}`}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <div className="h-px bg-gray-border mt-5" />
      </div>

      {/* Middle: scrollable empty state or horarios */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-[26px] py-5">
        {!currentDay ? (
          <EmptyDayState />
        ) : (
          <DaySlotsPanel
            currentDay={currentDay}
            selectedTime={selectedTime}
            onPickSlot={onPickSlot}
          />
        )}
      </div>

      {/* Bottom: confirm button — always visible */}
      <div className="px-[26px] pb-[26px] pt-4 border-t border-gray-border shrink-0 bg-surface">
        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedTime}
          className="w-full py-[13px] rounded-[10px] text-[14px] font-medium cursor-pointer bg-primary text-surface hover:bg-[#2F3C2D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {selectedTime ? (
            <>
              <span>Continuar con</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {selectedTime}
              </span>
              <span>→</span>
            </>
          ) : !currentDay ? (
            'Elegí un día'
          ) : (
            'Elegí un horario'
          )}
        </button>
      </div>
    </aside>
  )
}

function EmptyDayState() {
  return (
    <div
      className="p-6 rounded-[10px] bg-surface-2 text-center"
      style={{ border: '1px dashed var(--color-gray-border-2, #D9D4CA)' }}
    >
      <div
        className="text-[15px] italic text-text-muted"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        Elegí un día
      </div>
      <div className="text-[12px] text-text-hint mt-1 leading-[1.55]">
        Al tocar una fecha en el calendario, acá te mostramos los horarios disponibles y el consultorio correspondiente.
      </div>
    </div>
  )
}

function DaySlotsPanel({
  currentDay,
  selectedTime,
  onPickSlot,
}: {
  currentDay: DaySlotsGrouped
  selectedTime: string | null
  onPickSlot: (t: string) => void
}) {
  const d = new Date(currentDay.date + 'T12:00:00')
  const dayNamesShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const monthsShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const dow = dayNamesShort[d.getDay()]
  const short = `${d.getDate()} ${monthsShort[d.getMonth()]}`
  const todayISO = toISO(new Date())
  const isToday = currentDay.date === todayISO
  const railLabel = isToday ? 'Horarios del hoy' : `Horarios del ${dow.toLowerCase()}`

  return (
    <div>
      <div
        className="text-[10px] text-text-hint uppercase tracking-[0.14em] mb-1"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {railLabel}
      </div>
      <div
        className="text-[26px] font-medium leading-[1.1] tracking-[-0.02em] text-text"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        <span className="italic">{dow}</span> {short}
      </div>

      <div className="grid grid-cols-3 gap-[6px] mt-4">
        {currentDay.slots.map((time) => {
          const active = selectedTime === time
          return (
            <button
              key={time}
              onClick={() => onPickSlot(time)}
              className={`py-[11px] text-center rounded-[8px] text-[13px] font-medium border transition-colors cursor-pointer ${
                active
                  ? 'bg-primary text-surface border-primary'
                  : 'bg-surface-2 border-gray-border text-text hover:border-primary'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {time}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AccordionSlotBlocks({
  slots,
  selectedTime,
  onPick,
}: {
  slots: string[]
  selectedTime: string | null
  onPick: (s: string) => void
}) {
  const morning = slots.filter((s) => parseInt(s.split(':')[0], 10) < 13)
  const afternoon = slots.filter((s) => parseInt(s.split(':')[0], 10) >= 13)
  return (
    <div className="pt-3">
      {morning.length > 0 && (
        <MobileSlotBlock title="Mañana" slots={morning} selectedTime={selectedTime} onPick={onPick} />
      )}
      {afternoon.length > 0 && (
        <MobileSlotBlock title="Tarde" slots={afternoon} selectedTime={selectedTime} onPick={onPick} last />
      )}
    </div>
  )
}

function MobileSlotBlock({
  title,
  slots,
  selectedTime,
  onPick,
  last,
}: {
  title: string
  slots: string[]
  selectedTime: string | null
  onPick: (s: string) => void
  last?: boolean
}) {
  return (
    <div className={last ? '' : 'mb-3'}>
      <div
        className="text-[9px] text-text-hint uppercase tracking-[0.12em] mb-2"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {title}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {slots.map((time) => {
          const active = selectedTime === time
          return (
            <button
              key={time}
              onClick={() => onPick(time)}
              className={`px-1 py-2.5 rounded-[8px] text-[12.5px] font-medium border transition-colors cursor-pointer ${
                active
                  ? 'bg-primary text-surface border-primary'
                  : 'bg-surface-2 border-gray-border text-text hover:bg-primary hover:text-surface hover:border-primary'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {time}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
