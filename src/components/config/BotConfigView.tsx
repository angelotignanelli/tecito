import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useBotTemplates } from '../../lib/hooks'
import PageHeader from '../PageHeader'

interface TemplateConfig {
  key: string
  trigger: string
  triggerLabel: string
  defaultMessage: string
  category: 'turnos' | 'respuestas'
}

const templateConfigs: TemplateConfig[] = [
  {
    key: 'greeting',
    trigger: 'Cuando el paciente saluda',
    triggerLabel: 'Saludo / Bienvenida',
    defaultMessage: 'Hola {nombre}! Soy el asistente de *{doctor}*.\n\n¿En qué puedo ayudarte?\n\n1️⃣ Sacar turno\n2️⃣ Ver mi próximo turno\n3️⃣ Cancelar turno\n4️⃣ Hablar con {doctor_nombre}',
    category: 'respuestas',
  },
  {
    key: 'booking_location',
    trigger: 'Cuando el paciente pide turno (múltiples ubicaciones)',
    triggerLabel: 'Selección de ubicación',
    defaultMessage: '¿Dónde preferís atenderte?\n\n{ubicaciones}\n\nRespondé con el número de la ubicación.',
    category: 'turnos',
  },
  {
    key: 'booking_slots',
    trigger: 'Cuando se muestran horarios disponibles',
    triggerLabel: 'Horarios disponibles',
    defaultMessage: '📅 Horarios en *{ubicacion}* para el *{fecha}*:\n\n{horarios}\n\nRespondé con el número del horario.',
    category: 'turnos',
  },
  {
    key: 'booking_confirm',
    trigger: 'Cuando se agenda un turno',
    triggerLabel: 'Turno agendado',
    defaultMessage: '✅ Turno agendado!\n\n📅 *{fecha}*\n🕐 *{hora} hs*\n📍 *{ubicacion}*\n{direccion}\n\nRespondé *"confirmo"* para confirmar o *"cancelar"* si necesitás cancelar.',
    category: 'turnos',
  },
  {
    key: 'next_appointment',
    trigger: 'Cuando el paciente consulta su próximo turno',
    triggerLabel: 'Próximo turno',
    defaultMessage: 'Tu próximo turno:\n\n📅 *{fecha}*\n🕐 *{hora} hs*\n{ubicacion_linea}\n{estado_emoji} {estado}',
    category: 'turnos',
  },
  {
    key: 'cancel_confirm',
    trigger: 'Cuando el paciente cancela',
    triggerLabel: 'Cancelación confirmada',
    defaultMessage: '❌ Tu turno del *{fecha}* a las *{hora} hs* fue cancelado.\n\nSi querés reagendar, respondé *"turno"*.',
    category: 'turnos',
  },
  {
    key: 'patient_confirm',
    trigger: 'Cuando el paciente confirma un turno pendiente',
    triggerLabel: 'Confirmación del paciente',
    defaultMessage: '✅ Perfecto! Tu turno del *{fecha}* a las *{hora} hs* quedó confirmado.\n\n¡Te esperamos!',
    category: 'turnos',
  },
  {
    key: 'talk_to_doctor',
    trigger: 'Cuando pide hablar con el profesional',
    triggerLabel: 'Derivar a profesional',
    defaultMessage: '📩 Entendido. Le aviso a {doctor} y te va a contactar a la brevedad.\n\nSi es urgente, llamá al consultorio.',
    category: 'respuestas',
  },
  {
    key: 'unknown_patient',
    trigger: 'Número no registrado',
    triggerLabel: 'Paciente no encontrado',
    defaultMessage: 'Hola! Soy el asistente virtual de Tecito.\n\nNo encontré tu número registrado. Contactá al consultorio para que te agreguen como paciente.',
    category: 'respuestas',
  },
  {
    key: 'default_reply',
    trigger: 'Mensaje no reconocido',
    triggerLabel: 'Respuesta por defecto',
    defaultMessage: 'No entendí tu mensaje. Podés escribir:\n\n1️⃣ *turno* - para agendar\n2️⃣ *próximo* - para ver tu turno\n3️⃣ *cancelar* - para cancelar\n4️⃣ *hablar* - para contactar al profesional',
    category: 'respuestas',
  },
]

const categoryLabels: Record<string, string> = {
  turnos: 'Gestión de turnos',
  respuestas: 'Respuestas del bot',
}

const categoryIcons: Record<string, string> = {
  turnos: '📅',
  respuestas: '🤖',
}

export default function BotConfigView() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  const { templates: savedTemplates, loading, upsert } = useBotTemplates(userId)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  const getMessage = (key: string): string => {
    const custom = savedTemplates.find((t) => t.template_key === key)
    if (custom) return custom.message
    return templateConfigs.find((t) => t.key === key)?.defaultMessage || ''
  }

  const isEnabled = (key: string): boolean => {
    const custom = savedTemplates.find((t) => t.template_key === key)
    if (custom) return custom.enabled
    return true
  }

  const isCustomized = (key: string): boolean => {
    return savedTemplates.some((t) => t.template_key === key)
  }

  const handleEdit = (key: string) => {
    setEditingKey(key)
    setEditText(getMessage(key))
  }

  const handleSave = async (key: string) => {
    setSaving(true)
    await upsert(key, editText, isEnabled(key))
    setSaving(false)
    setEditingKey(null)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  const handleToggle = async (key: string) => {
    const newEnabled = !isEnabled(key)
    await upsert(key, getMessage(key), newEnabled)
  }

  const handleReset = async (key: string) => {
    const defaultMsg = templateConfigs.find((t) => t.key === key)?.defaultMessage || ''
    await upsert(key, defaultMsg, true)
    if (editingKey === key) {
      setEditText(defaultMsg)
    }
  }

  const categories = ['turnos', 'respuestas'] as const
  const [activeTab, setActiveTab] = useState<typeof categories[number]>('turnos')

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-bg">
      <div className="px-4 sm:px-10 pt-6 sm:pt-8 pb-10 overflow-y-auto flex-1 pb-20 lg:pb-10 scrollbar-hide">
        <PageHeader
          title={
            <>
              WhatsApp Bot.
              <span className="inline-block align-middle ml-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-teal text-surface uppercase tracking-wider" style={{ fontFamily: 'var(--font-sans)' }}>
                activo
              </span>
            </>
          }
          subtitle="Atención automática 24/7 cuando los pacientes escriben por WhatsApp. Personalizá las respuestas."
        />

        {/* Context: what the bot is (incoming) vs. reminders (outgoing) */}
        <div className="bg-primary-light border border-primary-mid rounded-[14px] p-4 mb-6 flex items-start gap-3">
          <div className="text-[16px]" style={{ fontFamily: 'var(--font-serif)' }}>📥</div>
          <div className="text-[12px] text-text-muted leading-[1.55]">
            <strong className="text-text">El bot responde cuando el paciente te escribe.</strong>{' '}
            Si querés enviar recordatorios salientes a tus pacientes,
            usá el botón <strong className="text-primary">Recordar a todos</strong> en la agenda — se abre WhatsApp desde tu número.
          </div>
        </div>

        {/* Tabs — serif italic underline style */}
        <div className="flex gap-6 border-b border-gray-border mb-6">
          {categories.map((cat) => {
            const active = activeTab === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`pb-2.5 pt-1 text-[15px] cursor-pointer transition-colors -mb-px border-b-2 ${
                  active
                    ? 'border-primary text-text italic'
                    : 'border-transparent text-text-hint hover:text-text'
                }`}
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {categoryLabels[cat]}
              </button>
            )
          })}
        </div>
        {/* Variables */}
        <div className="bg-white border border-gray-border rounded-[16px] p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🏷️</span>
            <div className="text-[13px] font-semibold">Variables dinámicas</div>
          </div>
          <div className="text-xs text-text-muted mb-2.5">Usá estas variables en tus mensajes. Se reemplazan automáticamente con los datos reales.</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: '{nombre}', desc: 'Nombre del paciente' },
              { v: '{doctor}', desc: 'Nombre completo del profesional' },
              { v: '{doctor_nombre}', desc: 'Primer nombre del profesional' },
              { v: '{fecha}', desc: 'Fecha del turno' },
              { v: '{hora}', desc: 'Hora del turno' },
              { v: '{ubicacion}', desc: 'Nombre del consultorio' },
              { v: '{direccion}', desc: 'Dirección del consultorio' },
            ].map((item) => (
              <span key={item.v} className="text-[11px] bg-primary-light px-2.5 py-1 rounded-md text-primary font-mono" title={item.desc}>{item.v}</span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-text-hint py-10 text-center">Cargando configuración...</div>
        ) : (
          <div>
            {(() => {
              const cat = activeTab
              const catTemplates = templateConfigs.filter((t) => t.category === cat)
              return (
                <div>
                  {/* Category description */}
                  <div className="text-xs text-text-muted mb-4">
                    {cat === 'turnos' && 'Mensajes que el bot envía durante el proceso de agendamiento, confirmación y cancelación de turnos.'}
                    {cat === 'recordatorios' && 'Notificaciones automáticas que se envían antes de cada turno para recordar al paciente.'}
                    {cat === 'respuestas' && 'Respuestas generales del asistente virtual para saludos, mensajes no reconocidos y derivaciones.'}
                  </div>

                  <div className="space-y-3">
                    {catTemplates.map((config) => {
                      const customized = isCustomized(config.key)
                      const enabled = isEnabled(config.key)
                      const message = getMessage(config.key)
                      const isEditing = editingKey === config.key

                      return (
                        <div key={config.key} className={`rounded-[16px] border transition-all ${
                          isEditing ? 'border-primary-mid bg-white shadow-sm' :
                          !enabled ? 'border-gray-border bg-gray-bg/30 opacity-50' :
                          'border-gray-border bg-white hover:shadow-sm'
                        }`}>
                          {/* Header row */}
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-medium">{config.triggerLabel}</span>
                                  {customized && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary-light text-primary font-medium uppercase tracking-wide">Custom</span>
                                  )}
                                  {saved === config.key && (
                                    <span className="text-[10px] text-teal font-medium">Guardado</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-text-hint mt-0.5">{config.trigger}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggle(config.key)}
                              className={`w-10 h-[22px] rounded-full cursor-pointer transition-colors relative shrink-0 ${
                                enabled ? 'bg-teal' : 'bg-[#D3D1C7]'
                              }`}
                            >
                              <div className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${
                                enabled ? 'left-[20px]' : 'left-[2px]'
                              }`} />
                            </button>
                          </div>

                          {/* Message preview / editor */}
                          <div className="px-4 pb-3">
                            {isEditing ? (
                              <div>
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={5}
                                  className="w-full px-3 py-2.5 rounded-lg border border-primary-mid text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-mid/30 resize-none font-mono leading-relaxed"
                                />
                                <div className="flex items-center gap-2 mt-2.5">
                                  <button
                                    onClick={() => handleSave(config.key)}
                                    disabled={saving}
                                    className="px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer border border-primary bg-primary text-white hover:bg-[#534AB7] transition-colors disabled:opacity-60"
                                  >
                                    {saving ? 'Guardando...' : 'Guardar'}
                                  </button>
                                  <button
                                    onClick={() => setEditingKey(null)}
                                    className="px-3.5 py-1.5 rounded-md text-xs cursor-pointer border border-gray-border bg-white text-text-muted hover:bg-gray-bg transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                  {customized && (
                                    <button
                                      onClick={() => handleReset(config.key)}
                                      className="ml-auto px-3 py-1.5 rounded-md text-[11px] cursor-pointer text-text-hint hover:text-coral transition-colors"
                                    >
                                      Restaurar default
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => enabled && handleEdit(config.key)}
                                className={`relative rounded-lg px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                                  enabled ? 'bg-[#E8F5E1] text-text-muted cursor-pointer hover:bg-[#DCF0D3] transition-colors' : 'bg-gray-bg text-text-hint'
                                }`}
                              >
                                {/* Chat bubble tail */}
                                <div className="absolute -left-1 top-3 w-2 h-2 rotate-45 bg-[#E8F5E1]" />
                                {message}
                                {enabled && (
                                  <div className="mt-2 text-[10px] text-text-hint flex items-center gap-1">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    Hacer clic para editar
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
