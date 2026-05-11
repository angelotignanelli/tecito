import { useState } from 'react'
import type { Patient } from '../../data/appointments'
import PageHeader from '../PageHeader'
import Icon from '../Icon'
import Btn from '../Btn'
import ImportPatientsModal, { type ImportRow } from './ImportPatientsModal'
import AddPatientModal from './AddPatientModal'

interface PatientWithId extends Patient {
  id?: string
}

interface Props {
  patients: Patient[]
  patientRows?: { id: string; name: string }[]   // for mapping name → id when removing
  onSelectPatient: (patient: Patient) => void
  selectedPatient: Patient | null
  onRemovePatient?: (id: string) => Promise<unknown>
  onImportPatients?: (rows: ImportRow[]) => Promise<{ imported: number; errors: string[] }>
  /** Persists a single patient. Hooked from App.tsx so the same plan-limit
   * + Supabase logic that the import flow uses applies here too. */
  onAddPatient?: (p: Patient) => Promise<Error | null>
  patientLimit?: number | null   // null = unlimited
}

export default function PatientsView({ patients, patientRows, onSelectPatient, selectedPatient, onRemovePatient, onImportPatients, onAddPatient, patientLimit }: Props) {
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleDeleteClick = (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation()
    if (!patientRows) return
    // Find the FIRST matching id (works even if there are duplicates since the list iteration order is stable)
    const match = patientRows.find((r) => r.name === patient.name)
    if (!match) return
    setConfirmDelete({ id: match.id, name: patient.name })
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete || !onRemovePatient) return
    setDeleting(true)
    await onRemovePatient(confirmDelete.id)
    setDeleting(false)
    setConfirmDelete(null)
  }

  return (
    <div className="bg-bg lg:flex-1 lg:flex lg:flex-col lg:h-full lg:overflow-hidden">
      <div className="px-4 sm:px-10 pt-6 sm:pt-8 pb-28 lg:pb-10 lg:overflow-y-auto lg:flex-1 lg:scrollbar-hide">
        <PageHeader
          title="Pacientes."
          subtitle={
            patientLimit != null
              ? `${patients.length} / ${patientLimit} pacientes registrados.`
              : `${patients.length} pacientes registrados en tu práctica.`
          }
          right={
            <>
              {/* Desktop-only header CTAs. On mobile they re-surface
                  below as a full-width primary + a subtle "importar"
                  text link, following the same pattern as Mi link /
                  Bloqueos / PlanCard. */}
              {onImportPatients && (
                <span className="hidden sm:flex">
                  <Btn onClick={() => setShowImport(true)}>
                    <Icon name="doc" size={13} /> Importar
                  </Btn>
                </span>
              )}
              {onAddPatient && (
                <span className="hidden sm:flex">
                  <Btn variant="primary" onClick={() => setShowAdd(true)}>
                    <Icon name="plus" size={13} /> Nuevo paciente
                  </Btn>
                </span>
              )}
            </>
          }
        />

        {/* Mobile-only primary action block. "Nuevo paciente" is the
            frequent action so it gets the full-width sage CTA; "Importar"
            is mostly an onboarding step, so it lives as a small text
            link underneath where it's discoverable without dominating. */}
        <div className="sm:hidden mb-4">
          {onAddPatient && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] text-[14px] font-medium bg-primary text-surface hover:bg-[#2F3C2D] cursor-pointer transition-colors"
            >
              <Icon name="plus" size={14} /> Nuevo paciente
            </button>
          )}
          {onImportPatients && (
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="mt-2 w-full text-center text-[12px] text-text-muted underline underline-offset-2 cursor-pointer bg-transparent"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              o importá pacientes desde un CSV
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Icon
            name="search"
            size={14}
            style={{ position: 'absolute', left: 14, top: 13, color: 'var(--color-text-hint)' }}
          />
          <input
            type="text"
            placeholder="Buscar paciente por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-[14px] border border-gray-border bg-surface text-[13px] text-text placeholder:text-text-hint focus:border-primary-mid"
          />
        </div>

        {search && (
          <div className="text-[10px] text-text-hint mb-3 uppercase tracking-[0.12em]" style={{ fontFamily: 'var(--font-mono)' }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Patient cards — keep index in the key to support duplicate names */}
        <div className="flex flex-col gap-2">
          {filtered.map((patient, i) => {
            const isSelected = selectedPatient?.name === patient.name
            const row = patientRows?.find((r) => r.name === patient.name)
            return (
              <div
                key={`${patient.name}-${i}`}
                onClick={() => onSelectPatient(patient)}
                className={`group border rounded-[14px] px-[18px] py-[14px] cursor-pointer transition-colors flex items-center gap-3.5 ${
                  isSelected
                    ? 'border-primary-mid bg-primary-light'
                    : 'border-gray-border bg-surface hover:border-gray-border-2'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full bg-primary-light grid place-items-center text-[14px] text-primary shrink-0"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {patient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-text">{patient.name}</div>
                  <div className="text-[12px] text-text-muted mt-[3px] flex items-center gap-2">
                    <span className={`inline-block text-[11px] font-medium px-[9px] py-[2px] rounded-full ${
                      patient.insurance === 'Particular'
                        ? 'bg-amber-light text-amber'
                        : 'bg-teal-light text-teal'
                    }`}>
                      {patient.insurance}
                    </span>
                    <span>{patient.age}</span>
                  </div>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <div className="text-[12px] text-text-muted">Últ. visita {patient.lastVisit || '—'}</div>
                  <div className="text-[11px] text-text-hint mt-[2px]" style={{ fontFamily: 'var(--font-mono)' }}>
                    {patient.totalSessions} sesiones
                  </div>
                </div>

                {onRemovePatient && row && (
                  <button
                    onClick={(e) => handleDeleteClick(e, patient)}
                    className="ml-1 w-8 h-8 rounded-full grid place-items-center text-text-hint hover:text-coral hover:bg-coral-light cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                    title="Eliminar paciente"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="text-text-hint text-sm">No se encontraron pacientes</div>
            <div className="text-text-hint text-xs mt-1">Probá con otro nombre</div>
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="bg-surface rounded-[14px] border border-gray-border shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full max-w-[420px] p-6" onClick={(e) => e.stopPropagation()}>
            <h3
              className="text-[20px] leading-none tracking-[-0.015em] text-text m-0 mb-2"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Eliminar paciente.
            </h3>
            <p className="text-[13px] text-text-muted mb-5 leading-[1.5]">
              Vas a eliminar a <strong className="text-text">{confirmDelete.name}</strong> de tu lista.
              Sus turnos asignados pueden perder la referencia al paciente.
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancelar</Btn>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-[7px] text-[12px] font-medium cursor-pointer bg-coral text-surface hover:bg-[#8A3E27] disabled:opacity-60 transition-colors"
              >
                {deleting ? 'Eliminando…' : 'Eliminar paciente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV modal */}
      {onImportPatients && (
        <ImportPatientsModal
          open={showImport}
          onClose={() => setShowImport(false)}
          currentPatientCount={patients.length}
          patientLimit={patientLimit ?? null}
          onImport={onImportPatients}
        />
      )}

      {/* Add patient modal */}
      {showAdd && onAddPatient && (
        <AddPatientModal
          onClose={() => setShowAdd(false)}
          onAdd={onAddPatient}
        />
      )}
    </div>
  )
}
