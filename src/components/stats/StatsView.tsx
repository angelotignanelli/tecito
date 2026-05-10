import { useMemo, useState } from 'react'
import type { Appointment, Patient } from '../../data/appointments'
import PageHeader from '../PageHeader'
import Icon from '../Icon'
import Btn from '../Btn'

interface Props {
  appointments: Appointment[]
  patients: Patient[]
}

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Sunday-based week of `ref`: returns [monday... sunday] as ISO strings */
function getWeekDates(ref: Date): string[] {
  const dow = ref.getDay() // 0=Sun
  const sunday = new Date(ref)
  sunday.setDate(ref.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return toISO(d)
  })
}

export default function StatsView({ appointments, patients }: Props) {
  const [monthOffset, setMonthOffset] = useState(0) // 0 = current month, -1 = last month, etc

  const { monthLabel, monthPrefix, thisWeek, nextWeek, isCurrentMonth } = useMemo(() => {
    const now = new Date()
    const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    const monthPrefix = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = `${MONTHS_ES[monthDate.getMonth()]} ${monthDate.getFullYear()}`

    const thisWeek = getWeekDates(now)
    const nextWeek = getWeekDates(new Date(now.getTime() + 7 * 86400000))

    return {
      monthLabel,
      monthPrefix,
      thisWeek,
      nextWeek,
      isCurrentMonth: monthOffset === 0,
    }
  }, [monthOffset])

  // ============ DERIVED STATS ============

  const todayISO = toISO(new Date())

  // Real sessions = past appointments with an actual patient
  const realSessions = appointments.filter(
    (a) => a.status !== 'libre' && a.status !== 'bloqueado' && a.date < todayISO,
  )

  // Per-patient session count from real data
  const sessionsPerPatient: Record<string, number> = {}
  for (const a of realSessions) {
    if (a.patientName) {
      sessionsPerPatient[a.patientName] = (sessionsPerPatient[a.patientName] ?? 0) + 1
    }
  }

  // This month
  const thisMonthAll = appointments.filter((a) => a.date.startsWith(monthPrefix))
  const thisMonthAppts = thisMonthAll.filter((a) => a.status !== 'libre' && a.status !== 'bloqueado')
  const thisMonthTotal = thisMonthAppts.length
  const thisMonthConfirmed = thisMonthAppts.filter((a) => a.status === 'confirmado').length
  const thisMonthSlots = thisMonthAll.length
  const thisMonthOccupancy = thisMonthSlots > 0 ? Math.round((thisMonthAppts.length / thisMonthSlots) * 100) : 0

  // This week (rolling, based on today)
  const thisWeekAppts = appointments.filter((a) => thisWeek.includes(a.date) && a.status !== 'libre' && a.status !== 'bloqueado')
  const thisWeekConfirmed = thisWeekAppts.filter((a) => a.status === 'confirmado').length
  const thisWeekCancelled = thisWeekAppts.filter((a) => a.status === 'cancelado').length
  const thisWeekPending = thisWeekAppts.filter((a) => a.status === 'pendiente').length
  const thisWeekTotal = thisWeekAppts.length

  // Next week
  const nextWeekAppts = appointments.filter((a) => nextWeek.includes(a.date) && a.status !== 'libre' && a.status !== 'bloqueado')
  const nextWeekTotal = nextWeekAppts.length

  // Cancel rate — relative to appointments that already happened + cancelled
  const allWithPatient = appointments.filter((a) => a.status !== 'libre' && a.status !== 'bloqueado' && a.date <= todayISO)
  const allCancelled = allWithPatient.filter((a) => a.status === 'cancelado').length
  const cancelRate = allWithPatient.length > 0 ? Math.round((allCancelled / allWithPatient.length) * 100) : 0

  // Insurance breakdown — from registered patients
  const insuranceCounts: Record<string, number> = {}
  for (const p of patients) {
    insuranceCounts[p.insurance] = (insuranceCounts[p.insurance] ?? 0) + 1
  }
  const insuranceSorted = Object.entries(insuranceCounts).sort((a, b) => b[1] - a[1])

  // Frequency breakdown — from patient tags
  const frequencyCounts: Record<string, number> = {}
  for (const p of patients) {
    for (const tag of p.tags) {
      if (['Semanal', 'Quincenal', 'Mensual'].includes(tag)) {
        frequencyCounts[tag] = (frequencyCounts[tag] ?? 0) + 1
      }
    }
  }

  // Top patients — computed from real appointments
  const topPatients = Object.entries(sessionsPerPatient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      since: patients.find((p) => p.name === name)?.since ?? '',
    }))

  // Appointments by day of week — all-time
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const apptsByDay = [0, 0, 0, 0, 0, 0, 0]
  for (const a of appointments) {
    if (a.status !== 'libre' && a.status !== 'bloqueado') {
      const d = new Date(a.date + 'T12:00:00')
      apptsByDay[d.getDay()]++
    }
  }
  const maxDayCount = Math.max(...apptsByDay, 1)

  // Motive/pathology tags (excluding frequency + first-visit)
  const tagCounts: Record<string, number> = {}
  for (const p of patients) {
    for (const tag of p.tags) {
      if (!['Semanal', 'Quincenal', 'Mensual', 'Primera vez'].includes(tag)) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
      }
    }
  }
  const tagsSorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])

  // Total sessions across history
  const totalSessionsFromAppts = realSessions.length
  const totalPatients = patients.length
  const avgSessionsPerPatient = totalPatients > 0 ? Math.round(totalSessionsFromAppts / totalPatients) : 0

  const hasData = appointments.length > 0 || patients.length > 0

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      <div className="px-4 sm:px-10 pt-6 sm:pt-8 pb-10 overflow-y-auto flex-1 pb-20 lg:pb-10 scrollbar-hide">
        <PageHeader
          title="Estadísticas."
          subtitle="Resumen de tu práctica profesional."
          right={
            <div className="inline-flex items-center bg-surface border border-gray-border-2 rounded-[8px] overflow-hidden">
              <button
                onClick={() => setMonthOffset((o) => o - 1)}
                className="px-3 py-[7px] text-[12px] text-text-muted hover:bg-surface-2 cursor-pointer border-r border-gray-border-2"
                aria-label="Mes anterior"
              >
                ‹
              </button>
              <div
                className="px-4 py-[7px] text-[12px] font-medium text-text capitalize flex items-center gap-2"
                style={{ minWidth: 140, justifyContent: 'center' }}
              >
                <Icon name="cal2" size={12} /> {monthLabel}
              </div>
              <button
                onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
                disabled={isCurrentMonth}
                className="px-3 py-[7px] text-[12px] text-text-muted hover:bg-surface-2 cursor-pointer border-l border-gray-border-2 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Mes siguiente"
              >
                ›
              </button>
            </div>
          }
        />

        {!hasData ? (
          <div className="bg-surface border border-gray-border rounded-[14px] p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-surface-2 border border-gray-border grid place-items-center text-text-hint">
              <Icon name="chart" size={20} />
            </div>
            <div className="text-[15px] text-text">Todavía no hay datos.</div>
            <div className="text-[12px] text-text-hint mt-1.5 leading-[1.55]">
              A medida que agendes turnos y registres pacientes, vas a ver tu actividad acá.
            </div>
          </div>
        ) : (
          <>
            {/* Top KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <KpiCard
                label="Ocupación del mes"
                value={`${thisMonthOccupancy}%`}
                accent={thisMonthOccupancy >= 70 ? 'teal' : undefined}
                sub={thisMonthSlots > 0 ? `${thisMonthAppts.length} turnos de ${thisMonthSlots} slots` : 'Sin slots configurados'}
              />
              <KpiCard
                label="Turnos del mes"
                value={String(thisMonthTotal)}
                sub={thisMonthTotal > 0 ? `${thisMonthConfirmed} confirmados` : 'Sin turnos este mes'}
              />
              <KpiCard
                label="Sesiones realizadas"
                value={String(totalSessionsFromAppts)}
                sub={totalPatients > 0 ? `${avgSessionsPerPatient} promedio por paciente` : 'Sin pacientes registrados'}
              />
              <KpiCard
                label="Tasa de cancelación"
                value={allWithPatient.length > 0 ? `${cancelRate}%` : '—'}
                accent={allWithPatient.length > 0 ? (cancelRate > 15 ? 'coral' : 'teal') : undefined}
                sub={
                  allWithPatient.length === 0
                    ? 'Sin datos aún'
                    : cancelRate <= 15
                      ? 'Dentro del rango normal'
                      : 'Por encima del promedio'
                }
              />
            </div>

            {/* Week summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="bg-surface border border-gray-border rounded-[14px] p-5">
                <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  Esta semana
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MiniStat label="Turnos" value={thisWeekTotal} />
                  <MiniStat label="Confirmados" value={thisWeekConfirmed} color="text-teal" />
                  <MiniStat label="Cancelados" value={thisWeekCancelled} color="text-coral" />
                </div>
                {thisWeekPending > 0 && (
                  <div className="flex items-center gap-2 bg-amber-light rounded-[8px] px-3 py-2">
                    <Icon name="bell" size={12} style={{ color: 'var(--color-amber)' }} />
                    <span className="text-xs text-amber">
                      {thisWeekPending} turno{thisWeekPending !== 1 ? 's' : ''} pendiente{thisWeekPending !== 1 ? 's' : ''} de confirmar
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-surface border border-gray-border rounded-[14px] p-5">
                <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  Próxima semana
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MiniStat label="Turnos" value={nextWeekTotal} />
                  <MiniStat label="Pendientes" value={nextWeekAppts.filter((a) => a.status === 'pendiente').length} color="text-amber" />
                  <MiniStat label="Confirmados" value={nextWeekAppts.filter((a) => a.status === 'confirmado').length} color="text-teal" />
                </div>
                <div className="text-xs text-text-hint">
                  {nextWeekTotal > thisWeekTotal
                    ? `↑ ${nextWeekTotal - thisWeekTotal} turnos más que esta semana`
                    : nextWeekTotal < thisWeekTotal
                      ? `↓ ${thisWeekTotal - nextWeekTotal} turnos menos que esta semana`
                      : thisWeekTotal === 0
                        ? 'Sin turnos aún'
                        : 'Misma carga que esta semana'}
                </div>
              </div>
            </div>

            {/* Day of week + Insurance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="bg-surface border border-gray-border rounded-[14px] p-5">
                <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  Turnos por día (histórico)
                </div>
                <div className="flex flex-col gap-2">
                  {dayNames.map((name, i) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-xs text-text-muted w-8" style={{ fontFamily: 'var(--font-mono)' }}>{name}</span>
                      <div className="flex-1 h-[18px] bg-surface-2 rounded-full overflow-hidden border border-gray-border">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(apptsByDay[i] / maxDayCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-text w-8 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                        {apptsByDay[i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface border border-gray-border rounded-[14px] p-5">
                <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  Obras sociales
                </div>
                {insuranceSorted.length === 0 ? (
                  <div className="text-xs text-text-hint">Sin pacientes registrados.</div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {insuranceSorted.map(([name, count]) => (
                      <div key={name} className="flex items-center justify-between">
                        <span
                          className={`inline-block text-[11px] font-medium px-[9px] py-[2px] rounded-full ${
                            name === 'Particular' ? 'bg-amber-light text-amber' : 'bg-teal-light text-teal'
                          }`}
                        >
                          {name}
                        </span>
                        <div className="text-xs text-text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                          {count} paciente{count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {Object.keys(frequencyCounts).length > 0 && (
                  <div className="mt-5 pt-4 border-t border-gray-border">
                    <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                      Frecuencia de sesiones
                    </div>
                    <div className="flex gap-4">
                      {Object.entries(frequencyCounts).map(([freq, count]) => (
                        <div key={freq} className="text-center">
                          <div
                            className="text-[20px] leading-none tracking-[-0.015em] text-text"
                            style={{ fontFamily: 'var(--font-serif)' }}
                          >
                            {count}
                          </div>
                          <div className="text-[10px] text-text-hint mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
                            {freq}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Top patients + Motives */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-surface border border-gray-border rounded-[14px] p-5">
                <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  Pacientes con más sesiones
                </div>
                {topPatients.length === 0 ? (
                  <div className="text-xs text-text-hint">Sin historial aún.</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {topPatients.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3 py-2">
                        <div
                          className="w-6 h-6 rounded-full bg-primary-light grid place-items-center text-[10px] text-primary shrink-0"
                          style={{ fontFamily: 'var(--font-serif)' }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate text-text">{p.name}</div>
                          {p.since && (
                            <div className="text-[10px] text-text-hint" style={{ fontFamily: 'var(--font-mono)' }}>
                              {p.since}
                            </div>
                          )}
                        </div>
                        <div
                          className="text-[15px] text-primary tracking-[-0.01em]"
                          style={{ fontFamily: 'var(--font-serif)' }}
                        >
                          {p.count}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-surface border border-gray-border rounded-[14px] p-5">
                <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-4" style={{ fontFamily: 'var(--font-mono)' }}>
                  Motivos de consulta
                </div>
                {tagsSorted.length === 0 ? (
                  <div className="text-xs text-text-hint">Sin etiquetas cargadas en los pacientes.</div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {tagsSorted.map(([tag, count]) => (
                        <div key={tag} className="flex items-center gap-1.5 bg-primary-light rounded-full px-3 py-1.5">
                          <span className="text-xs font-medium text-primary">{tag}</span>
                          <span
                            className="text-[10px] text-primary/60 font-semibold"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-border">
                      <div className="text-xs text-text-hint">
                        Más frecuente: <span className="font-medium text-text">{tagsSorted[0][0]}</span> ({tagsSorted[0][1]} pacientes)
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent?: 'coral' | 'teal'; sub?: string }) {
  return (
    <div className="bg-surface border border-gray-border rounded-[14px] px-5 py-4">
      <div
        className="text-[10px] text-text-hint uppercase tracking-[0.12em]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </div>
      <div
        className={`text-[30px] leading-none tracking-[-0.025em] mt-2 ${accent === 'coral' ? 'text-coral' : accent === 'teal' ? 'text-teal' : 'text-text'}`}
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-text-muted mt-2">{sub}</div>}
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <div
        className={`text-[22px] leading-none tracking-[-0.015em] ${color ?? 'text-text'}`}
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {value}
      </div>
      <div className="text-[10px] text-text-hint uppercase tracking-[0.12em] mt-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
    </div>
  )
}
