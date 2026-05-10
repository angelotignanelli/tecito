import { useState } from 'react'
import Icon from '../Icon'
import Btn from '../Btn'

interface Props {
  open: boolean
  onClose: () => void
  currentPatientCount: number
  patientLimit: number | null   // null = unlimited
  onImport: (rows: ImportRow[]) => Promise<{ imported: number; errors: string[] }>
}

export interface ImportRow {
  name: string
  phone: string
  email: string
  insurance: string
  age: string
}

type Stage = 'upload' | 'preview' | 'importing' | 'done'

/**
 * Parse a CSV string into rows. Supports quoted fields with commas.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { field += ch }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else { field += ch }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

/**
 * Try to auto-detect column indices based on common header names.
 * Falls back to positional: 0=name, 1=phone, 2=email, 3=insurance, 4=age.
 */
function detectColumns(headers: string[]): { name: number; phone: number; email: number; insurance: number; age: number } {
  const norm = headers.map((h) => h.toLowerCase().trim())
  const find = (needles: string[], fallback: number) => {
    for (let i = 0; i < norm.length; i++) {
      if (needles.some((n) => norm[i].includes(n))) return i
    }
    return fallback
  }
  return {
    name: find(['nombre', 'name', 'apellido'], 0),
    phone: find(['tel', 'phone', 'celular', 'whatsapp'], 1),
    email: find(['email', 'mail', 'correo'], 2),
    insurance: find(['obra', 'cobertura', 'insurance', 'prepaga'], 3),
    age: find(['edad', 'age'], 4),
  }
}

export default function ImportPatientsModal({ open, onClose, currentPatientCount, patientLimit, onImport }: Props) {
  const [stage, setStage] = useState<Stage>('upload')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const slotsLeft = patientLimit === null ? Infinity : Math.max(0, patientLimit - currentPatientCount)
  const wouldExceed = patientLimit !== null && rows.length > slotsLeft

  const handleFile = async (file: File) => {
    setParseError(null)
    setFileName(file.name)
    try {
      const text = await file.text()
      const parsed = parseCSV(text).filter((r) => r.some((cell) => cell.trim().length > 0))
      if (parsed.length === 0) {
        setParseError('El archivo está vacío.')
        return
      }
      // Treat first row as header if it has at least one non-numeric cell
      const [maybeHeader, ...restFromHeader] = parsed
      const headerLooksLikeHeader = maybeHeader.some((c) => /[a-záéíóúñ]/i.test(c) && !/^\d/.test(c))
      const headers = headerLooksLikeHeader ? maybeHeader : ['Nombre', 'Teléfono', 'Email', 'Obra social', 'Edad']
      const dataRows = headerLooksLikeHeader ? restFromHeader : parsed
      const cols = detectColumns(headers)

      const mapped: ImportRow[] = dataRows
        .map((r) => ({
          name: (r[cols.name] || '').trim(),
          phone: (r[cols.phone] || '').trim(),
          email: (r[cols.email] || '').trim(),
          insurance: (r[cols.insurance] || 'Particular').trim() || 'Particular',
          age: (r[cols.age] || '').trim(),
        }))
        .filter((r) => r.name.length >= 2)

      if (mapped.length === 0) {
        setParseError('No encontré pacientes válidos. La primera columna debe ser el nombre.')
        return
      }

      setRows(mapped)
      setStage('preview')
    } catch (e) {
      setParseError('No pude leer el archivo. Asegurate que sea un CSV válido.')
    }
  }

  const handleImport = async () => {
    setStage('importing')
    const out = await onImport(rows)
    setResult(out)
    setStage('done')
  }

  const handleClose = () => {
    setStage('upload')
    setRows([])
    setFileName('')
    setResult(null)
    setParseError(null)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-black/40"
      onClick={handleClose}
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <div
        className="bg-surface sm:rounded-[16px] sm:border sm:border-gray-border sm:shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-full sm:max-w-[560px] h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-border flex items-start justify-between shrink-0 gap-4">
          <div className="min-w-0">
            <h2
              className="text-[24px] leading-none tracking-[-0.02em] text-text m-0"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              Importar pacientes.
            </h2>
            <div className="text-[12px] text-text-muted mt-2 leading-[1.5]">
              Subí un archivo CSV con tus pacientes existentes. Una fila por paciente.
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-surface-2 grid place-items-center cursor-pointer text-text-hint shrink-0"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-hide">
          {stage === 'upload' && (
            <>
              <label
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-border-2 rounded-[14px] p-10 text-center cursor-pointer hover:border-primary-mid hover:bg-surface-2 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary-light text-primary grid place-items-center">
                  <Icon name="doc" size={20} />
                </div>
                <div className="text-[14px] font-medium text-text">Elegí tu archivo CSV</div>
                <div className="text-[12px] text-text-hint leading-[1.55] max-w-[360px]">
                  En Excel guardalo como{' '}
                  <strong className="text-text">Archivo → Guardar como → .csv</strong>
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </label>

              {parseError && (
                <div className="mt-4 text-[12px] text-coral bg-coral-light rounded-[8px] px-3 py-2">
                  {parseError}
                </div>
              )}

              <div className="mt-5 bg-surface-2 border border-gray-border rounded-[10px] p-4">
                <div
                  className="text-[10px] text-text-hint uppercase tracking-[0.12em] mb-2"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Formato esperado
                </div>
                <div
                  className="text-[11px] text-text-muted leading-[1.6]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Nombre, Teléfono, Email, Obra social, Edad
                  <br />
                  María García, 1155667788, maria@…, OSDE, 34
                  <br />
                  Lucas Fernández, 1144332211, lucas@…, Swiss, 28
                </div>
                <div className="text-[11px] text-text-hint mt-2 leading-[1.5]">
                  Detectamos las columnas por el nombre del encabezado. Los nombres son lo único obligatorio.
                </div>
              </div>
            </>
          )}

          {stage === 'preview' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[12px] text-text-muted">
                  <span className="text-text font-medium">{rows.length}</span> paciente{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''} en <span className="text-text-hint">{fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStage('upload')}
                  className="text-[11px] text-primary cursor-pointer hover:underline"
                >
                  Cambiar archivo
                </button>
              </div>

              {wouldExceed && (
                <div className="mb-4 bg-coral-light border border-coral/20 rounded-[10px] px-3.5 py-3">
                  <div className="text-[12px] font-medium text-coral">Excede tu plan.</div>
                  <div className="text-[11px] text-coral opacity-90 mt-1 leading-[1.55]">
                    Tu plan permite {patientLimit} pacientes y ya tenés {currentPatientCount}. Solo se importarán los primeros {slotsLeft} del archivo, el resto quedará afuera. Pasate a Pro para importar todos.
                  </div>
                </div>
              )}

              <div className="border border-gray-border rounded-[10px] overflow-hidden bg-surface">
                <div
                  className="grid grid-cols-[1.5fr_1fr_1fr] bg-surface-2 border-b border-gray-border px-3 py-2 text-[10px] text-text-hint uppercase tracking-[0.12em]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  <div>Nombre</div>
                  <div>Teléfono</div>
                  <div>Obra social</div>
                </div>
                <div className="max-h-[240px] overflow-y-auto scrollbar-hide">
                  {rows.slice(0, 100).map((r, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-[1.5fr_1fr_1fr] px-3 py-2 text-[12px] text-text ${
                        patientLimit !== null && i >= slotsLeft ? 'opacity-40' : ''
                      } ${i < rows.slice(0, 100).length - 1 ? 'border-b border-gray-border' : ''}`}
                    >
                      <div className="truncate">{r.name}</div>
                      <div className="text-text-muted truncate">{r.phone || '—'}</div>
                      <div className="text-text-muted truncate">{r.insurance || 'Particular'}</div>
                    </div>
                  ))}
                </div>
                {rows.length > 100 && (
                  <div className="px-3 py-2 text-[11px] text-text-hint text-center bg-surface-2">
                    … y {rows.length - 100} más
                  </div>
                )}
              </div>
            </>
          )}

          {stage === 'importing' && (
            <div className="text-center py-12">
              <div className="text-[13px] text-text-muted">Importando pacientes…</div>
            </div>
          )}

          {stage === 'done' && result && (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-teal text-surface grid place-items-center">
                <Icon name="check" size={22} stroke={2.2} />
              </div>
              <div
                className="text-[24px] font-normal text-text leading-[1.15] tracking-[-0.015em]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {result.imported} paciente{result.imported !== 1 ? 's' : ''} importado{result.imported !== 1 ? 's' : ''}.
              </div>
              {result.errors.length > 0 && (
                <div className="mt-4 text-[12px] text-coral bg-coral-light rounded-[10px] px-4 py-3 text-left">
                  <div className="font-medium mb-1">{result.errors.length} error{result.errors.length !== 1 ? 'es' : ''}:</div>
                  <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                    {result.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {result.errors.length > 5 && <li>… y {result.errors.length - 5} más.</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-border flex justify-end gap-2 shrink-0">
          {stage === 'upload' && (
            <Btn onClick={handleClose}>Cancelar</Btn>
          )}
          {stage === 'preview' && (
            <>
              <Btn onClick={handleClose}>Cancelar</Btn>
              <Btn variant="primary" onClick={handleImport}>
                <Icon name="check" size={13} /> Importar {wouldExceed ? `primeros ${slotsLeft}` : `${rows.length} pacientes`}
              </Btn>
            </>
          )}
          {stage === 'done' && (
            <Btn variant="primary" onClick={handleClose}>Listo</Btn>
          )}
        </div>
      </div>
    </div>
  )
}
