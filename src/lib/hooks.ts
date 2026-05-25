import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Patient, Appointment, DateBlock } from '../data/appointments'

// ============ PROFILE ============

export interface ProfileRow {
  id: string
  first_name: string
  last_name: string
  specialty: string
  license: string
  phone: string
  email: string
  address: string
  city: string
  bio: string
  work_days: string[]
  work_from: string
  work_to: string
  session_duration: number
  price_particular: number
  bank_alias: string
  needs_onboarding: boolean
  booking_code: string | null
  booking_slug: string | null
  plan: string | null
  plan_status: string | null
  plan_valid_until: string | null
  avatar_url: string | null
}

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const update = async (updates: Partial<ProfileRow>) => {
    if (!userId) return
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (!error) {
      setProfile((prev) => prev ? { ...prev, ...updates } : prev)
    }
    return error
  }

  return { profile, loading, refetch: fetch, update }
}

// ============ PATIENTS ============

export interface PatientRow {
  id: string
  doctor_id: string
  name: string
  phone: string
  email: string
  age: string
  since: string
  insurance: string
  last_visit: string
  total_sessions: number
  tags: string[]
}

function rowToPatient(row: PatientRow): Patient {
  return {
    name: row.name,
    phone: row.phone || '',
    email: row.email || '',
    age: row.age || '',
    since: row.since || '',
    insurance: row.insurance || 'Particular',
    lastVisit: row.last_visit || '',
    totalSessions: row.total_sessions || 0,
    tags: row.tags || [],
    history: [],
  }
}

export function usePatients(userId: string | null) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [patientRows, setPatientRows] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('doctor_id', userId)
      .order('name')
    if (data) {
      setPatientRows(data)
      setPatients(data.map(rowToPatient))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const add = async (patient: Omit<PatientRow, 'id' | 'doctor_id'>) => {
    if (!userId) return
    const { error } = await supabase.from('patients').insert({ ...patient, doctor_id: userId })
    if (!error) fetch()
    return error
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('patients').delete().eq('id', id)
    if (!error) fetch()
    return error
  }

  return { patients, patientRows, loading, refetch: fetch, add, remove }
}

// ============ APPOINTMENTS ============

export interface AppointmentRow {
  id: string
  doctor_id: string
  patient_id: string | null
  location_id: string | null
  date: string
  time: string
  duration: string
  patient_name: string | null
  detail: string
  status: string
}

function rowToAppointment(row: AppointmentRow & { patients?: any; locations?: any }): Appointment {
  const p = row.patients
  const l = row.locations
  return {
    id: row.id,
    date: row.date,
    time: String(row.time).slice(0, 5),
    duration: row.duration || '50 min',
    patientName: row.patient_name || p?.name || null,
    detail: row.detail || '',
    status: (row.status || 'libre') as Appointment['status'],
    locationId: row.location_id ?? null,
    locationName: l?.name ?? null,
    locationAddress: l?.address ?? null,
    locationCity: l?.city ?? null,
    patient: p ? {
      name: p.name || '',
      phone: p.phone || '',
      email: p.email || '',
      age: p.age || '',
      since: p.since || '',
      insurance: p.insurance || 'Particular',
      lastVisit: p.last_visit || '',
      totalSessions: p.total_sessions || 0,
      tags: p.tags || [],
      history: [],
    } : null,
  }
}

export function useAppointments(userId: string | null) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('appointments')
      .select('*, patients(name, phone, email, age, since, insurance, last_visit, total_sessions, tags), locations(id, name, address, city)')
      .eq('doctor_id', userId)
      .order('date')
      .order('time')
    if (data) {
      setAppointments(data.map(rowToAppointment))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const add = async (apt: Omit<AppointmentRow, 'id' | 'doctor_id'>) => {
    if (!userId) return
    const { error } = await supabase.from('appointments').insert({ ...apt, doctor_id: userId })
    if (!error) fetch()
    return error
  }

  const updateStatus = async (id: string, status: string, detail?: string) => {
    const updates: Record<string, string> = { status }
    if (detail !== undefined) updates.detail = detail
    const { error } = await supabase.from('appointments').update(updates).eq('id', id)
    if (!error) {
      setAppointments((prev) => prev.map((a) =>
        a.id === id ? { ...a, status: status as Appointment['status'], ...(detail !== undefined ? { detail } : {}) } : a
      ))
    }
    return error
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('appointments').delete().eq('id', id)
    if (!error) fetch()
    return error
  }

  return { appointments, loading, refetch: fetch, add, updateStatus, remove }
}

// ============ ORG APPOINTMENTS ============

export function useOrgAppointments(orgId: string | null) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!orgId) { setLoading(false); return }

    // Get all member user_ids for this org
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, profiles(first_name, last_name)')
      .eq('organization_id', orgId)

    if (!members || members.length === 0) { setLoading(false); return }

    const doctorIds = members.map((m) => m.user_id)
    const doctorNames: Record<string, string> = {}
    for (const m of members) {
      const p = (m as any).profiles
      if (p) doctorNames[m.user_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim()
    }

    const { data } = await supabase
      .from('appointments')
      .select('*, patients(name, phone, email, age, since, insurance, last_visit, total_sessions, tags), locations(id, name, address, city)')
      .in('doctor_id', doctorIds)
      .order('date')
      .order('time')

    if (data) {
      setAppointments(data.map((row: any) => ({
        ...rowToAppointment(row),
        doctorLabel: doctorNames[row.doctor_id] || 'Sin asignar',
      })))
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { appointments, loading, refetch: fetch }
}

// ============ ORG PATIENTS ============

export function useOrgPatients(orgId: string | null) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!orgId) { setLoading(false); return }

    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)

    if (!members || members.length === 0) { setLoading(false); return }

    const doctorIds = members.map((m) => m.user_id)

    const { data } = await supabase
      .from('patients')
      .select('*')
      .in('doctor_id', doctorIds)
      .order('name')

    if (data) {
      setPatients(data.map(rowToPatient))
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { patients, loading, refetch: fetch }
}

// ============ ORG DATE BLOCKS ============

export function useOrgDateBlocks(orgId: string | null) {
  const [blocks, setBlocks] = useState<DateBlock[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!orgId) { setLoading(false); return }

    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)

    if (!members || members.length === 0) { setLoading(false); return }

    const doctorIds = members.map((m) => m.user_id)

    const { data } = await supabase
      .from('date_blocks')
      .select('*')
      .in('doctor_id', doctorIds)
      .order('from_date')

    if (data) {
      setBlocks(data.map(rowToDateBlock))
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  return { blocks, loading, refetch: fetch }
}

// ============ DATE BLOCKS ============

export interface DateBlockRow {
  id: string
  doctor_id: string
  from_date: string
  to_date: string
  reason: string
}

function rowToDateBlock(row: DateBlockRow): DateBlock {
  return {
    id: row.id,
    from: row.from_date,
    to: row.to_date,
    reason: row.reason || 'Bloqueado',
    createdAt: '',
  }
}

export function useDateBlocks(userId: string | null) {
  const [blocks, setBlocks] = useState<DateBlock[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('date_blocks')
      .select('*')
      .eq('doctor_id', userId)
      .order('from_date')
    if (data) {
      setBlocks(data.map(rowToDateBlock))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const add = async (block: { from: string; to: string; reason: string }) => {
    if (!userId) return
    const { error } = await supabase.from('date_blocks').insert({
      doctor_id: userId,
      from_date: block.from,
      to_date: block.to,
      reason: block.reason,
    })
    if (!error) fetch()
    return error
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('date_blocks').delete().eq('id', id)
    if (!error) fetch()
    return error
  }

  return { blocks, loading, refetch: fetch, add, remove }
}

// ============ ORGANIZATIONS ============

export interface Organization {
  id: string
  name: string
  slug: string
  created_by: string
  logo_url: string | null
  primary_color: string | null
  accent_color: string | null
}

export interface OrgMember {
  id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  profiles: {
    first_name: string
    last_name: string
    specialty: string
    email: string
  } | null
}

export interface OrgInvite {
  id: string
  invite_code: string
  max_uses: number | null
  use_count: number
  expires_at: string | null
  created_at: string
}

export function useOrganizations(userId: string | null) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [memberships, setMemberships] = useState<Record<string, 'admin' | 'member'>>({})
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    const { data: members } = await supabase
      .from('organization_members')
      .select('organization_id, role, organizations(id, name, slug, created_by, logo_url, primary_color, accent_color)')
      .eq('user_id', userId)
    if (members) {
      const orgs: Organization[] = []
      const roles: Record<string, 'admin' | 'member'> = {}
      for (const m of members) {
        const org = (m as any).organizations as Organization | null
        if (org) {
          orgs.push(org)
          roles[org.id] = m.role as 'admin' | 'member'
        }
      }
      setOrganizations(orgs)
      setMemberships(roles)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const create = async (name: string, slug: string) => {
    if (!userId) return
    const { data, error } = await supabase
      .from('organizations')
      .insert({ name, slug, created_by: userId })
      .select()
      .single()
    if (error) return error
    // Add creator as admin
    await supabase.from('organization_members').insert({
      organization_id: data.id,
      user_id: userId,
      role: 'admin',
    })
    fetch()
    return null
  }

  return { organizations, memberships, loading, refetch: fetch, create }
}

export function useOrgMembers(orgId: string | null) {
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!orgId) return
    const { data } = await supabase
      .from('organization_members')
      .select('id, user_id, role, joined_at, profiles(first_name, last_name, specialty, email)')
      .eq('organization_id', orgId)
      .order('joined_at')
    if (data) setMembers(data as unknown as OrgMember[])
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  const remove = async (memberId: string) => {
    const { error } = await supabase.from('organization_members').delete().eq('id', memberId)
    if (!error) fetch()
    return error
  }

  return { members, loading, refetch: fetch, remove }
}

export function useOrgInvites(orgId: string | null) {
  const [invites, setInvites] = useState<OrgInvite[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!orgId) return
    const { data } = await supabase
      .from('organization_invites')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
    if (data) setInvites(data)
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetch() }, [fetch])

  const create = async (userId: string, maxUses?: number, expiresInDays?: number) => {
    if (!orgId) return
    const code = crypto.randomUUID().slice(0, 8)
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null
    const { error } = await supabase.from('organization_invites').insert({
      organization_id: orgId,
      invite_code: code,
      created_by: userId,
      max_uses: maxUses ?? null,
      expires_at: expiresAt,
    })
    if (!error) fetch()
    return error
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('organization_invites').delete().eq('id', id)
    if (!error) fetch()
    return error
  }

  return { invites, loading, refetch: fetch, create, remove }
}

// ============ BOT TEMPLATES ============

export interface BotTemplate {
  id?: string
  doctor_id: string
  template_key: string
  message: string
  enabled: boolean
}

export function useBotTemplates(userId: string | null) {
  const [templates, setTemplates] = useState<BotTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('bot_templates')
      .select('*')
      .eq('doctor_id', userId)
    if (data) setTemplates(data)
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const upsert = async (templateKey: string, message: string, enabled: boolean) => {
    if (!userId) return
    const { error } = await supabase
      .from('bot_templates')
      .upsert({
        doctor_id: userId,
        template_key: templateKey,
        message,
        enabled,
      }, { onConflict: 'doctor_id,template_key' })
    if (!error) fetch()
    return error
  }

  const toggle = async (templateKey: string, enabled: boolean) => {
    if (!userId) return
    const existing = templates.find((t) => t.template_key === templateKey)
    if (existing) {
      await supabase.from('bot_templates').update({ enabled }).eq('id', existing.id)
    } else {
      // Create with default message — will be filled by the component
      return
    }
    fetch()
  }

  return { templates, loading, refetch: fetch, upsert, toggle }
}

// ============ LOCATIONS ============

export interface LocationRow {
  id: string
  doctor_id: string
  name: string
  address: string
  city: string
  notes: string
  work_days: string[]
  work_from: string | null
  work_to: string | null
  is_primary: boolean
  created_at: string
}

export function useLocations(userId: string | null) {
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('doctor_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at')
    if (data) setLocations(data as LocationRow[])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  const add = async (loc: Omit<LocationRow, 'id' | 'doctor_id' | 'created_at'>) => {
    if (!userId) return { error: { message: 'no user' } }
    const { error, data } = await supabase
      .from('locations')
      .insert({ ...loc, doctor_id: userId })
      .select()
      .single()
    if (!error) fetch()
    return { error, data: data as LocationRow | null }
  }

  const update = async (id: string, patch: Partial<Omit<LocationRow, 'id' | 'doctor_id' | 'created_at'>>) => {
    const { error } = await supabase.from('locations').update(patch).eq('id', id)
    if (!error) fetch()
    return error
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('locations').delete().eq('id', id)
    if (!error) fetch()
    return error
  }

  const setPrimary = async (id: string) => {
    if (!userId) return
    // Clear all primaries for this doctor, set the new one
    await supabase.from('locations').update({ is_primary: false }).eq('doctor_id', userId)
    await supabase.from('locations').update({ is_primary: true }).eq('id', id)
    fetch()
  }

  return { locations, loading, refetch: fetch, add, update, remove, setPrimary }
}

/** Public fetch of a doctor's locations by their id — used on the public booking page. */
export async function getPublicLocations(doctorId: string): Promise<LocationRow[]> {
  const { data } = await supabase
    .from('locations')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('is_primary', { ascending: false })
    .order('created_at')
  return (data as LocationRow[]) || []
}
