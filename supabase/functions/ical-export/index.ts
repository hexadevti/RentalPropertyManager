import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function icalDate(iso: string): string {
  return iso.replace(/-/g, '').slice(0, 8)
}

function icalEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function icalTimestamp(): string {
  return new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response('Server configuration error', { status: 500 })
  }

  const url = new URL(req.url)
  const propertyId = url.searchParams.get('propertyId')

  if (!propertyId) {
    return new Response('Missing propertyId parameter', { status: 400 })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: property } = await adminClient
    .from('properties')
    .select('id, name, tenant_id, city, address')
    .eq('id', propertyId)
    .maybeSingle()

  if (!property) {
    return new Response('Property not found', { status: 404 })
  }

  const { data: contractLinks } = await adminClient
    .from('contract_properties')
    .select('contract_id')
    .eq('property_id', propertyId)

  const contractIds = (contractLinks ?? []).map((l: any) => l.contract_id)

  let contracts: any[] = []
  if (contractIds.length > 0) {
    const { data } = await adminClient
      .from('contracts')
      .select('id, start_date, end_date, guest_id, status, rental_type')
      .in('id', contractIds)
      .eq('tenant_id', property.tenant_id)
      .neq('status', 'cancelled')
    contracts = data ?? []
  }

  const guestIds = [...new Set(contracts.map((c: any) => c.guest_id).filter(Boolean))]
  let guests: any[] = []
  if (guestIds.length > 0) {
    const { data } = await adminClient
      .from('guests')
      .select('id, name')
      .in('id', guestIds)
      .eq('tenant_id', property.tenant_id)
    guests = data ?? []
  }

  const dtstamp = icalTimestamp()
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RPM - Rental Property Manager//NONSGML v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icalEscape(property.name)}`,
    `X-WR-TIMEZONE:UTC`,
  ]

  for (const contract of contracts) {
    const guest = guests.find((g: any) => g.id === contract.guest_id)
    const summary = guest?.name ? icalEscape(guest.name) : 'Reserved'

    // iCal DTEND for all-day events is exclusive (day after last night)
    const endDateExclusive = new Date(contract.end_date)
    endDateExclusive.setDate(endDateExclusive.getDate() + 1)
    const dtEnd = endDateExclusive.toISOString().slice(0, 10).replace(/-/g, '')

    lines.push('BEGIN:VEVENT')
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`UID:${contract.id}@rpm-app`)
    lines.push(`DTSTART;VALUE=DATE:${icalDate(contract.start_date)}`)
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`)
    lines.push(`SUMMARY:${summary}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  const icsContent = lines.join('\r\n')
  const filename = property.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()

  return new Response(icsContent, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.ics"`,
      'Cache-Control': 'no-cache',
    },
  })
})
