export type PlanId = 'free' | 'pro' | 'clinic'

export interface Plan {
  id: PlanId
  name: string
  /** Monthly price in ARS. */
  price: number
  description: string
  features: string[]
  highlighted?: boolean
  limits: {
    patients: number | null // null = unlimited
    organizationEnabled: boolean
    customBranding: boolean
    stats: boolean
  }
}

/** Trial length (in days) when a doctor starts a paid plan for the first time. */
export const TRIAL_DAYS = 14

/**
 * Format an ARS amount for display: "$18.000".
 * We round to the nearest peso — no decimals, Argentine locale grouping.
 */
export function formatARS(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Para empezar.',
    features: [
      'Hasta 10 pacientes',
      'Agenda web completa',
      'Link público de reservas',
      'Confirmaciones por mail con calendario',
      '1 profesional',
      'Soporte por email',
    ],
    limits: {
      patients: 10,
      organizationEnabled: false,
      customBranding: false,
      stats: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 35000,
    description: 'Para profesionales independientes.',
    highlighted: true,
    features: [
      'Todo lo de Free',
      'Pacientes ilimitados',
      'Marca propia: logo y colores',
      'Link público con tu identidad',
      'Estadísticas completas',
      'Soporte prioritario',
    ],
    limits: {
      patients: null,
      organizationEnabled: false,
      customBranding: true,
      stats: true,
    },
  },
  clinic: {
    id: 'clinic',
    name: 'Clinic',
    price: 90000,
    description: 'Para consultorios y clínicas.',
    features: [
      'Todo lo de Pro',
      'Hasta 10 profesionales',
      'Agenda centralizada del consultorio',
      'Panel de administración',
      'Invitar y gestionar médicos',
      'Estadísticas por profesional y globales',
      'Soporte prioritario',
    ],
    limits: {
      patients: null,
      organizationEnabled: true,
      customBranding: true,
      stats: true,
    },
  },
}

export function getPlan(planId: PlanId | string | null | undefined): Plan {
  if (planId && planId in PLANS) return PLANS[planId as PlanId]
  return PLANS.free
}

export function canAddPatient(planId: PlanId | string | null | undefined, currentCount: number): boolean {
  const plan = getPlan(planId)
  if (plan.limits.patients === null) return true
  return currentCount < plan.limits.patients
}

export function canCreateOrg(planId: PlanId | string | null | undefined): boolean {
  return getPlan(planId).limits.organizationEnabled
}

export function canCustomBranding(planId: PlanId | string | null | undefined): boolean {
  return getPlan(planId).limits.customBranding
}
